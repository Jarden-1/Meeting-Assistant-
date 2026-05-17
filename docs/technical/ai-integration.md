# AI 接入规范 v0.1

## 1. 定位

本项目中的助手背后必须接入大模型。

大模型不是前端能力，而是后端核心能力。前端不能直接调用大模型，也不能接触模型 API Key。

第一版大模型用于：

1. 生成会前准备建议。
2. 回答会中用户提问。
3. 抽取讨论链路。
4. 生成会后跟进草稿。
5. 提醒遗漏信息。

## 2. 模型配置

第一版使用 OpenAI-compatible API。

环境变量：

```env
LLM_BASE_URL=https://api.2006038.xyz/v1
LLM_MODEL=gpt-5.5
LLM_API_KEY=<从部署环境读取>
```

安全规则：

- `LLM_API_KEY` 不能写入代码。
- `LLM_API_KEY` 不能写入仓库文档。
- 前端不能接触 `LLM_API_KEY`。
- 日志不能输出完整请求头、API Key 或敏感会议全文。
- 设置页只能展示后端配置状态和连接测试结果，不能提供 API Key 明文输入、读取或保存能力。

## 3. AiModule 职责

`AiModule` 是后端内部模块，不直接暴露给前端。

业务模块通过 AiModule 使用大模型：

```text
PreparationModule -> AiModule
AssistantModule   -> AiModule
DiscussionModule  -> AiModule
FollowUpsModule   -> AiModule
```

AiModule 内部建议拆分：

```text
ContextBuilder
PromptBuilder
LlmProvider
StructuredOutputParser
Guardrails
```

### ContextBuilder

负责按当前用户和当前会议构造上下文。

可使用的数据：

```text
currentUser.id
threadId
sessionId
当前会议内容
当前会议转写片段
会前准备快照
历史共识/决策
未完成待办
工作进展
风险
遗留问题
下次带入项
助手历史问答
```

禁止使用：

```text
其他用户的数据
无关会议线程的数据
前端传入的 userId
未经过后端权限校验的资源
```

### PromptBuilder

负责根据任务类型构造 prompt。

任务类型：

```text
preparation
assistantAsk
discussionExtract
followUpDraft
followUpDraftProgress
```

### LlmProvider

负责调用 OpenAI-compatible API。

配置来源：

```text
LLM_BASE_URL
LLM_MODEL
LLM_API_KEY
```

业务模块不直接调用 LlmProvider。

### StructuredOutputParser

负责解析模型返回结果。

规则：

- 对于会前准备、讨论链路、会后跟进，必须要求模型返回 JSON。
- JSON 解析失败时，可以尝试一次修复。
- 修复仍失败，则返回 `AI_FAILED`。
- 不允许把未解析的长文本直接当正式结构返回。

### Guardrails

负责基础防护：

- 限制输入长度。
- 限制输出结构。
- 检查必要字段。
- 禁止跨用户上下文。
- 禁止把前端传入的模型配置或 API Key 作为可信配置。
- AI 结果默认是候选结果。
- 会后草稿必须用户确认后才进入正式表。

## 4. AI 任务规范

### 4.1 会前准备 preparation

输入：

```text
会议线程背景
最近会议摘要
历史共识/决策
未完成待办
工作进展
风险
遗留问题
下次带入项
```

输出结构：

```json
{
  "lastConsensus": [],
  "lastDecisions": [],
  "openActionItems": [],
  "progressUpdates": [],
  "openQuestions": [],
  "risks": [],
  "suggestedFocus": [],
  "suggestedAgenda": []
}
```

说明：

- 会前准备要短、准、可扫读。
- `suggestedFocus` 和 `suggestedAgenda` 可由模型生成。
- 如果模型失败，后端可以基于待办、风险和遗留问题生成兜底内容。

### 4.2 会中问答 assistantAsk

输入：

```text
用户问题
当前会议内容
当前会议转写片段
会前准备快照
历史共识/决策
未完成待办
工作进展
风险
遗留问题
相关助手历史问答
```

输出结构：

```json
{
  "answer": "根据上次会议记录，这个事项由张三负责。",
  "sources": [
    {
      "type": "actionItem",
      "id": "action_001",
      "label": "张三周五前给接口方案"
    }
  ]
}
```

