const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:3001/api/v1'
export const FUNASR_WS_URL = (import.meta.env.VITE_FUNASR_WS_URL as string | undefined) ?? 'ws://127.0.0.1:10095'

export type ApiEnvelope<T> = {
  data: T
  requestId: string
}

export type AuthResponse = {
  user: {
    id: string
    displayName: string
    entryName: string
  }
  accessToken: string
}

export type ThreadListItem = {
  id: string
  title: string
  background: string
  summary?: string
  risk?: number
  lastMeetingAt?: string | null
  openActionCount: number
  highRiskCount: number
  openQuestionCount: number
  activeCarryInCount: number
  createdAt: string
  updatedAt: string
}

export type ThreadListResponse = {
  items: ThreadListItem[]
  page: number
  pageSize: number
  total: number
}

export type PreparationResponse = {
  lastConsensus: string[]
  lastDecisions: string[]
  openActionItems: Array<{
    id: string
    description: string
    ownerText: string
    dueDate: string | null
    status: string
    priority: string
    riskLevel: string
    importance: string
    urgency: string
  }>
  progressUpdates: Array<{ id: string; content: string }>
  openQuestions: string[]
  risks: string[]
  carryInItems?: Array<{ id: string; type: string; content: string }>
  suggestedFocus: string[]
  suggestedAgenda: string[]
  manualNotes?: string[]
  warnings?: string[]
}

export type SessionListResponse = {
  items: Array<{
    id: string
    title: string
    status: string
    summary: string
    startedAt?: string | null
    endedAt?: string | null
    createdAt: string
    updatedAt: string
    todoCount: number
  }>
  page: number
  pageSize: number
  total: number
}

export type SessionDetailResponse = {
  id: string
  threadId: string
  title: string
  status: string
  meetingContent: string
  summary: string
  memorySummary: string
  startedAt?: string | null
  endedAt?: string | null
  todoCount?: number
  carryInSnapshot?: unknown
  transcriptSegments: Array<{
    id: string
    speakerText: string
    startedAt?: string | null
    endedAt?: string | null
    text: string
    source: string
    sequence: number
  }>
  createdAt: string
  updatedAt: string
}

export type ReportDraftResponse = {
  id: string
  status: string
  summary?: { title?: string; content?: string }
  memorySummary?: string
  decisions?: Array<Record<string, unknown>>
  actionItems?: Array<Record<string, unknown>>
  risks?: Array<Record<string, unknown>>
  openQuestions?: Array<Record<string, unknown>>
  progressUpdates?: Array<Record<string, unknown>>
  carryInItems?: Array<Record<string, unknown>>
  discussionChains?: Array<Record<string, unknown>>
  warnings?: unknown[]
}

export type LlmSettingsResponse = {
  provider: string
  baseUrlConfigured: boolean
  model: string
  apiKeyConfigured: boolean
  apiKeyVisible: boolean
  custom: {
    provider: string
    baseUrl: string
    model: string
    apiKeyConfigured: boolean
    apiKeyVisible: boolean
    updatedAt?: string
  }
  activeSource: 'system' | 'user'
}

export type AssistantAskResponse = {
  answer: string
  mode: string
  sources: unknown[]
  createdAt: string
}

export type TencentAsrSessionResponse = {
  provider: 'tencent'
  mode: string
  voiceId: string
  sampleRate: number
  websocketUrl: string
  expiresAt: string
  instructions?: Record<string, unknown>
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  token?: string | null
  body?: unknown
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const payload = (await response.json()) as ApiEnvelope<T> | { error?: { message?: string; code?: string } }
  if (!response.ok || !('data' in payload)) {
    const message = 'error' in payload ? payload.error?.message || payload.error?.code || 'Request failed' : 'Request failed'
    throw new Error(message)
  }
  return payload.data
}

