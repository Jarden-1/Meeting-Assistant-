# 会议助手后端与核心功能实现方案

## 1. 产品核心

会议助手 v0.1 的核心不是单次会议纪要生成，而是一个围绕“议题”的连续会议记忆系统。

用户在同一个议题下可以连续召开多次会议。每次会议结束后，系统把用户确认后的摘要、决策、待办、风险、遗留问题、工作进展和下次带入项沉淀为长期记忆。下一次进入同一议题并开始新会议时，系统会自动读取这些长期记忆，生成会前简报，让新会议带着之前系列会议的上下文继续推进。

主链路如下：

```text
进入议题
  -> 生成会前简报
  -> 用户编辑/勾选带入项
  -> 开始新会议并保存 carryInSnapshot
  -> 会议中转写/手动记录/AI 讨论
  -> 会议结束生成会后报告草稿
  -> 用户按区块编辑确认
  -> 拆分保存为长期记忆
  -> 下次会议继续带入
```

这个闭环是第一版最重要的功能。实时转写、AI 助手、会议综述、设置页模型配置都应该服务于这条闭环。

## 2. 核心概念

`MeetingThread` 是议题，也是记忆边界。例如“产品迭代同步”“客户 A 项目推进”“内部周会”。

`MeetingSession` 是同一个议题下的一次具体会议。

`ThreadMemory` 不是一张单独的表，而是一组可被同一议题复用的数据来源，包括：

- `Decision`：已确认共识和决策。
- `ActionItem`：待办事项。
- `Risk`：风险和阻塞。
- `OpenQuestion`：遗留问题。
- `ProgressUpdate`：工作进展。
- `CarryInItem`：下次带入项。
- `MeetingSession.memorySummary`：适合 AI 和会前简报使用的压缩会议记忆。

长期记忆只来自用户确认后的正式数据。AI 临时回答、未确认草稿、实时转写片段不直接进入长期记忆，避免把模型猜测污染为事实。

## 3. 技术架构

项目采用前后端分离的 monorepo：

```text
apps/
  web/   React + Vite + TypeScript
  api/   NestJS + TypeScript
packages/
  shared/ 共享类型、枚举、DTO schema
docs/
```

后端建议使用：

- NestJS：业务模块、鉴权、REST API。
- Prisma：数据模型、迁移、类型安全查询。
- PostgreSQL：持久化会议数据。
- JWT：演示账号 token。
- OpenAI-compatible LLM Provider：统一模型调用。
- Tencent ASR Provider：第一版语音转写供应商。

后端模块：

```text
AuthModule
ThreadsModule
SessionsModule
ThreadMemoryModule
PreparationModule
AssistantModule
ReportsModule
FollowUpsModule
TranscriptionModule
SettingsModule
AiModule
```

`AiModule` 和 `TranscriptionModule` 是内部能力，不直接暴露成“万能 AI 接口”或“裸供应商接口”。产品 API 应该使用业务语义，例如生成会前简报、询问会议助手、生成会议报告、确认正式记录。

## 4. 账号与权限

第一版使用演示级账号壳子。

用户输入 `entryName` 进入系统。若账号不存在，后端自动创建；若账号存在，直接进入。后端返回 token。后续所有请求通过 `Authorization: Bearer <token>` 识别当前用户。

前端不传 `userId`，也不能决定数据归属。所有业务表都需要带 `userId`。查询、更新、删除时必须用 `userId` 做归属校验。

第一版不做邮箱、手机号、密码、组织、团队共享和多人权限。

## 5. 议题记忆机制

同一个议题下的新会议必须记住之前系列会议的讨论结果。

实现方式是三层记忆：

```text
结构化记忆：
  Decision / ActionItem / Risk / OpenQuestion / ProgressUpdate / CarryInItem

摘要记忆：
  MeetingSession.summary
  MeetingSession.memorySummary

原始记录：
  meetingContent
  TranscriptSegment
```

默认情况下，会前简报和 AI 助手优先使用结构化记忆和摘要记忆。原始转写不应默认全部塞入上下文，只在用户追问具体历史细节时检索相关片段。