说明：

- 回答要围绕会议上下文。
- 不做无关闲聊。
- 能引用来源时必须返回 `sources`。
- 不确定时应说明不确定，而不是编造。

### 4.3 讨论链路抽取 discussionExtract

输入：

```text
当前会议内容
当前会议转写片段
会前准备快照
```

输出结构：

```json
{
  "discussionChains": [
    {
      "topic": "是否本周上线基础版",
      "facts": [],
      "opinions": [],
      "disagreements": [],
      "decision": "",
      "openQuestions": [],
      "nextActions": []
    }
  ],
  "warnings": []
}
```

说明：

- 重点是解释讨论如何形成结论。
- 不是普通摘要。
- 如果某个议题没有结论，应放入 `openQuestions` 或 `warnings`。

### 4.4 会后跟进草稿 followUpDraft

输入：

```text
会议内容
会议转写片段
会前准备快照
历史上下文
讨论链路候选
```

输出结构：

```json
{
  "summary": "",
  "consensus": [],
  "decisions": [],
  "actionItems": [],
  "risks": [],
  "openQuestions": [],
  "progressUpdates": [],
  "carryInItems": [],
  "warnings": []
}
```

建议字段结构：

```json
{
  "actionItems": [
    {
      "description": "张三周五前给接口方案",
      "ownerText": "张三",
      "dueDate": "2026-05-17",
      "status": "pending",
      "priority": "high",
      "riskLevel": "at_risk",
      "importance": "high",
      "urgency": "high",
      "sourceText": "张三周五前给接口方案"
    }
  ]
}
```

说明：

- 该结果是草稿。
- 用户确认后才能写入正式表。
- 如果待办缺负责人或截止时间，应在 `warnings` 中提示。
- `priority`、`riskLevel`、`importance`、`urgency` 可以由模型建议，后端需要校验枚举值；缺失时使用规则兜底。

### 4.5 会后生成状态 followUpDraftProgress

该任务不是模型任务，而是后端对会后草稿生成过程的状态表达，用于支撑 `stitch_/ai` 的 AI 生成中页面。

推荐阶段：

```text
extracting_core_points
extracting_action_items
generating_summary
validating_structure
completed
failed
```

前端可以展示阶段名称和进度百分比，但不能依赖进度百分比判断数据已经正式保存。只有 `followUpDraft` 成功返回并保存草稿后，才进入用户编辑确认流程。

## 5. 失败处理

### 模型调用失败

返回：

```json
{
  "error": {
    "code": "AI_FAILED",
    "message": "AI 生成失败，请稍后重试或手动整理",
    "details": {
      "reason": "provider_timeout"
    }
  },
  "requestId": "req_xxx"
}
```

### JSON 解析失败

处理策略：

```text
1. 尝试一次 JSON 修复。
2. 修复成功则继续。
3. 修复失败则返回 AI_FAILED。
```

### 上下文过长

处理策略：

```text
1. 优先保留当前会议内容。
2. 当前会议内容优先从 `TranscriptSegment` 按时间顺序拼接；如果片段不可用，使用 `MeetingSession.meetingContent`。
3. 保留 active 待办、open 遗留问题、active 风险。
4. 保留最近会议的摘要和决策。
5. 历史较久内容压缩为摘要。
```

## 6. 日志规则

允许记录：

```text
requestId
userId
taskType
threadId
sessionId
model
耗时
是否成功
错误码
```

禁止记录：

```text
LLM_API_KEY
Authorization token
完整会议内容
完整模型输入
完整模型输出
```

开发环境如需排查 prompt，应使用显式开关，并避免提交敏感日志。

## 7. 用户确认原则

AI 输出分两类：

### 展示型结果

例如助手回答。

处理方式：

```text
直接展示给用户
保存 AssistantMessage
不写入正式会议结论
```

### 候选型结果

例如会后跟进草稿、讨论链路候选。

处理方式：

```text
展示给用户编辑
用户确认后才写入正式表
```

核心原则：

```text
AI 负责整理和提示
用户负责确认事实
```
