# API 规范 v0.1

## 1. 基础规则

### 接口风格

使用 REST API。

```text
Base Path: /api/v1
Content-Type: application/json
字段命名: camelCase
时间格式: ISO 8601
```

除 `POST /api/v1/auth/enter` 外，其他接口默认都需要 token。

### 鉴权方式

```http
Authorization: Bearer <token>
```

前端不传 `userId`。后端从 token 中解析当前用户，并用当前用户做数据归属校验。

### 成功响应

```json
{
  "data": {},
  "requestId": "req_xxx"
}
```

### 列表响应

```json
{
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 0
  },
  "requestId": "req_xxx"
}
```

### 错误响应

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数错误",
    "details": {}
  },
  "requestId": "req_xxx"
}
```

### 常见错误码

```text
UNAUTHORIZED
FORBIDDEN
VALIDATION_ERROR
NOT_FOUND
THREAD_NOT_FOUND
SESSION_NOT_FOUND
ACTION_ITEM_NOT_FOUND
AI_FAILED
TRANSCRIPTION_FAILED
RATE_LIMITED
INTERNAL_ERROR
```

说明：

- 前端页面中的“会议议题”对应 API 中的 `threads`。
- 前端页面中的“会议详情(全量记录)”主要读取 `transcriptSegments`。
- 前端设置页只能读取脱敏配置状态，不能读取或提交模型 API Key。

## 2. 权限规则

第一版虽然是演示账号壳子，但数据隔离必须成立。

规则：

1. 所有业务数据都绑定 `userId`。
2. 创建业务数据时，`userId` 由后端从 token 中获取。
3. 查询、更新、删除资源时，必须校验资源归属当前用户。
4. 前端提交的 `userId` 一律不可信。

示例：

```text
查询会议线程:
where id = threadId and userId = currentUser.id and deletedAt is null