export const api = {
  enter(entryName: string) {
    return request<AuthResponse>('/auth/enter', {
      method: 'POST',
      body: { entryName },
    })
  },
  me(token: string) {
    return request<AuthResponse['user']>('/auth/me', { token })
  },
  listThreads(token: string, keyword = '') {
    const search = keyword.trim() ? `?keyword=${encodeURIComponent(keyword.trim())}` : ''
    return request<ThreadListResponse>(`/threads${search}`, { token })
  },
  createThread(token: string, title: string, background: string) {
    return request<{ id: string; title: string; background: string }>(`/threads`, {
      method: 'POST',
      token,
      body: { title, background },
    })
  },
  deleteThread(token: string, threadId: string) {
    return request<{ deleted: boolean }>(`/threads/${threadId}`, {
      method: 'DELETE',
      token,
    })
  },
  getPreparation(token: string, threadId: string) {
    return request<PreparationResponse>(`/threads/${threadId}/preparation`, { token })
  },
  listThreadSessions(token: string, threadId: string) {
    return request<SessionListResponse>(`/threads/${threadId}/sessions`, { token })
  },
  getThreadActionItems(token: string, threadId: string) {
    return request<{ items: Array<Record<string, unknown>> }>(`/threads/${threadId}/action-items`, { token })
  },
  updateActionItem(token: string, actionItemId: string, body: Record<string, unknown>) {
    return request<Record<string, unknown>>(`/action-items/${actionItemId}`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  createSession(token: string, threadId: string, title: string, preparationSnapshot?: unknown) {
    return request<SessionDetailResponse>(`/threads/${threadId}/sessions`, {
      method: 'POST',
      token,
      body: { title, preparationSnapshot },
    })
  },
  getSession(token: string, sessionId: string) {
    return request<SessionDetailResponse>(`/sessions/${sessionId}`, { token })
  },
  deleteSession(token: string, sessionId: string) {
    return request<{ deleted: boolean }>(`/sessions/${sessionId}`, {
      method: 'DELETE',
      token,
    })
  },
  moveSession(token: string, sessionId: string, threadId: string) {
    return request<SessionDetailResponse>(`/sessions/${sessionId}/thread`, {
      method: 'PATCH',
      token,
      body: { threadId },
    })
  },
  updateTranscriptSegment(
    token: string,
    segmentId: string,
    body: { speakerText?: string; text?: string },
  ) {
    return request<{ items: SessionDetailResponse['transcriptSegments'] }>(`/transcript-segments/${segmentId}`, {
      method: 'PATCH',
      token,
      body,
    })
  },
  createTranscription(
    token: string,
    sessionId: string,
    body: {
      text?: string
      durationSeconds?: number
      provider?: string
      mode?: string
      segments?: Array<{
        speakerText?: string
        text: string
        startedAt?: string
        endedAt?: string
        sequence?: number
        confidence?: number
      }>
    },
  ) {
    return request<{ id: string; sessionId: string; text: string; segments: SessionDetailResponse['transcriptSegments']; status: string }>(
      `/sessions/${sessionId}/transcriptions`,
      {
        method: 'POST',
        token,
        body,
      },
    )
  },
  createTencentSession(token: string, sessionId: string, body: { mode?: string; sampleRate?: number; hotwordList?: string[] } = {}) {
    return request<TencentAsrSessionResponse>(`/sessions/${sessionId}/transcriptions/tencent-session`, {
      method: 'POST',
      token,
      body,
    })
  },
  persistTencentResult(token: string, sessionId: string, body: { payload: unknown; voiceId?: string; mode?: string }) {
    return request<{ accepted: boolean; created: number; updated: number; ignored: boolean }>(
      `/sessions/${sessionId}/transcriptions/tencent-result`,
      {
        method: 'POST',
        token,
        body,
      },
    )
  },
  askAssistant(token: string, sessionId: string, question: string) {
    return request<AssistantAskResponse>(`/sessions/${sessionId}/assistant/ask`, {
      method: 'POST',
      token,
      body: { question, inputMode: 'text' },
    })
  },
  generateReportDraft(token: string, sessionId: string, meetingContent?: string) {
    return request<ReportDraftResponse>(`/sessions/${sessionId}/follow-up-draft`, {
      method: 'POST',
      token,
      body: { meetingContent },
    })
  },
  getReportDraft(token: string, sessionId: string) {
    return request<ReportDraftResponse>(`/sessions/${sessionId}/follow-up-draft`, { token })
  },
  getMyTodos(token: string) {
    return request<{ matrix: Record<string, Array<Record<string, unknown>>> }>('/action-items/mine?view=matrix&status=pending,in_progress', {
      token,
    })
  },
  getSettings(token: string) {
    return request<LlmSettingsResponse>('/settings/llm', { token })
  },
  testSettings(token: string) {
    return request<{ ok: boolean; model: string; latencyMs: number; source?: string; message?: string }>('/settings/llm/test', {
      method: 'POST',
      token,
    })
  },
  saveCustomSettings(
    token: string,
    body: { provider: string; baseUrl: string; model: string; apiKey: string },
  ) {
    return request<{ provider: string; baseUrl: string; model: string; apiKeyConfigured: boolean }>('/settings/llm/custom', {
      method: 'PUT',
      token,
      body,
    })
  },
}