建议新增内部服务：

```ts
ThreadMemoryService
  buildPreparation(threadId, userId)
  buildAssistantContext(sessionId, userId, question)
  buildReportContext(sessionId, userId)
  searchHistoricalTranscript(threadId, userId, query)
```

这个服务负责统一构造“当前会议 + 同议题历史”的上下文，避免记忆逻辑散落在各个模块。

## 6. 会前简报

进入议题后，系统自动生成会前简报。开始新会议前，用户可以快速编辑、勾选或补充带入项。

会前简报结构：

```json
{
  "lastConsensus": [],
  "lastDecisions": [],
  "openActionItems": [],
  "progressUpdates": [],
  "openQuestions": [],
  "risks": [],
  "suggestedFocus": [],
  "suggestedAgenda": [],
  "manualNotes": [],
  "warnings": []
}
```

生成方式：

- `lastConsensus` 从最近的 `Decision(type=consensus)` 读取。
- `lastDecisions` 从最近的 `Decision(type=decision)` 读取。
- `openActionItems` 从未完成待办读取。
- `progressUpdates` 从最近工作进展读取。
- `openQuestions` 从未解决问题读取。
- `risks` 从 active 风险读取。
- `suggestedFocus` 和 `suggestedAgenda` 可由 AI 生成，AI 失败时用规则兜底。
- `manualNotes` 来自用户开始会议前手动补充。

开始新会议时：

```http
POST /api/v1/threads/:threadId/sessions
```

请求里带用户编辑后的 `preparationSnapshot`。后端把它保存到 `MeetingSession.carryInSnapshot`。

`carryInSnapshot` 表示“本次会议开始时实际带入了哪些历史上下文”。它是后续 AI 助手、会议报告生成和会议回看的重要依据。

## 7. 会议中记录

会议内容有两种来源：

1. 手动输入或粘贴。
2. 语音转写生成片段。

第一版必须保证即使语音转写不可用，用户也能通过手动输入完成完整流程。

建议同时保存：

- `MeetingSession.meetingContent`：整段会议内容，便于 AI 处理和兜底。
- `TranscriptSegment`：逐条发言片段，用于实时记录页、全量记录页、搜索、编辑和导出。

当用户只粘贴整段会议内容时，后端可以生成一条默认 `TranscriptSegment`：

```text
speakerText = "手动记录"
source = "manual"
sequence = 1
text = meetingContent
```

当用户编辑某条转写片段后：

```text
TranscriptSegment.source = edited
```

后端需要同步更新 `meetingContent`，或者标记该 session 需要重新拼接。

## 8. 语音转写

第一版推荐接腾讯云语音识别 ASR，不自研语音识别模型。

成本策略：

```text
默认模式：普通实时语音识别，用于低成本测试和基础可用。
增强模式：实时说话人分离，用于需要区分 Speaker 1 / Speaker 2 的会议。
```

后端封装统一 Provider，不把业务逻辑绑定死在腾讯云：

```ts
TranscriptionProvider
  startSession()
  acceptAudioChunk()
  finishSession()
  normalizeResult()
```

统一保存为：

```text
Transcription
  id
  userId
  threadId
  sessionId
  provider
  mode
  text
  durationSeconds
  status
  errorMessage

TranscriptSegment
  id
  userId
  threadId
  sessionId
  transcriptionId
  speakerText
  startedAt
  endedAt
  text
  source
  sequence
  confidence
  provider
```

说话人分离的产品边界：

```text
系统可以区分不同说话人，但不能保证识别真实姓名。
供应商通常返回 Speaker 1 / Speaker 2 这类角色。
前端应允许用户把 Speaker 1 重命名为“张三”，本场会议后续沿用该映射。
```

后续可以替换为讯飞、阿里云、Deepgram、AssemblyAI 或自部署 FunASR，但业务层不需要重写。

## 9. AI 会议助手

AI 会议助手定位为“能积极参与讨论的同事”，不是只会整理纪要的秘书。

它应该能：