查询单次会议:
where id = sessionId and userId = currentUser.id
```

## 3. Auth 账号壳子

### 进入系统

```http
POST /api/v1/auth/enter
```

请求：

```json
{
  "entryName": "张三"
}
```

行为：

```text
如果 entryName 不存在，自动创建用户。
如果 entryName 已存在，直接进入该用户。
返回用户信息和 token。
```

响应：

```json
{
  "data": {
    "user": {
      "id": "user_001",
      "displayName": "张三",
      "entryName": "张三"
    },
    "accessToken": "token_xxx"
  },
  "requestId": "req_xxx"
}
```

### 当前用户

```http
GET /api/v1/auth/me
```

响应：

```json
{
  "data": {
    "id": "user_001",
    "displayName": "张三",
    "entryName": "张三"
  },
  "requestId": "req_xxx"
}
```

### 退出

```http
POST /api/v1/auth/logout
```

第一版退出可以只由前端清除 token。后端可返回成功响应。

## 4. Threads 会议线程

### 获取会议线程列表

```http
GET /api/v1/threads?page=1&pageSize=20&keyword=产品
```

响应：

```json
{
  "data": {
    "items": [
      {
        "id": "thread_001",
        "title": "产品迭代同步",
        "background": "围绕 5 月版本迭代的连续会议",
        "lastMeetingAt": "2026-05-15T10:30:00.000Z",
        "openActionCount": 3,
        "highRiskCount": 1,
        "openQuestionCount": 2,
        "activeCarryInCount": 2,
        "createdAt": "2026-05-10T10:00:00.000Z",
        "updatedAt": "2026-05-15T11:00:00.000Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1
  },
  "requestId": "req_xxx"
}
```

### 创建会议线程

```http
POST /api/v1/threads
```

请求：

```json
{
  "title": "产品迭代同步",
  "background": "围绕 5 月版本迭代的连续会议"
}
```

### 获取会议线程详情

```http
GET /api/v1/threads/:threadId
```

响应：

```json
{
  "data": {
    "id": "thread_001",
    "title": "产品迭代同步",
    "background": "围绕 5 月版本迭代的连续会议",
    "stats": {
      "sessionCount": 5,
      "openActionCount": 3,
      "highRiskCount": 1,
      "openQuestionCount": 2,
      "decisionCount": 8,
      "activeCarryInCount": 2
    },
    "createdAt": "2026-05-10T10:00:00.000Z",
    "updatedAt": "2026-05-15T11:00:00.000Z"
  },
  "requestId": "req_xxx"
}
```

### 更新会议线程

```http
PATCH /api/v1/threads/:threadId
```

请求：

```json
{
  "title": "产品迭代同步",
  "background": "更新后的背景"
}
```

### 删除会议线程

```http
DELETE /api/v1/threads/:threadId
```

行为：

```text
软删除，设置 deletedAt。
普通列表和详情不再返回该线程。
前端必须做二次确认。
```

响应：

```json
{
  "data": {
    "deleted": true
  },
  "requestId": "req_xxx"
}
```

## 5. Preparation 会前准备

### 获取会前准备卡

```http
GET /api/v1/threads/:threadId/preparation
```

说明：

打开会议线程时动态生成最新会前准备。

响应：

```json
{
  "data": {
    "lastConsensus": [
      "上次确认基础版先上线"
    ],
    "lastDecisions": [
      "支付能力下周继续评估"
    ],
    "openActionItems": [
      {
        "id": "action_001",
        "description": "张三周五前给接口方案",
        "ownerText": "张三",
        "dueDate": "2026-05-17",
        "status": "pending",
        "priority": "high",
        "riskLevel": "at_risk",
        "importance": "high",
        "urgency": "high"
      }
    ],
    "progressUpdates": [
      {
        "id": "progress_001",
        "content": "接口方案已完成初稿，待评审"
      }
    ],
    "openQuestions": [
      "支付能力是否进入下周版本"
    ],
    "risks": [
      "支付能力未定可能影响上线范围"
    ],
    "suggestedFocus": [
      "确认接口方案是否可进入开发",
      "确认支付能力排期"
    ],
    "suggestedAgenda": [
      "同步上次待办进展",
      "确认本次关键决策",
      "补充新待办和负责人"
    ]
  },
  "requestId": "req_xxx"
}
```

### 刷新会前建议

```http
POST /api/v1/threads/:threadId/preparation/refresh
```

说明：

重新生成 `suggestedFocus` 和 `suggestedAgenda`。后端可调用大模型，也可在失败时基于规则兜底。

## 6. Sessions 单次会议

### 创建单次会议

```http
POST /api/v1/threads/:threadId/sessions
```

请求：

```json
{
  "title": "5 月 15 日产品同步会"
}
```

响应：

```json
{
  "data": {
    "id": "session_001",
    "threadId": "thread_001",
    "title": "5 月 15 日产品同步会",
    "status": "preparing",
    "carryInSnapshot": {
      "lastConsensus": [],
      "lastDecisions": [],
      "openActionItems": [],
      "progressUpdates": [],
      "openQuestions": [],
      "risks": [],
      "suggestedFocus": [],
      "suggestedAgenda": []
    },
    "createdAt": "2026-05-15T10:00:00.000Z"
  },
  "requestId": "req_xxx"
}
```

创建会议时，后端需要保存当时的会前准备快照到 `carryInSnapshot`。

### 获取会议列表

```http
GET /api/v1/threads/:threadId/sessions?page=1&pageSize=20
```

### 获取单次会议详情

```http
GET /api/v1/sessions/:sessionId
```

响应：

```json
{
  "data": {
    "id": "session_001",
    "threadId": "thread_001",
    "title": "5 月 15 日产品同步会",
    "status": "in_meeting",
    "meetingContent": "这里是用户输入、粘贴或转写后的会议内容",
    "summary": "",
    "carryInSnapshot": {},
    "transcriptSegments": [
      {
        "id": "segment_001",
        "speakerText": "李明",
        "startedAt": "2026-05-15T10:00:15.000Z",
        "endedAt": "2026-05-15T10:01:10.000Z",
        "text": "大家下午好，今天我们主要讨论产品路线图。",
        "source": "transcription",
        "sequence": 1
      }
    ],
    "createdAt": "2026-05-15T10:00:00.000Z",
    "updatedAt": "2026-05-15T10:30:00.000Z"
  },
  "requestId": "req_xxx"
}
```

### 更新单次会议

```http
PATCH /api/v1/sessions/:sessionId
```

请求：

```json
{
  "title": "5 月 15 日产品同步会",
  "meetingContent": "这里是用户输入、粘贴或转写后的会议内容",
  "transcriptSegments": [
    {
      "speakerText": "李明",
      "startedAt": "2026-05-15T10:00:15.000Z",
      "text": "大家下午好，今天我们主要讨论产品路线图。",
      "sequence": 1
    }
  ],
  "status": "in_meeting"
}
```

说明：

- `meetingContent` 和 `transcriptSegments` 都是可选字段。
- 如果只提交 `meetingContent`，后端可以生成一个默认转写片段。
- 如果提交 `transcriptSegments`，后端需要重新拼接或更新 `meetingContent`，供 AI 任务使用。

### 获取会议转写片段

```http
GET /api/v1/sessions/:sessionId/transcript-segments?keyword=预算
```

响应：

```json
{
  "data": {
    "items": [
      {
        "id": "segment_001",
        "speakerText": "李明",
        "startedAt": "2026-05-15T10:00:15.000Z",
        "endedAt": "2026-05-15T10:01:10.000Z",
        "text": "大家下午好，今天我们主要讨论产品路线图。",
        "source": "transcription",
        "sequence": 1
      }
    ]
  },
  "requestId": "req_xxx"
}
```

### 更新会议转写片段

```http
PATCH /api/v1/transcript-segments/:segmentId
```

请求：

```json
{
  "speakerText": "李明",
  "text": "大家下午好，今天我们主要讨论 Q3 产品路线图。"
}
```

说明：

- 更新单条片段时必须校验该片段所属会议和当前用户一致。
- 更新后后端应同步更新会议的 `meetingContent` 或标记其需要重新拼接。

### 确认正式会议记录

```http
POST /api/v1/sessions/:sessionId/finalize
```

请求：

```json
{
  "summary": "本次会议确认基础版本周上线。",
  "consensus": [],
  "decisions": [],
  "actionItems": [
    {
      "description": "张三周五前给接口方案",
      "ownerText": "张三",
      "dueDate": "2026-05-17",
      "status": "pending",
      "priority": "high",
      "riskLevel": "at_risk",
      "importance": "high",
      "urgency": "high"
    }
  ],
  "risks": [],
  "openQuestions": [],
  "progressUpdates": [],
  "carryInItems": []
}
```

行为：

```text
用户确认后，将草稿拆分保存为正式数据。
会议状态改为 finalized。
finalized 后仍允许再次编辑和保存。
第一版不做版本历史。
```

## 7. Assistant 会中助手

### 向助手提问

```http
POST /api/v1/sessions/:sessionId/assistant/ask
```

请求：

```json
{
  "question": "上次这个事项是谁负责？",
  "inputMode": "text"
}
```

`inputMode`：

```text
text
voice
```

第一版建议前端把语音输入先转成文字，再调用该接口。

响应：

```json
{
  "data": {
    "answer": "根据上次会议记录，这个事项由张三负责，截止时间是周五。",
    "sources": [
      {
        "type": "actionItem",
        "id": "action_001",
        "label": "张三周五前给接口方案"
      }
    ],
    "createdAt": "2026-05-15T10:30:00.000Z"
  },
  "requestId": "req_xxx"
}
```

### 获取助手消息记录

```http
GET /api/v1/sessions/:sessionId/assistant/messages
```

## 8. Discussion 讨论链路

### 抽取讨论链路

```http
POST /api/v1/sessions/:sessionId/discussion-chains/extract
```

请求：

```json
{
  "meetingContent": "这里是会议内容。为空时后端使用 session.meetingContent。"
}
```

响应：

```json
{
  "data": {
    "discussionChains": [
      {
        "topic": "是否本周上线基础版",
        "facts": ["客户希望尽快试用"],
        "opinions": ["先上线基础版", "支付能力未完成会影响体验"],
        "disagreements": ["是否允许不带支付能力上线"],
        "decision": "本周先上线基础版，支付下周评估",
        "openQuestions": [],
        "nextActions": ["张三周五前给接口方案"]
      }
    ],
    "warnings": []
  },
  "requestId": "req_xxx"
}
```

### 获取讨论链路

```http
GET /api/v1/sessions/:sessionId/discussion-chains
```

## 9. Follow-ups 会后跟进

### 生成会后跟进草稿

```http
POST /api/v1/sessions/:sessionId/follow-up-draft
```

请求：

```json
{
  "meetingContent": "这里是会议内容，可以来自手动输入、粘贴或转写结果"
}
```

响应：

```json
{
  "data": {
    "summary": "本次会议确认基础版本周上线。",
    "consensus": [],
    "decisions": [],
    "actionItems": [],
    "risks": [],
    "openQuestions": [],
    "progressUpdates": [],
    "carryInItems": [],
    "warnings": []
  },
  "requestId": "req_xxx"
}
```

该结果是草稿，不能直接作为正式记录。用户确认后调用 `finalize`。

### 获取会后跟进草稿

```http
GET /api/v1/sessions/:sessionId/follow-up-draft
```

### 获取会后跟进生成状态

```http
GET /api/v1/sessions/:sessionId/follow-up-draft/progress
```

响应：

```json
{
  "data": {
    "status": "running",
    "stage": "extracting_action_items",
    "progress": 65,
    "message": "正在整理待办事项"
  },
  "requestId": "req_xxx"
}
```

`status`：

```text
idle
running
completed
failed
```

说明：

- 用于 AI 生成状态页。
- 第一版也可以不做后台任务，前端在 `POST /follow-up-draft` 请求期间展示本地 loading 状态。
- 如果实现该接口，状态只能表示草稿生成过程，不代表正式会议记录已经保存。

### 获取线程待办

```http
GET /api/v1/threads/:threadId/action-items
```

查询参数：

```text
status=pending,in_progress
priority=high
riskLevel=at_risk
```

### 获取我的待办

```http
GET /api/v1/action-items/mine?view=matrix&status=pending,in_progress
```

说明：

用于“我的待办”页面，返回当前账号下跨会议线程聚合的待办。`view=matrix` 时后端可按 `importance` 和 `urgency` 分组。

响应：

```json
{
  "data": {
    "matrix": {
      "importantUrgent": [],
      "importantNotUrgent": [],
      "notImportantUrgent": [],
      "notImportantNotUrgent": []
    }
  },
  "requestId": "req_xxx"
}
```

### 更新待办

```http
PATCH /api/v1/action-items/:actionItemId
```

请求：

```json
{
  "description": "张三周五前给接口方案",
  "ownerText": "张三",
  "dueDate": "2026-05-17",
  "status": "in_progress",
  "priority": "high",
  "riskLevel": "at_risk",
  "importance": "high",
  "urgency": "high"
}
```

### 获取工作进展

```http
GET /api/v1/threads/:threadId/progress-updates
```

### 新增工作进展

```http
POST /api/v1/threads/:threadId/progress-updates
```

请求：

```json
{
  "content": "接口方案已完成初稿，待评审"
}
```

## 10. Transcription 转写

### 上传录音并转写

```http
POST /api/v1/sessions/:sessionId/transcriptions
```

请求格式：

```text
multipart/form-data
file: audio.webm
```

响应：

```json
{
  "data": {
    "id": "transcription_001",
    "sessionId": "session_001",
    "text": "这里是转写后的会议内容",
    "segments": [
      {
        "id": "segment_001",
        "speakerText": "说话人 1",
        "startedAt": "2026-05-15T10:00:15.000Z",
        "endedAt": "2026-05-15T10:01:10.000Z",
        "text": "这里是一条转写片段",
        "source": "transcription",
        "sequence": 1
      }
    ],
    "durationSeconds": 120,
    "status": "completed"
  },
  "requestId": "req_xxx"
}
```

失败时返回：

```json
{
  "error": {
    "code": "TRANSCRIPTION_FAILED",
    "message": "录音转写失败，请手动输入或重新上传音频",
    "details": {
      "reason": "provider_timeout"
    }
  },
  "requestId": "req_xxx"
}
```

转写失败不阻断会议流程。

## 11. Settings 设置

### 获取模型服务状态

```http
GET /api/v1/settings/llm
```

响应：

```json
{
  "data": {
    "provider": "openai-compatible",
    "baseUrlConfigured": true,
    "model": "gpt-5.5",
    "apiKeyConfigured": true,
    "apiKeyVisible": false
  },
  "requestId": "req_xxx"
}
```

说明：

- 不返回 `LLM_API_KEY` 明文、掩码或可还原内容。
- `apiKeyConfigured` 只表示部署环境中是否存在配置。

### 测试模型服务连接

```http
POST /api/v1/settings/llm/test
```

响应：

```json
{
  "data": {
    "ok": true,
    "model": "gpt-5.5",
    "latencyMs": 820
  },
  "requestId": "req_xxx"
}
```

连接测试由后端发起，前端不提交 API Key。
