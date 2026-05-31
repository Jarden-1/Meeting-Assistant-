# 转写精修 Worker 契约

## 定位

实时转写仍由 FunASR 或腾讯 ASR 负责。精修 worker 只处理分片音频，返回更稳定的文本、时间戳和局部说话人标签。

API 创建 `TranscriptionEnhancementChunk` 后，如果配置了 `ENHANCEMENT_WORKER_URL`，会后台调用：

```text
POST {ENHANCEMENT_WORKER_URL}/enhance
```

如果未配置 worker，分片保持 `queued`，可以后续由人工脚本或真实 worker 调用结果写入接口。

## 请求

```json
{
  "chunkId": "chunk_001",
  "sessionId": "session_001",
  "chunkIndex": 0,
  "audioStartMs": 0,
  "audioEndMs": 600000,
  "overlapMs": 120000,
  "provider": "moss",
  "audioPath": "/tmp/meeting-assistant-enhancement-audio/session_001/chunk-0.wav",
  "audioBase64": "optional-base64",
  "audioMimeType": "audio/wav"
}
```

说明：

- `audioStartMs` / `audioEndMs` 是相对会议开始的毫秒数。
- worker 可以优先读取 `audioPath`。如果 worker 不和 API 在同一台机器或同一挂载卷内，再使用 `audioBase64`。
- 正式部署建议用共享对象存储或共享卷替代大 JSON body。

## 响应

```json
{
  "provider": "moss-transcribe-diarize",
  "segments": [
    {
      "localSpeaker": "Speaker 1",
      "startMs": 1200,
      "endMs": 6300,
      "text": "我们先确认今天的范围。",
      "confidence": 0.98
    }
  ]
}
```

字段规则：

- `localSpeaker` 是当前分片内的说话人标签，不要求跨分片稳定。
- API 会用重叠区文本相似度把 `localSpeaker` 映射到整场会议的全局 `SessionSpeaker`。
- `startMs` / `endMs` 必须是相对整场会议开始的毫秒数，不是相对分片开头。
- 空文本、缺失时间戳的 segment 会被 API 丢弃。

## API 状态接口

```text
GET /api/v1/sessions/:sessionId/transcriptions/enhancement-status
```

返回 worker 是否已配置，以及当前 session 的分片数量状态。

## 本地 mock worker

本地可以先不下载模型，用 mock worker 验证链路：

```bash
pnpm --filter meeting-assistant-api enhancement:mock-worker
```

然后在 API 环境变量中设置：

```env
ENHANCEMENT_WORKER_URL=http://127.0.0.1:18081
```

mock worker 只返回固定格式的模拟精修结果，不能代表真实模型效果。