- 回答当前会议相关问题。
- 根据历史会议提醒上次结论。
- 总结刚才讨论。
- 提炼分歧点。
- 识别风险。
- 参与头脑风暴。
- 提出替代方案。
- 在信息不足时追问。

第一版不让 AI 直接创建待办、修改会议内容或写入正式记录。它只回答、总结、参与讨论。生成候选待办等自动操作可以后续增强。

接口：

```http
POST /api/v1/sessions/:sessionId/assistant/ask
```

请求：

```json
{
  "question": "这个方案有什么风险？"
}
```

后端流程：

```text
1. 校验 session 属于当前用户。
2. 读取当前会议标题、状态、carryInSnapshot。
3. 读取当前会议最新 meetingContent / TranscriptSegment。
4. 读取同一 thread 的历史 memorySummary。
5. 读取同一 thread 的决策、未完成待办、风险、遗留问题。
6. 读取最近几轮 AssistantMessage。
7. 构造 prompt。
8. 调用 LLM。
9. 保存用户问题和助手回答。
10. 返回回答。
```

回答风格：

```text
先直接回答。
再给 2-4 个要点。
必要时补一个追问。
区分“会议中已确认的事实”和“AI 的建议/推测”。
```

系统提示词核心约束：

```text
你是当前会议中的 AI 同事。
你可以积极参与讨论、总结、追问、提出替代方案、识别风险。
你不能替团队做最终决定。
你必须区分会议事实和你的建议。
事实类问题优先基于当前会议和同议题历史上下文。
头脑风暴类问题可以使用通用知识，但要说明这是建议。
上下文不足时要说明不确定或提出追问。
```

第一版采用“提问时读取当前已保存内容”的方式，不做 AI 常驻会议。

```text
前端持续保存转写片段/手动内容
用户提问
后端读取当前已保存内容
后端读取同议题历史记忆
调用模型
返回回答
```

这样成本低、实现稳，后续可以升级为 AI 实时旁听。

## 10. 会议报告与综述

会议报告不要让 AI 直接生成 HTML 或自由 Markdown。AI 负责生成结构化内容，后端负责校验和补默认值，前端负责稳定排版。

会议结束后：

```http
POST /api/v1/sessions/:sessionId/report-draft
```

后端基于当前会议内容、转写片段、会前快照和同议题历史记忆生成报告草稿。

推荐草稿结构：

```json
{
  "summary": {
    "title": "会议摘要",
    "content": "本次会议主要确认了..."
  },
  "memorySummary": "用于后续会议的短摘要",
  "decisions": [
    {
      "type": "decision",
      "content": "本周先上线基础版",
      "rationale": "客户希望尽快试用",
      "sourceText": ""
    }
  ],
  "actionItems": [
    {
      "description": "张三周五前给接口方案",
      "ownerText": "张三",
      "dueDate": "2026-05-17",
      "priority": "high",
      "riskLevel": "at_risk",
      "importance": "high",
      "urgency": "high",
      "sourceText": ""
    }
  ],
  "risks": [
    {
      "content": "测试窗口不足可能影响上线质量",
      "level": "medium",
      "sourceText": ""
    }
  ],
  "openQuestions": [
    {
      "content": "支付能力是否进入下周版本",
      "sourceText": ""
    }
  ],
  "progressUpdates": [
    {
      "content": "接口方案已完成初稿，待评审",
      "sourceText": ""
    }
  ],
  "carryInItems": [
    {
      "type": "unfinished_action",
      "content": "下次继续确认支付能力排期"
    }
  ],
  "discussionChains": [
    {
      "topic": "是否本周上线基础版",
      "facts": [],
      "opinions": [],
      "disagreements": [],
      "decision": "本周先上线基础版",
      "openQuestions": [],
      "nextActions": []
    }
  ],
  "warnings": []
}
```

`summary` 给用户看，可以自然完整。`memorySummary` 给 AI 和下次会前简报使用，应该短、事实化、无废话。

前端按区块展示草稿：

```text
会议摘要
关键决策/共识
讨论链路
待办事项
风险与阻塞
遗留问题
工作进展
下次带入项
提醒
```

