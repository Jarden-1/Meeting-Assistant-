# Meeting Assistant API

NestJS + Prisma backend for the meeting assistant.

## Run

```bash
npm install
cp .env.example .env
npm run db:setup
npm run dev
```

The API listens on `PORT` or `3001` by default and uses the global prefix:

```text
/api/v1
```

## Environment

Required for database-backed runtime:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/meeting_assistant?schema=public"
JWT_SECRET="change-me"
```

Optional LLM defaults:

```env
LLM_BASE_URL="https://api.2006038.xyz/v1"
LLM_MODEL="gpt-5.5"
LLM_API_KEY=""
USER_LLM_ENCRYPTION_KEY="replace-with-a-long-secret"
```

Optional Tencent ASR placeholders:

```env
TENCENT_ASR_APP_ID=""
TENCENT_ASR_SECRET_ID=""
TENCENT_ASR_SECRET_KEY=""
TENCENT_ASR_MODE="realtime"
```

## Implemented API Surface

- `POST /api/v1/auth/enter`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET/POST /api/v1/threads`
- `GET/PATCH/DELETE /api/v1/threads/:threadId`
- `GET /api/v1/threads/:threadId/preparation`
- `POST /api/v1/threads/:threadId/sessions`
- `GET /api/v1/threads/:threadId/sessions`
- `GET/PATCH /api/v1/sessions/:sessionId`
- `POST /api/v1/sessions/:sessionId/assistant/ask`
- `GET /api/v1/sessions/:sessionId/assistant/messages`
- `POST /api/v1/sessions/:sessionId/discussion-chains/extract`
- `GET /api/v1/sessions/:sessionId/discussion-chains`
- `POST /api/v1/sessions/:sessionId/report-draft`
- `GET /api/v1/sessions/:sessionId/report-draft`
- `POST /api/v1/sessions/:sessionId/finalize`
- `POST /api/v1/sessions/:sessionId/transcriptions`
- `POST /api/v1/sessions/:sessionId/transcriptions/tencent-session`
- `POST /api/v1/sessions/:sessionId/transcriptions/tencent-result`
- `GET /api/v1/sessions/:sessionId/transcript-segments`
- `PATCH /api/v1/transcript-segments/:segmentId`
- `GET /api/v1/action-items/mine`
- `PATCH /api/v1/action-items/:actionItemId`
- `GET /api/v1/settings/llm`
- `PUT /api/v1/settings/llm/custom`
- `POST /api/v1/settings/llm/test`
- `GET /api/v1/health`

If no LLM is configured, AI endpoints return safe fallback content so the frontend can still exercise the main workflow.

## Error Format

All API errors are normalized to:

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

## Tencent ASR Flow

1. Frontend calls `POST /api/v1/sessions/:sessionId/transcriptions/tencent-session`.
2. Backend returns a signed Tencent WebSocket URL.
3. Frontend opens the Tencent socket directly and streams audio.
4. Frontend forwards Tencent recognition events to `POST /api/v1/sessions/:sessionId/transcriptions/tencent-result`.
5. Backend normalizes and upserts transcript segments, then rebuilds `meetingContent`.
