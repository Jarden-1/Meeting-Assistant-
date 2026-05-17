# 数据模型文档 v0.1

## 1. 数据设计原则

### 围绕主链路建模

数据模型服务于以下主链路：

```text
会前准备
  <- 历史共识/决策、待办、工作进展、风险、遗留问题、下次带入项

会后跟进
  -> 摘要、共识/决策、待办、工作进展、风险、遗留问题、下次带入项
```

会中问答和讨论链路用于增强体验，但仍然要沉淀到会议线程中，方便后续追溯。

### 所有业务数据绑定 userId

第一版是演示账号壳子，但数据隔离仍然必须成立。

除系统配置类数据外，所有业务表都应带 `userId`。

### AI 草稿和正式数据分离

AI 生成的会后跟进结果先保存为草稿。

用户确认后，再拆分保存到正式表：

- Decision
- ActionItem
- ProgressUpdate
- Risk
- OpenQuestion
- CarryInItem
- DiscussionChain
- TranscriptSegment

### 共识和决策合并存储

共识和决策都表示会议中已经确认下来的内容。

第一版使用一张 `Decision` 表，通过 `type` 区分：

```text
consensus
decision
```

## 2. 核心模型

### User

演示账号用户。

字段：

```text
id
entryName       唯一，用户输入的账号名
displayName     展示名
createdAt
updatedAt
```

说明：

- 第一版不保存邮箱、手机号和密码。
- `entryName` 用于进入系统和区分用户。
- 后续正式版本可迁移到真实认证体系。

### MeetingThread

会议线程，一组连续会议的上下文容器。

字段：

```text
id
userId
title
background
lastMeetingAt
deletedAt
createdAt
updatedAt
```

说明：

- 删除采用软删除，设置 `deletedAt`。
- 普通查询默认过滤 `deletedAt != null` 的记录。

### MeetingSession

单次会议。

字段：

```text
id
userId
threadId
title
status          preparing | in_meeting | reviewing | finalized
meetingContent  用户输入、粘贴或转写后的会议内容
summary
carryInSnapshot JSON，会前准备快照
startedAt
endedAt
createdAt
updatedAt
```

状态说明：

```text
preparing   会前准备中
in_meeting  会议进行中
reviewing   会后草稿确认中
finalized   已形成正式记录
```

`finalized` 不代表锁定。用户后续仍可编辑正式记录，第一版不做版本历史。

`meetingContent` 是整段会议内容，主要供 AI 任务和手动编辑使用。全量记录页和实时记录页使用 `TranscriptSegment` 展示逐条发言。

### CarryInSnapshot

会前准备快照，不单独建表，保存在 `MeetingSession.carryInSnapshot`。

结构：

```text
lastConsensus
lastDecisions
openActionItems
progressUpdates
openQuestions
risks
suggestedFocus
suggestedAgenda
```

说明：

- 打开会议线程时，会前准备动态生成。
- 创建单次会议时，把当时的会前准备保存为快照。
- 之后回看会议时，可以知道当时会议基于什么上下文展开。

### Decision

共识/决策。

字段：

```text
id
userId
threadId
sessionId
type            consensus | decision
content
rationale
sourceText
createdAt
updatedAt
```

说明：

- `type=consensus` 表示达成共识。
- `type=decision` 表示做出决策。
- `sourceText` 可保存来自会议内容的来源片段，方便追溯。

### ActionItem

待办事项。

字段：

```text
id
userId
threadId
sessionId
description
ownerText
dueDate
status          pending | in_progress | done | canceled
priority        low | medium | high | urgent
riskLevel       none | at_risk | high_risk
importance      low | high
urgency         low | high
sourceText
createdAt
updatedAt
```

说明：

- 第一版负责人使用文本字段 `ownerText`。
- 负责人不绑定系统用户。
- 待办状态会影响后续会前准备。
- `priority` 和 `riskLevel` 用于会议待办页的优先级/风险标签。
- `importance` 和 `urgency` 用于“我的待办”的矩阵视图。默认值可由规则生成，用户后续可以修改。

### ProgressUpdate

工作进展。

字段：

```text
id
userId
threadId
sessionId
content
sourceText
createdAt
updatedAt
```

说明：

- 工作进展用于把上次会议后的推进情况带入下次会议。
- 可以由用户手动补充，也可以来自会后草稿。

### Risk

风险/阻塞。

字段：

```text
id
userId
threadId
sessionId
content
level           low | medium | high
status          active | resolved | dismissed
sourceText
createdAt
updatedAt
```

说明：

- active 风险会进入会前准备。
- resolved 和 dismissed 默认不作为重点带入。

### OpenQuestion

遗留问题。

字段：

```text
id
userId
threadId
sessionId
content
status          open | resolved | dismissed
sourceText
createdAt
updatedAt
```

说明：

- open 状态的问题会进入会前准备。

### CarryInItem

下次带入项。

字段：