每个区块都可编辑。用户最终点击“确认正式记录”。

## 11. 长期记忆更新

会议报告草稿生成后不直接进入长期记忆。用户按区块编辑确认后，调用：

```http
POST /api/v1/sessions/:sessionId/finalize
```

后端在事务中完成：

```text
1. 保存 MeetingSession.summary。
2. 保存 MeetingSession.memorySummary。
3. 保存 Decision。
4. 保存 ActionItem。
5. 保存 Risk。
6. 保存 OpenQuestion。
7. 保存 ProgressUpdate。
8. 保存 CarryInItem。
9. 保存 DiscussionChain。
10. 标记 FollowUpDraft / ReportDraft 为 applied。
11. 更新 MeetingSession.status = finalized。
12. 更新 MeetingThread.lastMeetingAt。
```

按区块确认，不要求逐条强制确认，也不一次性盲目确认整份报告。

待办的 `ownerText` 和 `dueDate` 可以为空。真实会议中很多待办一开始就是模糊的。AI 应尽量抽取，缺失时写入 `warnings`，前端高亮提醒用户补全，但不阻止确认。

## 12. 会议综述排版

排版由前端组件决定，不由 AI 决定。

前端可以把报告草稿渲染为稳定结构：

```text
顶部：
  会议标题、议题、时间、状态、生成状态

第一屏：
  核心摘要、待办数、风险数、遗留问题数

中部：
  关键决策、讨论链路

后部：
  待办事项、风险与阻塞、遗留问题、工作进展、下次带入项

底部：
  全量记录入口、导出入口
```

不同会议只影响区块内容和数量，不影响整体页面骨架。

区块类型建议枚举：

```text
summary
keyDecisions
discussionChains
actionItems
risks
openQuestions
progressUpdates
carryInItems
warnings
```

前端根据 `type` 选择组件：

```text
keyDecisions      -> 决策卡片
discussionChains  -> 讨论链路卡片/时间线
actionItems       -> 待办表格
risks             -> 风险列表
openQuestions     -> 遗留问题列表
progressUpdates   -> 进展列表
carryInItems      -> 下次带入列表
```

## 13. AI 生成流程

第一版产品上可以表现为一个“生成会议报告”接口，但后端内部应该按任务边界设计，便于后续优化。

建议内部任务：

```text
summaryExtract       生成摘要和 memorySummary
discussionExtract    抽取讨论链路
followUpExtract      抽取决策、待办、风险、遗留问题、进展、下次带入项
reportCompose        组合成前端可渲染的报告草稿
```

第一版可以先一次模型调用完成，但代码结构上保留任务类型和 prompt builder。

AI 输出必须是结构化 JSON。后端需要：

```text
1. 解析 JSON。
2. 校验枚举值。
3. 对缺失字段补默认值。
4. 对无法解析的输出尝试一次修复。
5. 仍失败则返回 AI_FAILED。
6. 保存原始错误摘要，但日志不记录完整会议内容和完整模型输入输出。
```

## 14. 模型配置

系统支持两层模型配置：

```text
系统默认配置：
  来自后端环境变量。
  用户不可见 API Key。

用户自定义配置：
  用户可以填写 provider / baseUrl / model / apiKey。
  后端加密保存 API Key。
  前端永远不回显 API Key 明文。
```

调用优先级：

```text
当前用户自定义配置可用
  -> 使用用户自定义模型
否则
  -> 使用系统默认模型
```

设置页展示：

```text
系统默认模型：已由后端配置 / 未配置
默认模型名：可展示
默认 Base URL：可展示是否配置，不展示敏感细节
默认 API Key：已配置 / 未配置，不可见

用户自定义模型：已配置 / 未配置
用户 API Key：已保存，前端不可见
连接测试结果：成功 / 失败 / 延迟
```

保存用户自定义配置时：

```http
PUT /api/v1/settings/llm/custom
```

连接测试：

```http
POST /api/v1/settings/llm/test
```

测试由后端发起，前端不直接调用模型供应商。

## 15. API 草案

认证：

```text
POST /api/v1/auth/enter
GET  /api/v1/auth/me
POST /api/v1/auth/logout
```

议题：

```text
GET    /api/v1/threads
POST   /api/v1/threads
GET    /api/v1/threads/:threadId
PATCH  /api/v1/threads/:threadId
DELETE /api/v1/threads/:threadId
```

会前简报：

```text
GET  /api/v1/threads/:threadId/preparation
POST /api/v1/threads/:threadId/preparation/refresh
```

会议：

```text
POST  /api/v1/threads/:threadId/sessions
GET   /api/v1/threads/:threadId/sessions
GET   /api/v1/sessions/:sessionId
PATCH /api/v1/sessions/:sessionId
POST  /api/v1/sessions/:sessionId/finalize
```

转写：

```text
POST /api/v1/sessions/:sessionId/transcriptions
GET  /api/v1/sessions/:sessionId/transcript-segments
PATCH /api/v1/transcript-segments/:segmentId
```

AI 助手：

```text
POST /api/v1/sessions/:sessionId/assistant/ask
GET  /api/v1/sessions/:sessionId/assistant/messages
```

会议报告：

```text
POST /api/v1/sessions/:sessionId/report-draft
GET  /api/v1/sessions/:sessionId/report-draft
GET  /api/v1/sessions/:sessionId/report-draft/progress
```

待办：

```text
GET   /api/v1/threads/:threadId/action-items
GET   /api/v1/action-items/mine
PATCH /api/v1/action-items/:actionItemId
```

设置：

```text
GET  /api/v1/settings/llm
PUT  /api/v1/settings/llm/custom
POST /api/v1/settings/llm/test
```

## 16. MVP 开发顺序

第一阶段先跑通不依赖转写的主闭环：

```text
1. NestJS 项目骨架。
2. Prisma schema。
3. 演示账号登录。
4. 议题 CRUD。
5. 新建会议。
6. 手动输入/粘贴会议内容。
7. 会前简报规则生成。
8. 保存 carryInSnapshot。
9. AI 会议助手基础问答。
10. AI 会议报告草稿。
11. 按区块确认 finalize。
12. 下一次会议读取长期记忆。
```

第二阶段接语音转写：

```text
1. 腾讯云 ASR 配置。
2. 普通实时识别。
3. 保存 TranscriptSegment。
4. 全量记录编辑。
5. 说话人分离模式。
6. Speaker 重命名映射。
```

第三阶段优化体验：

```text
1. AI 生成进度页。
2. 历史转写检索。
3. 更强的讨论链路展示。
4. 用户自定义模型配置。
5. 导出会议报告。
6. 我的待办矩阵视图增强。
```

这个顺序可以避免第一版被实时转写、说话人区分和复杂排版拖慢。先让“同议题记忆 + 会前简报 + 会中 AI + 会后确认 + 下次带入”成立，再逐步增强。

## 17. 第一版验收标准

第一版做到以下能力即可认为核心方向成立：

```text
1. 用户可以输入 entryName 进入系统。
2. 不同用户只能看到自己的数据。
3. 用户可以创建议题。
4. 用户可以在议题下创建多次会议。
5. 新会议开始前可以看到并编辑会前简报。
6. 开始会议时保存 carryInSnapshot。
7. 会议中可以手动输入或保存会议内容。
8. AI 助手可以基于当前会议和同议题历史参与讨论。
9. 会议结束后可以生成结构化报告草稿。
10. 用户可以按区块编辑确认。
11. 确认后的内容进入长期记忆。
12. 下一次同议题会议会自动带入之前的长期记忆。
13. 设置页不泄露系统默认 API Key。
14. 用户自定义模型配置保存后不回显 API Key 明文。
```

## 18. 关键原则

```text
AI 负责生成候选，用户负责确认事实。
议题是记忆边界，不做全局混合记忆。
长期记忆只来自用户确认后的正式数据。
前端负责排版，AI 只负责结构化内容。
转写是输入能力，不是主链路。
说话人分离不等于真实身份识别。
模型 API Key 永远不在前端明文展示。
第一版优先闭环可靠，不追求全自动。
```