```text
id
userId
threadId
sourceSessionId
type            unfinished_action | open_question | decision_context | risk | progress_needed
content
status          active | resolved | dismissed
createdAt
updatedAt
```

说明：

- active 状态会进入会前准备。
- 该表用于保存明确需要下次会议带入的内容。

### DiscussionChain

讨论链路。

字段：

```text
id
userId
threadId
sessionId
topic
facts           JSON 数组
opinions        JSON 数组
disagreements   JSON 数组
decision
openQuestions   JSON 数组
nextActions     JSON 数组
sourceText
createdAt
updatedAt
```

说明：

- 第一版中，`facts`、`opinions`、`disagreements`、`openQuestions`、`nextActions` 可以使用 JSON 字段。
- 讨论链路用于解释“当时为什么这么定”。

### AssistantMessage

助手问答记录。

字段：

```text
id
userId
threadId
sessionId
role            user | assistant
content
sources         JSON，记录引用的待办、决策、会议内容等
createdAt
```

说明：

- 用户提问和助手回答都保存。
- 助手回答应尽量带 sources，方便用户判断依据。

### FollowUpDraft

会后跟进草稿。

字段：

```text
id
userId
threadId
sessionId
content         JSON，保存完整草稿
status          draft | applied
createdAt
updatedAt
```

`content` 结构：

```text
summary
consensus
decisions
actionItems
risks
openQuestions
progressUpdates
carryInItems
warnings
```

说明：

- AI 生成后先保存为草稿。
- 用户确认后，状态改为 `applied`，并拆分保存到正式表。

### Transcription

转写记录。

字段：

```text
id
userId
threadId
sessionId
text
durationSeconds
status          processing | completed | failed
errorMessage
createdAt
updatedAt
```

说明：

- 转写只是会议内容输入方式。
- 转写失败不影响用户手动输入会议内容。

### TranscriptSegment

逐条转写片段。

字段：

```text
id
userId
threadId
sessionId
transcriptionId
speakerText
startedAt
endedAt
text
source          manual | transcription | edited
sequence
createdAt
updatedAt
```

说明：

- 用于支撑实时记录页和会议详情全量记录页。
- `speakerText` 是文本发言人，不绑定系统用户。
- `sequence` 用于稳定排序。
- 用户编辑某条转写后，`source` 可以改为 `edited`。
- 如果用户只手动输入一整段会议内容，系统可以生成一条默认片段。

## 3. 关键关系

```text
User 1 -> N MeetingThread
MeetingThread 1 -> N MeetingSession
MeetingThread 1 -> N ActionItem
MeetingThread 1 -> N Decision
MeetingThread 1 -> N ProgressUpdate
MeetingThread 1 -> N Risk
MeetingThread 1 -> N OpenQuestion
MeetingThread 1 -> N CarryInItem
MeetingSession 1 -> N DiscussionChain
MeetingSession 1 -> N AssistantMessage
MeetingSession 1 -> N FollowUpDraft
MeetingSession 1 -> N Transcription
MeetingSession 1 -> N TranscriptSegment
Transcription 1 -> N TranscriptSegment
```

## 4. 会前准备数据来源

会前准备由以下数据动态生成：

```text
Decision(type=consensus)
Decision(type=decision)
ActionItem(status in pending, in_progress)
ProgressUpdate
Risk(status=active)
OpenQuestion(status=open)
CarryInItem(status=active)
最近一次 finalized MeetingSession
```

创建单次会议时，将当时生成的会前准备保存到 `MeetingSession.carryInSnapshot`。

“会议议题列表”页面中的待办数、风险数和最后更新时间可以由 `MeetingThread` 关联的 `ActionItem`、`Risk`、`OpenQuestion` 和 `MeetingSession.updatedAt` 聚合得到，不需要第一版单独建统计表。

## 5. 会后跟进保存流程

```text
1. 用户输入、粘贴或转写会议内容。
2. 后端保存 `meetingContent`，并保存或生成 `TranscriptSegment`。
3. 前端请求生成会后跟进草稿。
4. 后端调用 AiModule。
5. AI 返回结构化草稿。
6. 后端保存 FollowUpDraft(status=draft)。
7. 前端展示 AI 生成状态和草稿，用户编辑。
8. 用户点击确认。
9. 后端将确认后的草稿拆分保存到正式表。
10. FollowUpDraft.status 改为 applied。
11. MeetingSession.status 改为 finalized。
```

## 6. 索引建议

第一版建议建立以下索引：

```text
User.entryName unique
MeetingThread.userId
MeetingThread.userId + deletedAt
MeetingSession.userId + threadId
ActionItem.userId + threadId + status
ActionItem.userId + status + importance + urgency
Decision.userId + threadId + type
ProgressUpdate.userId + threadId
Risk.userId + threadId + status
OpenQuestion.userId + threadId + status
CarryInItem.userId + threadId + status
AssistantMessage.userId + sessionId
TranscriptSegment.userId + sessionId + sequence
```
