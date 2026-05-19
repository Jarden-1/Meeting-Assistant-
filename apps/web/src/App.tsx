import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  Edit3,
  Filter,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  MessageSquareText,
  Mic,
  MoreHorizontal,
  PauseCircle,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  StopCircle,
  Target,
  Trash2,
  X,
} from 'lucide-react'
import {
  FUNASR_WS_URL,
  api,
  type LlmSettingsResponse,
  type PreparationResponse,
  type ReportDraftResponse,
  type SessionDetailResponse,
  type ThreadListItem,
} from './api'
import './App.css'

type Page =
  | 'login'
  | 'threads'
  | 'briefing'
  | 'thread-todos'
  | 'live'
  | 'ai-progress'
  | 'overview'
  | 'transcript'
  | 'meeting-todos'
  | 'my-todos'
  | 'settings'

type ModalKind = 'new-thread' | 'new-meeting' | 'notifications' | 'help' | 'export' | null
type DrawerKind = 'briefing' | 'todo' | 'filters' | 'meeting' | 'transcript' | null
type Priority = 'P0' | 'P1' | 'P2' | 'P3'
type TodoStatus = 'pending' | 'in_progress' | 'done' | 'canceled'
type ViewMode = 'matrix' | 'list'

type ActionItem = {
  id: string
  title: string
  owner: string
  due: string
  priority: Priority
  status: TodoStatus
  importance: 'high' | 'low'
  urgency: 'high' | 'low'
  threadId: string
  meetingId: string
  risk: 'normal' | 'at_risk' | 'high_risk'
}

type Thread = {
  id: string
  title: string
  summary: string
  risk: number
  updatedAt: string
  members: string[]
}

type MeetingRecord = {
  id: string
  title: string
  date: string
  time: string
  sortAt: string
  participants: string
  todoCount: number
}

type TranscriptItem = {
  id: string
  speaker: string
  role: string
  time: string
  text: string
}

type RecordingState = 'idle' | 'recording' | 'paused'

type BrowserSpeechRecognitionAlternative = {
  transcript: string
  confidence: number
}

type BrowserSpeechRecognitionResult = {
  isFinal: boolean
  length: number
  0?: BrowserSpeechRecognitionAlternative
}

type BrowserSpeechRecognitionEvent = {
  resultIndex: number
  results: {
    length: number
    [index: number]: BrowserSpeechRecognitionResult
  }
}

type BrowserSpeechRecognitionErrorEvent = {
  error: string
}

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type SpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }

type FunAsrMessage = {
  mode?: string
  text?: string
  wav_name?: string
  is_final?: boolean
  timestamp?: string
}

type SettingsState = {
  system: {
    provider: string
    baseUrlConfigured: boolean
    model: string
    apiKeyConfigured: boolean
  }
  custom: {
    provider: string
    baseUrl: string
    model: string
    apiKeyConfigured: boolean
  }
  activeSource: 'system' | 'user'
}

const AUTH_TOKEN_KEY = 'meeting-assistant.access-token'
const STANDALONE_THREAD_TITLE = '未归档会议'
const STANDALONE_THREAD_BACKGROUND = '__standalone_meetings__'
const NEW_THREAD_OPTION = '__new_thread__'

const initialThreads: Thread[] = [
  {
    id: 'thread-q1',
    title: '2024Q1 战略执行与部门协同议题',
    summary: '围绕技术底座升级、市场推广联动和跨部门资源倾斜的连续会议。',
    risk: 3,
    updatedAt: '2026-05-15 10:30',
    members: ['张', '李', '王', '+2'],
  },
  {
    id: 'thread-supply',
    title: '供应链数字化转型第二阶段汇报',
    summary: '追踪交付周期、私有云部署和客户侧验收节奏。',
    risk: 5,
    updatedAt: '2026-05-14 16:20',
    members: ['赵', '陈', '+1'],
  },
  {
    id: 'thread-product',
    title: 'Q3 产品战略规划与季度目标对齐',
    summary: '聚焦用户体验升级、商业化提速和数据驱动决策。',
    risk: 2,
    updatedAt: '2026-05-13 09:10',
    members: ['张', '李', '王', '+4'],
  },
  {
    id: 'thread-api',
    title: '新 API 集成方案评审',
    summary: '确认接口边界、认证策略和上线前风险清单。',
    risk: 1,
    updatedAt: '2026-05-12 15:45',
    members: ['刘', '周'],
  },
]

const meetings: MeetingRecord[] = [
  {
    id: 'meeting-budget',
    title: '11 月 20 日 Q1 预算审查会议',
    date: '2026-05-17',
    time: '14:00 - 16:00',
    sortAt: '2026-05-17T14:00:00',
    participants: '张三、李四、王五、赵六等 8 人',
    todoCount: 5,
  },
  {
    id: 'meeting-weekly',
    title: '11 月 13 日 周度同步例会',
    date: '2026-05-10',
    time: '10:00 - 11:00',
    sortAt: '2026-05-10T10:00:00',
    participants: '张三、李四、王五等 6 人',
    todoCount: 3,
  },
]

const initialTodos: ActionItem[] = [
  {
    id: 'a1',
    title: '完成 Q4 市场预算分配并提交审核',
    owner: 'Sarah Jenkins',
    due: '2026-05-20',
    priority: 'P0',
    status: 'pending',
    importance: 'high',
    urgency: 'high',
    threadId: 'thread-q1',
    meetingId: 'meeting-budget',
    risk: 'high_risk',
  },
  {
    id: 'a2',
    title: '起草新 API 集成的技术规范',
    owner: 'Michael Klein',
    due: '2026-05-22',
    priority: 'P1',
    status: 'in_progress',
    importance: 'high',
    urgency: 'low',
    threadId: 'thread-q1',
    meetingId: 'meeting-budget',
    risk: 'at_risk',
  },
  {
    id: 'a3',
    title: '安排与设计团队同步，审查原型 V2',
    owner: 'David Chen',
    due: '2026-05-19',
    priority: 'P2',
    status: 'pending',
    importance: 'low',
    urgency: 'high',
    threadId: 'thread-q1',
    meetingId: 'meeting-budget',
    risk: 'normal',
  },
  {
    id: 'a4',
    title: '使用最新指标更新客户演示文稿',
    owner: 'Anna Lee',
    due: '2026-05-18',
    priority: 'P3',
    status: 'done',
    importance: 'low',
    urgency: 'low',
    threadId: 'thread-product',
    meetingId: 'meeting-weekly',
    risk: 'normal',
  },
  {
    id: 'a5',
    title: '法务合规部门确认新产品复审结果',
    owner: '王伟',
    due: '2026-05-21',
    priority: 'P0',
    status: 'pending',
    importance: 'high',
    urgency: 'high',
    threadId: 'thread-q1',
    meetingId: 'meeting-budget',
    risk: 'high_risk',
  },
  {
    id: 'a6',
    title: '跨部门资源协调会议安排',
    owner: '助理小张',
    due: '2026-05-24',
    priority: 'P2',
    status: 'pending',
    importance: 'low',
    urgency: 'high',
    threadId: 'thread-q1',
    meetingId: 'meeting-weekly',
    risk: 'at_risk',
  },
]

const initialTranscript: TranscriptItem[] = [
  {
    id: 't1',
    speaker: '张建国',
    role: '业务负责人',
    time: '10:05:12',
    text: '大家都到齐了吧？我们现在开始。今天主要对齐一下第一季度的战略执行情况，特别是研发和市场部门的协同问题。',
  },
  {
    id: 't2',
    speaker: '李华',
    role: '研发负责人',
    time: '10:07:30',
    text: '研发这边的主要瓶颈在需求文档确认环节。市场部那边给出的需求经常变动，导致我们的迭代计划总是被打乱。',
  },
  {
    id: 't3',
    speaker: '王芳',
    role: '市场负责人',
    time: '10:09:15',
    text: '市场环境变化太快，有些变动是客户临时要求。不过流程确实需要优化，我建议设立每周一次的需求评审会。',
  },
  {
    id: 't4',
    speaker: '张建国',
    role: '业务负责人',
    time: '10:12:08',
    text: '很好，那就这么定下来。王芳牵头把需求评审机制初稿整理出来，周三前发给大家。',
  },
]

const initialBriefing = {
  focus: '技术底座迁移已完成 85%，但市场推广预算审批仍可能影响上线范围。本次会议应先确认阻塞，再补齐负责人。',
  agenda: ['同步上次待办进展 (10 min)', '技术底座迁移验收 (15 min)', '市场推广预算审批决策 (10 min)', '补充新待办和负责人 (5 min)'],
  consensus: ['完成了 12 个跨部门接口的定义与签署', '确定了 Q1 财报披露的基准数据口径'],
  decisions: ['市场推广预算延期至下周审批，不进入本周排期', '基础服务上线时间定为本周五'],
  questions: ['供应链交付周期延长 15% 的应对方案', '法务合规部门对新产品的复审尚未通过'],
}

const projectRows = [
  ['AI 辅助写作功能上线', '完成内部 Beta 测试并修复 P0 Bug', '2026-05-22', '张三', 'P1'],
  ['新商业模式财务合规审批', '提交完整方案至法务及财务部审核', '2026-05-21', '李四', 'P0'],
  ['行业峰会物料制作', '完成展台设计定稿及印刷物发包', '2026-05-26', '王五', 'P2'],
  ['用户体验反馈收集', '回收 1000 份有效样本', '2026-05-20', '赵六', 'P1'],
]

const priorityTone: Record<Priority, string> = { P0: 'p0', P1: 'p1', P2: 'p2', P3: 'p3' }

function App() {
  const [page, setPage] = useState<Page>('login')
  const [userName, setUserName] = useState('张经理')
  const [authToken, setAuthToken] = useState<string | null>(() => window.localStorage.getItem(AUTH_TOKEN_KEY))
  const [threads, setThreads] = useState(initialThreads)
  const [todos, setTodos] = useState(initialTodos)
  const [transcript, setTranscript] = useState(initialTranscript)
  const [briefing, setBriefing] = useState(initialBriefing)
  const [selectedThreadId, setSelectedThreadId] = useState('')
  const [threadMeetings, setThreadMeetings] = useState(() => sortMeetings(meetings))
  const [threadMeetingsByThread, setThreadMeetingsByThread] = useState<Record<string, MeetingRecord[]>>(() => ({
    [initialThreads[0].id]: sortMeetings(meetings),
  }))
  const [expandedThreadIds, setExpandedThreadIds] = useState<string[]>([initialThreads[0].id])
  const [standaloneMeetings, setStandaloneMeetings] = useState<MeetingRecord[]>([])
  const [selectedMeeting, setSelectedMeeting] = useState(meetings[0])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedSessionThreadId, setSelectedSessionThreadId] = useState<string | null>(null)
  const [reportDraft, setReportDraft] = useState<ReportDraftResponse | null>(null)
  const [settingsState, setSettingsState] = useState<SettingsState | null>(null)
  const [modal, setModal] = useState<ModalKind>(null)
  const [meetingDraftThreadId, setMeetingDraftThreadId] = useState('')
  const [drawer, setDrawer] = useState<DrawerKind>(null)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [editingTranscriptId, setEditingTranscriptId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [todoView, setTodoView] = useState<ViewMode>('matrix')
  const [filters, setFilters] = useState({ status: 'all', priority: 'all' })

  const visibleThreads = threads.filter((thread) => !isStandaloneThread(thread))
  const activeThread = visibleThreads.find((thread) => thread.id === selectedThreadId) ?? visibleThreads[0] ?? threads[0]
  const filteredTodos = todos.filter((todo) => matchesTodoFilters(todo, filters))
  const threadTodos = filteredTodos.filter((todo) => todo.threadId === activeThread.id)
  const meetingTodos = filteredTodos.filter((todo) => todo.meetingId === selectedMeeting.id)

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2200)
  }

  const openTodoDrawer = (id?: string) => {
    setEditingTodoId(id ?? null)
    setDrawer('todo')
  }

  const openMeetingModal = (threadId = '') => {
    setMeetingDraftThreadId(threadId)
    setModal('new-meeting')
  }

  const toggleThreadExpanded = (threadId: string) => {
    setExpandedThreadIds((items) =>
      items.includes(threadId) ? items.filter((item) => item !== threadId) : [...items, threadId],
    )
  }

  const toggleTodo = (id: string) => {
    setTodos((items) =>
      items.map((item) =>
        item.id === id ? { ...item, status: item.status === 'done' ? 'pending' : 'done' } : item,
      ),
    )
    const item = todos.find((todo) => todo.id === id)
    if (authToken && item) {
      const nextStatus = item.status === 'done' ? 'pending' : 'done'
      void api.updateActionItem(authToken, id, { status: nextStatus }).catch(() => {
        notify('待办状态同步失败，已保留本地修改')
      })
    }
  }

  const saveTodo = (todo: ActionItem) => {
    setTodos((items) => {
      const exists = items.some((item) => item.id === todo.id)
      return exists ? items.map((item) => (item.id === todo.id ? todo : item)) : [todo, ...items]
    })
    setDrawer(null)
    notify('待办已保存')
    if (authToken) {
      void api
        .updateActionItem(authToken, todo.id, {
          description: todo.title,
          ownerText: todo.owner,
          dueDate: todo.due,
          status: todo.status,
          priority: todo.priority.toLowerCase(),
          riskLevel: todo.risk,
          importance: todo.importance,
          urgency: todo.urgency,
        })
        .catch(() => undefined)
    }
  }

  const saveThread = async (title: string, summary: string) => {
    if (!authToken) return
    try {
      const created = await api.createThread(authToken, title, summary)
      const response = await api.listThreads(authToken)
      const mapped = response.items.map(toThread)
      setThreads(mapped.length > 0 ? mapped : initialThreads)
      setSelectedThreadId(created.id)
      setModal(null)
      notify('议题已创建')
    } catch (error) {
      notify(error instanceof Error ? error.message : '创建议题失败')
    }
  }

  const deleteThread = async (threadId: string) => {
    const thread = threads.find((item) => item.id === threadId)
    if (!authToken || !thread || isStandaloneThread(thread)) return
    const okToDelete = window.confirm(`删除议题「${thread.title}」？该议题会从列表中移除。`)
    if (!okToDelete) return
    try {
      await api.deleteThread(authToken, threadId)
      const nextThreads = threads.filter((item) => item.id !== threadId)
      const nextVisibleThread = nextThreads.find((item) => !isStandaloneThread(item))
      setThreads(nextThreads)
      if (selectedThreadId === threadId) {
        setSelectedThreadId(nextVisibleThread?.id ?? '')
        setPage('threads')
      }
      notify('议题已删除')
    } catch (error) {
      notify(error instanceof Error ? error.message : '删除议题失败')
    }
  }

  const deleteMeeting = async (meetingId: string) => {
    if (!authToken) return
    const meeting =
      standaloneMeetings.find((item) => item.id === meetingId) ??
      Object.values(threadMeetingsByThread).flat().find((item) => item.id === meetingId)
    const okToDelete = window.confirm(`删除会议「${meeting?.title ?? '未命名会议'}」？`)
    if (!okToDelete) return
    try {
      await api.deleteSession(authToken, meetingId)
      setStandaloneMeetings((items) => items.filter((item) => item.id !== meetingId))
      setThreadMeetings((items) => items.filter((item) => item.id !== meetingId))
      setThreadMeetingsByThread((current) =>
        Object.fromEntries(Object.entries(current).map(([threadId, items]) => [threadId, items.filter((item) => item.id !== meetingId)])),
      )
      if (selectedSessionId === meetingId) {
        setSelectedSessionId(null)
        setSelectedSessionThreadId(null)
        setPage('threads')
      }
      notify('会议已删除')
    } catch (error) {
      notify(error instanceof Error ? error.message : '删除会议失败')
    }
  }

  const moveMeetingToThread = async (meetingId: string, targetThreadId: string) => {
    if (!authToken || !targetThreadId) return
    const standaloneTarget = targetThreadId === '__standalone__'
    const currentThreadId =
      standaloneMeetings.some((item) => item.id === meetingId)
        ? null
        : Object.entries(threadMeetingsByThread).find(([, items]) => items.some((item) => item.id === meetingId))?.[0] ?? null
    const meeting =
      standaloneMeetings.find((item) => item.id === meetingId) ??
      Object.values(threadMeetingsByThread).flat().find((item) => item.id === meetingId)
    if (!meeting) return
    try {
      const resolvedThreadId = standaloneTarget ? await ensureStandaloneThread() : targetThreadId
      const moved = toMeetingRecord(await api.moveSession(authToken, meetingId, resolvedThreadId))
      setStandaloneMeetings((items) =>
        standaloneTarget
          ? sortMeetings([moved, ...items.filter((item) => item.id !== meetingId)])
          : items.filter((item) => item.id !== meetingId),
      )
      setThreadMeetingsByThread((current) => {
        const next = Object.fromEntries(
          Object.entries(current).map(([threadId, items]) => [threadId, items.filter((item) => item.id !== meetingId)]),
        ) as Record<string, MeetingRecord[]>
        if (!standaloneTarget) {
          next[targetThreadId] = sortMeetings([moved, ...(next[targetThreadId] ?? [])])
        }
        return next
      })
      if (selectedSessionId === meetingId) {
        setSelectedThreadId(standaloneTarget ? selectedThreadId : targetThreadId)
        setSelectedSessionThreadId(standaloneTarget ? null : targetThreadId)
        setSelectedMeeting(moved)
      }
      setTodos((items) =>
        items.map((item) =>
          item.meetingId === meetingId
            ? { ...item, threadId: standaloneTarget ? resolvedThreadId : targetThreadId }
            : item,
        ),
      )
      if (currentThreadId && currentThreadId === selectedThreadId && !standaloneTarget) {
        setThreadMeetings((items) => items.filter((item) => item.id !== meetingId))
      }
      if (!standaloneTarget && targetThreadId === selectedThreadId) {
        setThreadMeetings((items) => sortMeetings([moved, ...items.filter((item) => item.id !== meetingId)]))
      }
      if (standaloneTarget && currentThreadId === selectedThreadId) {
        setThreadMeetings((items) => items.filter((item) => item.id !== meetingId))
      }
      notify(standaloneTarget ? '会议已移出为独立会议' : '会议已移动到议题文件夹')
    } catch (error) {
      notify(error instanceof Error ? error.message : '移动会议失败')
    }
  }

  const ensureStandaloneThread = async () => {
    if (!authToken) throw new Error('请先进入工作台')
    const existing = threads.find(isStandaloneThread)
    if (existing) return existing.id
    const created = await api.createThread(authToken, STANDALONE_THREAD_TITLE, STANDALONE_THREAD_BACKGROUND)
    const response = await api.listThreads(authToken)
    const mapped = response.items.map(toThread)
    setThreads(mapped.length > 0 ? mapped : [toThreadLike(created), ...threads])
    return created.id
  }

  const saveMeeting = async (title: string, threadId?: string, newThread?: { title: string; summary: string }) => {
    const creatingThread = threadId === NEW_THREAD_OPTION
    const standalone = !threadId
    try {
      let targetThreadId = standalone ? await ensureStandaloneThread() : threadId
      if (!authToken || !targetThreadId) return
      if (creatingThread) {
        const createdThread = await api.createThread(authToken, newThread?.title.trim() || title, newThread?.summary.trim() || '')
        const response = await api.listThreads(authToken)
        const mapped = response.items.map(toThread)
        setThreads(mapped.length > 0 ? mapped : [toThreadLike(createdThread), ...threads])
        targetThreadId = createdThread.id
      }
      const snapshot =
        standalone
          ? toPreparationSnapshot({ focus: '', agenda: [], consensus: [], decisions: [], questions: [] })
          : targetThreadId === selectedThreadId
          ? toPreparationSnapshot(briefing)
          : toPreparationSnapshot(toBriefing(await api.getPreparation(authToken, targetThreadId)))
      const created = await api.createSession(authToken, targetThreadId, title, snapshot)
      const meeting = toMeetingRecord(created)
      if (!standalone) setSelectedThreadId(targetThreadId)
      setSelectedSessionId(created.id)
      setSelectedSessionThreadId(standalone ? null : targetThreadId)
      setSelectedMeeting(meeting)
      if (standalone) {
        setStandaloneMeetings((items) => sortMeetings([meeting, ...items.filter((item) => item.id !== meeting.id)]))
      } else {
        setThreadMeetings((items) =>
          targetThreadId === selectedThreadId ? sortMeetings([meeting, ...items.filter((item) => item.id !== meeting.id)]) : [meeting],
        )
        setThreadMeetingsByThread((current) => ({
          ...current,
          [targetThreadId]: sortMeetings([meeting, ...(current[targetThreadId] ?? []).filter((item) => item.id !== meeting.id)]),
        }))
      }
      setModal(null)
      setTranscript([])
      setReportDraft(null)
      setPage('live')
      notify('会议已创建')
    } catch (error) {
      notify(error instanceof Error ? error.message : '创建会议失败')
    }
  }

  const exportData = (name: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
    setModal(null)
    notify('已导出 JSON 文件')
  }

  useEffect(() => {
    if (!authToken) return
    let cancelled = false

    const bootstrap = async () => {
      try {
        const [me, settings, threadsResponse, todosResponse] = await Promise.all([
          api.me(authToken),
          api.getSettings(authToken),
          api.listThreads(authToken),
          api.getMyTodos(authToken),
        ])
        if (cancelled) return
        setUserName(me.displayName)
        setSettingsState(toSettingsState(settings))
        const mappedThreads = threadsResponse.items.map(toThread)
        setThreads(mappedThreads.length > 0 ? mappedThreads : initialThreads)
        const standaloneThread = mappedThreads.find(isStandaloneThread)
        const visibleLoadedThreads = mappedThreads.filter((thread) => !isStandaloneThread(thread))
        const visibleSessions = await Promise.all(
          visibleLoadedThreads.map(async (thread) => {
            const sessions = await api.listThreadSessions(authToken, thread.id)
            return [thread.id, sortMeetings(sessions.items.map(toMeetingRecord))] as const
          }),
        )
        if (!cancelled) {
          setThreadMeetingsByThread(Object.fromEntries(visibleSessions))
          setExpandedThreadIds((items) => {
            const availableIds = new Set(visibleLoadedThreads.map((thread) => thread.id))
            const preserved = items.filter((id) => availableIds.has(id))
            return preserved.length > 0 ? preserved : visibleLoadedThreads.map((thread) => thread.id)
          })
        }
        if (standaloneThread) {
          const sessions = await api.listThreadSessions(authToken, standaloneThread.id)
          if (!cancelled) setStandaloneMeetings(sortMeetings(sessions.items.map(toMeetingRecord)))
        } else {
          setStandaloneMeetings([])
        }
        setSelectedThreadId((current) => {
          if (visibleLoadedThreads.some((thread) => thread.id === current)) return current
          return visibleLoadedThreads[0]?.id ?? initialThreads[0]?.id ?? current
        })
        const matrix = todosResponse.matrix ?? {}
        const items = Object.values(matrix).flat().map((item) => toTodo(item))
        if (items.length > 0) {
          setTodos(items)
        }
        if (!cancelled) {
          setPage('threads')
        }
      } catch {
        if (cancelled) return
        window.localStorage.removeItem(AUTH_TOKEN_KEY)
        setAuthToken(null)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [authToken])

  useEffect(() => {
    if (!authToken || !selectedThreadId) return
    if (threads.find((thread) => thread.id === selectedThreadId && isStandaloneThread(thread))) return
    let cancelled = false

    const run = async () => {
      try {
        const [preparationData, sessionsData, actionItemsData] = await Promise.all([
          api.getPreparation(authToken, selectedThreadId),
          api.listThreadSessions(authToken, selectedThreadId),
          api.getThreadActionItems(authToken, selectedThreadId),
        ])
        if (cancelled) return
        setBriefing(toBriefing(preparationData))
        const sortedMeetings = sortMeetings(sessionsData.items.map(toMeetingRecord))
        setThreadMeetings(sortedMeetings)
        setThreadMeetingsByThread((current) => ({ ...current, [selectedThreadId]: sortedMeetings }))
        const mappedTodos = actionItemsData.items.map((item) => toTodo(item))
        setTodos((items) => mergeTodos(items, mappedTodos))
        if (sortedMeetings[0]) {
          setSelectedSessionId(sortedMeetings[0].id)
          setSelectedSessionThreadId(selectedThreadId)
          setSelectedMeeting(sortedMeetings[0])
        } else {
          setSelectedSessionId(null)
        }
      } catch (error) {
        if (!cancelled) {
          notify(error instanceof Error ? error.message : '加载议题数据失败')
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [authToken, selectedThreadId, threads])

  useEffect(() => {
    if (!authToken || !selectedSessionId) return
    let cancelled = false

    const run = async () => {
      try {
        const [session, draft] = await Promise.all([
          api.getSession(authToken, selectedSessionId),
          api.getReportDraft(authToken, selectedSessionId).catch(() => null),
        ])
        if (cancelled) return
        setTranscript(session.transcriptSegments.map(toTranscript))
        const thread = threads.find((item) => item.id === session.threadId)
        setSelectedSessionThreadId(thread && !isStandaloneThread(thread) ? session.threadId : null)
        setSelectedMeeting(toMeetingRecord(session))
        setReportDraft(draft)
      } catch (error) {
        if (!cancelled) {
          notify(error instanceof Error ? error.message : '加载会议详情失败')
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [authToken, selectedSessionId, threads])

  const enterWorkspace = async () => {
    try {
      const result = await api.enter(userName)
      window.localStorage.setItem(AUTH_TOKEN_KEY, result.accessToken)
      setAuthToken(result.accessToken)
      setUserName(result.user.displayName)
      notify('已进入工作台')
    } catch (error) {
      notify(error instanceof Error ? error.message : '登录失败')
    }
  }

  if (page === 'login') {
    return <LoginPage userName={userName} setUserName={setUserName} onEnter={enterWorkspace} />
  }

  return (
    <>
      <AppShell
        page={page}
        setPage={setPage}
        userName={userName}
        query={query}
        setQuery={setQuery}
        openModal={setModal}
      >
        {page === 'threads' && (
          <ThreadsPage
            threads={visibleThreads}
            threadMeetingsByThread={threadMeetingsByThread}
            expandedThreadIds={expandedThreadIds}
            standaloneMeetings={standaloneMeetings}
            todos={todos}
            query={query}
            setPage={setPage}
            selectThread={(threadId) => setSelectedThreadId(threadId)}
            openNewMeeting={() => openMeetingModal()}
            openStandaloneMeeting={(meeting) => {
              setSelectedMeeting(meeting)
              setSelectedSessionId(meeting.id)
              setSelectedSessionThreadId(null)
              setPage('overview')
            }}
            openThreadMeeting={(threadId, meeting) => {
              setSelectedThreadId(threadId)
              setSelectedMeeting(meeting)
              setSelectedSessionId(meeting.id)
              setSelectedSessionThreadId(threadId)
              setPage('overview')
            }}
            deleteThread={deleteThread}
            deleteMeeting={deleteMeeting}
            moveMeetingToThread={moveMeetingToThread}
            toggleThreadExpanded={toggleThreadExpanded}
            openFilter={() => setDrawer('filters')}
            filters={filters}
          />
        )}
        {page === 'briefing' && (
          <BriefingPage
            thread={activeThread}
            briefing={briefing}
            todos={todos.filter((todo) => todo.threadId === activeThread.id)}
            meetings={threadMeetings}
            setPage={setPage}
            openTodoDrawer={openTodoDrawer}
            openBriefing={() => setDrawer('briefing')}
            openMeeting={(meeting) => {
              setSelectedMeeting(meeting)
              setSelectedSessionId(meeting.id)
              setPage('overview')
            }}
            openNewMeeting={() => openMeetingModal(activeThread?.id)}
          />
        )}
        {page === 'thread-todos' && (
          <ThreadTodosPage
            thread={activeThread}
            todos={threadTodos}
            setPage={setPage}
            toggleTodo={toggleTodo}
            openTodoDrawer={openTodoDrawer}
            openFilter={() => setDrawer('filters')}
          />
        )}
        {page === 'live' && (
          <LiveMeetingPage
            transcript={transcript}
            meeting={selectedMeeting}
            authToken={authToken}
            sessionId={selectedSessionId}
            setPage={setPage}
            setTranscript={setTranscript}
            notify={notify}
            onReportDraft={setReportDraft}
          />
        )}
        {page === 'ai-progress' && <AiProgressPage setPage={setPage} />}
        {page === 'overview' && (
          <OverviewPage
            meeting={selectedMeeting}
            activeThread={selectedSessionThreadId ? visibleThreads.find((thread) => thread.id === selectedSessionThreadId) ?? null : null}
            reportDraft={reportDraft}
            setPage={setPage}
            openDrawer={setDrawer}
            exportReport={() => setModal('export')}
          />
        )}
        {page === 'transcript' && (
          <TranscriptPage
            transcript={transcript}
            setPage={setPage}
            openTranscript={(id) => {
              setEditingTranscriptId(id)
              setDrawer('transcript')
            }}
            exportTranscript={() => exportData('meeting-transcript.json', transcript)}
          />
        )}
        {page === 'meeting-todos' && (
          <MeetingTodosPage
            todos={meetingTodos}
            setPage={setPage}
            toggleTodo={toggleTodo}
            openTodoDrawer={openTodoDrawer}
            openFilter={() => setDrawer('filters')}
          />
        )}
        {page === 'my-todos' && (
          <MyTodosPage
            todos={filteredTodos}
            view={todoView}
            setView={setTodoView}
            toggleTodo={toggleTodo}
            openTodoDrawer={openTodoDrawer}
            openFilter={() => setDrawer('filters')}
          />
        )}
        {page === 'settings' && (
          <SettingsPage
            key={settingsState ? `${settingsState.activeSource}:${settingsState.custom.baseUrl}:${settingsState.custom.model}:${settingsState.custom.apiKeyConfigured}` : 'settings-loading'}
            authToken={authToken}
            initialSettings={settingsState}
            notify={notify}
            openHelp={() => setModal('help')}
            onSettingsChange={setSettingsState}
          />
        )}
      </AppShell>

      <Modal
        key={`modal-${modal}-${meetingDraftThreadId}`}
        kind={modal}
        close={() => setModal(null)}
        saveThread={saveThread}
        saveMeeting={saveMeeting}
        threads={visibleThreads}
        selectedThreadId={meetingDraftThreadId}
        exportCurrent={() => exportData('meeting-report.json', { selectedMeeting, todos: meetingTodos })}
      />
      <Drawer
        key={`drawer-${drawer}-${editingTodoId ?? 'new'}-${editingTranscriptId ?? 'none'}`}
        kind={drawer}
        close={() => setDrawer(null)}
        briefing={briefing}
        saveBriefing={(next) => {
          setBriefing(next)
          setDrawer(null)
          notify('简报已保存为本次会议快照')
        }}
        todo={todos.find((item) => item.id === editingTodoId)}
        saveTodo={saveTodo}
        filters={filters}
        setFilters={setFilters}
        transcript={transcript.find((item) => item.id === editingTranscriptId)}
        saveTranscript={async (item) => {
          if (authToken && editingTranscriptId) {
            try {
              const result = await api.updateTranscriptSegment(authToken, editingTranscriptId, {
                speakerText: item.speaker,
                text: item.text,
              })
              setTranscript(result.items.map(toTranscript))
              setDrawer(null)
              notify('转写片段已更新')
              return
            } catch (error) {
              notify(error instanceof Error ? error.message : '转写更新失败')
            }
          }
          setTranscript((items) => items.map((current) => (current.id === item.id ? item : current)))
          setDrawer(null)
          notify('转写片段已更新')
        }}
      />
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

function LoginPage({
  userName,
  setUserName,
  onEnter,
}: {
  userName: string
  setUserName: (value: string) => void
  onEnter: () => void
}) {
  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-panel">
          <div className="login-brand">
            <div className="brand-mark">
              <MessageSquareText size={18} />
            </div>
            <span>会议助手</span>
          </div>
          <h1>让每次会议都有迹可循</h1>
          <p>会前带入历史上下文，会中捕捉讨论链路，会后确认跟进事项。</p>
          {['会前准备|自动带入历史决策与待办', '会中记录|AI 辅助捕捉讨论链路', '会后跟进|确认草稿，写入正式记录'].map((item) => {
            const [title, text] = item.split('|')
            return (
              <div className="login-feature" key={title}>
                <CheckCircle2 size={20} />
                <div>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
              </div>
            )
          })}
        </section>
        <section className="login-card">
          <LogoBlock />
          <div>
            <h2>进入工作台</h2>
            <p>演示模式，输入任意名字即可进入</p>
          </div>
          <label htmlFor="entryName">你的名字</label>
          <input id="entryName" value={userName} onChange={(event) => setUserName(event.target.value)} />
          <button className="button primary wide" type="button" onClick={onEnter}>
            进入工作台 <ChevronRight size={16} />
          </button>
          <small>数据按演示账号隔离；后续会接入后端 token 鉴权。</small>
        </section>
      </div>
    </main>
  )
}

function AppShell({
  children,
  page,
  setPage,
  userName,
  query,
  setQuery,
  openModal,
}: {
  children: React.ReactNode
  page: Page
  setPage: (page: Page) => void
  userName: string
  query: string
  setQuery: (value: string) => void
  openModal: (kind: ModalKind) => void
}) {
  const navItems = [
    { key: 'threads' as Page, label: '我的会议', icon: LayoutDashboard },
    { key: 'my-todos' as Page, label: '我的待办', icon: ClipboardCheck },
    { key: 'settings' as Page, label: '设置', icon: Settings },
  ]

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <LogoBlock />
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon
            const active =
              page === item.key ||
              (item.key === 'threads' &&
                ['briefing', 'thread-todos', 'live', 'ai-progress', 'overview', 'transcript', 'meeting-todos'].includes(page))
            return (
              <button className={`nav-item ${active ? 'active' : ''}`} key={item.key} type="button" onClick={() => setPage(item.key)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{userName.slice(0, 1)}</div>
          <div>
            <strong>{userName}</strong>
            <span>演示账号</span>
          </div>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索会议、待办、决策..." />
          </div>
          <div className="topbar-actions">
            <IconButton label="通知" onClick={() => openModal('notifications')}>
              <Bell size={18} />
            </IconButton>
            <IconButton label="帮助" onClick={() => openModal('help')}>
              <HelpCircle size={18} />
            </IconButton>
          </div>
        </header>
        <div className="content">{children}</div>
      </section>
    </main>
  )
}

function ThreadsPage({
  threads,
  threadMeetingsByThread,
  expandedThreadIds,
  standaloneMeetings,
  todos,
  query,
  setPage,
  selectThread,
  openNewMeeting,
  openStandaloneMeeting,
  openThreadMeeting,
  deleteThread,
  deleteMeeting,
  moveMeetingToThread,
  toggleThreadExpanded,
  openFilter,
  filters,
}: {
  threads: Thread[]
  threadMeetingsByThread: Record<string, MeetingRecord[]>
  expandedThreadIds: string[]
  standaloneMeetings: MeetingRecord[]
  todos: ActionItem[]
  query: string
  setPage: (page: Page) => void
  selectThread: (threadId: string) => void
  openNewMeeting: () => void
  openStandaloneMeeting: (meeting: MeetingRecord) => void
  openThreadMeeting: (threadId: string, meeting: MeetingRecord) => void
  deleteThread: (threadId: string) => void
  deleteMeeting: (meetingId: string) => void
  moveMeetingToThread: (meetingId: string, threadId: string) => void
  toggleThreadExpanded: (threadId: string) => void
  openFilter: () => void
  filters: { status: string; priority: string }
}) {
  const filtersAreDefault = filters.status === 'all' && filters.priority === 'all'
  const trimmedQuery = query.trim()
  const visibleThreads = threads.filter((thread) => {
    const matchesQuery = `${thread.title}${thread.summary}`.includes(trimmedQuery)
    const hasFilteredTodos =
      filtersAreDefault || todos.some((todo) => todo.threadId === thread.id && matchesTodoFilters(todo, filters))
    return matchesQuery && hasFilteredTodos
  })
  const visibleStandaloneMeetings = standaloneMeetings.filter((meeting) =>
    `${meeting.title}${meeting.date}${meeting.time}`.includes(trimmedQuery),
  )
  const threadTodoCount = (threadId: string) =>
    todos.filter((todo) => todo.threadId === threadId && (filtersAreDefault || matchesTodoFilters(todo, filters))).length

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Workspace"
        title="我的会议"
        description="按议题整理连续会议，让后一次会议自然继承前一次会议的背景、决策和待办。"
        actions={
          <button className="button primary" type="button" onClick={openNewMeeting}>
            <Plus size={16} />
            新建会议
          </button>
        }
      />
      <div className="stats-grid">
        <StatCard label="独立会议" value={String(standaloneMeetings.length)} icon={<CalendarDays size={22} />} />
        <StatCard label="议题文件夹" value={String(threads.length)} icon={<FolderOpen size={22} />} />
        <StatCard label="待办总数" value={String(todos.length)} tone="todo" icon={<ClipboardCheck size={22} />} />
      </div>
      <section className="card table-card">
        <div className="table-head">
          <h3>会议与议题</h3>
          <button className="button secondary" type="button" onClick={openFilter}>
            <Filter size={16} />
            筛选
          </button>
        </div>
        <div className="thread-table">
          <div className="table-row table-labels">
            <span>名称</span>
            <span>待办</span>
            <span>创建/更新</span>
            <span>参与成员</span>
            <span>操作</span>
          </div>
          {visibleStandaloneMeetings.map((meeting) => (
            <div
              className="table-row top-level-meeting-row"
              key={meeting.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('application/meeting-id', meeting.id)
                event.dataTransfer.effectAllowed = 'move'
              }}
            >
              <button className="meeting-row-main" type="button" onClick={() => openStandaloneMeeting(meeting)}>
                <span className="thread-title-cell">
                  <CalendarDays size={18} />
                  <span>
                    <strong>{meeting.title}</strong>
                  </span>
                </span>
                <span>{meeting.todoCount}</span>
                <span>{meetingCreatedAt(meeting)}</span>
                <span className="muted-cell">{displayParticipants(meeting.participants)}</span>
              </button>
              <span className="row-actions">
                <select
                  className="move-meeting-select"
                  aria-label={`移动会议 ${meeting.title}`}
                  value=""
                  onChange={(event) => {
                    moveMeetingToThread(meeting.id, event.target.value)
                  }}
                >
                  <option value="" disabled>
                    移动到...
                  </option>
                  <option value="__standalone__">移出为独立会议</option>
                  {threads.map((thread) => (
                    <option value={thread.id} key={thread.id}>
                      {thread.title}
                    </option>
                  ))}
                </select>
                <button className="ghost-icon danger-icon" type="button" aria-label={`删除会议 ${meeting.title}`} title="删除会议" onClick={() => deleteMeeting(meeting.id)}>
                  <Trash2 size={15} />
                </button>
              </span>
            </div>
          ))}
          {visibleThreads.map((thread) => {
            const threadMeetings = threadMeetingsByThread[thread.id] ?? []
            const expanded = expandedThreadIds.includes(thread.id)
            return (
              <div
                className="thread-group"
                key={thread.id}
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes('application/meeting-id')) {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                  }
                }}
                onDrop={(event) => {
                  const meetingId = event.dataTransfer.getData('application/meeting-id')
                  if (meetingId) {
                    event.preventDefault()
                    moveMeetingToThread(meetingId, thread.id)
                  }
                }}
              >
                <div className="table-row thread-row">
                  <button className="expand-button" type="button" aria-label={expanded ? `收起 ${thread.title}` : `展开 ${thread.title}`} onClick={() => toggleThreadExpanded(thread.id)}>
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <button
                    className="thread-row-main"
                    type="button"
                    onClick={() => {
                      selectThread(thread.id)
                      setPage('briefing')
                    }}
                  >
                    <span className="thread-title-cell">
                      <FolderOpen size={18} />
                      <span>
                        <strong>{thread.title}</strong>
                        {displayThreadSummary(thread.summary) ? <small>{displayThreadSummary(thread.summary)}</small> : null}
                      </span>
                    </span>
                    <span>{threadTodoCount(thread.id)}</span>
                    <span>{thread.updatedAt}</span>
                    <span className="muted-cell">{thread.members.join('、')}</span>
                  </button>
                  <button
                    className="ghost-icon danger-icon"
                    type="button"
                    aria-label={`删除议题 ${thread.title}`}
                    title="删除议题"
                    onClick={() => deleteThread(thread.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                {expanded &&
                  threadMeetings.map((meeting) => (
                    <div className="thread-meeting-row" key={meeting.id} draggable onDragStart={(event) => {
                      event.dataTransfer.setData('application/meeting-id', meeting.id)
                      event.dataTransfer.effectAllowed = 'move'
                    }}>
                      <button className="thread-meeting-main" type="button" onClick={() => openThreadMeeting(thread.id, meeting)}>
                        <CalendarDays size={16} />
                        <span>
                          <strong>{meeting.title}</strong>
                        </span>
                      </button>
                      <span>{meeting.todoCount}</span>
                      <span>{meetingCreatedAt(meeting)}</span>
                      <span className="muted-cell">{displayParticipants(meeting.participants)}</span>
                      <span className="row-actions">
                        <select
                          className="move-meeting-select"
                          aria-label={`移动会议 ${meeting.title}`}
                          value=""
                          onChange={(event) => {
                            moveMeetingToThread(meeting.id, event.target.value)
                          }}
                        >
                          <option value="" disabled>
                            移动到...
                          </option>
                          <option value="__standalone__">移出为独立会议</option>
                          {threads
                            .filter((candidate) => candidate.id !== thread.id)
                            .map((thread) => (
                              <option value={thread.id} key={thread.id}>
                                {thread.title}
                              </option>
                            ))}
                        </select>
                        <button className="ghost-icon danger-icon" type="button" aria-label={`删除会议 ${meeting.title}`} title="删除会议" onClick={() => deleteMeeting(meeting.id)}>
                          <Trash2 size={15} />
                        </button>
                      </span>
                    </div>
                  ))}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
function BriefingPage({
  thread,
  briefing,
  todos,
  meetings,
  setPage,
  openTodoDrawer,
  openBriefing,
  openMeeting,
  openNewMeeting,
}: {
  thread: Thread
  briefing: typeof initialBriefing
  todos: ActionItem[]
  meetings: MeetingRecord[]
  setPage: (page: Page) => void
  openTodoDrawer: (id?: string) => void
  openBriefing: () => void
  openMeeting: (meeting: MeetingRecord) => void
  openNewMeeting: () => void
}) {
  return (
    <div className="briefing-layout">
      <section className="page-stack">
        <Breadcrumb onBack={() => setPage('threads')} label="我的会议 / 返回" />
        <PageHeader
          eyebrow="2026-05-17"
          title={thread.title}
          description="这个议题下的会议按时间倒序排列，新会议会继承前序会议的背景、待办、风险和遗留问题。"
          actions={
            <>
              <button className="button secondary no-wrap" type="button" onClick={openBriefing}>
                <Edit3 size={16} />
                编辑简报
              </button>
              <button className="button secondary no-wrap" type="button" onClick={openNewMeeting}>
                <Plus size={16} />
                新建会议
              </button>
              <button className="button primary no-wrap" type="button" onClick={() => setPage('live')}>
                <Play size={16} />
                开始会议
              </button>
            </>
          }
        />
        <section className="card ai-brief">
          <div className="section-heading">
            <Sparkles size={20} />
            <div>
              <h3>会前简报</h3>
              <span>已保存为本次会议快照，可继续编辑</span>
            </div>
          </div>
          <div className="focus-box">
            <Target size={18} />
            <div>
              <strong>建议关注</strong>
              <p>{briefing.focus}</p>
            </div>
          </div>
          <TwoColumnList title="建议议程" items={briefing.agenda} numbered />
          <TwoColumnList title="上次共识" items={briefing.consensus} />
          <TwoColumnList title="上次决策" items={briefing.decisions} />
          <TwoColumnList title="遗留问题" items={briefing.questions} />
        </section>
      </section>
      <aside className="right-rail">
        <RailCard title="议题关联待办" count={String(todos.length)} onTitleClick={() => setPage('thread-todos')}>
          {todos.slice(0, 3).map((item) => (
            <MiniTodo key={item.id} item={item} onClick={() => openTodoDrawer(item.id)} />
          ))}
        </RailCard>
        <RailCard title="会议顺序" count={String(meetings.length)} onTitleClick={meetings[0] ? () => openMeeting(meetings[0]) : undefined}>
          {meetings.length > 0 ? (
            meetings.map((meeting) => (
              <MiniMeeting key={meeting.id} meeting={meeting} onClick={() => openMeeting(meeting)} />
            ))
          ) : (
            <p className="rail-copy">这个议题下还没有会议。</p>
          )}
          <button className="button secondary wide" type="button" onClick={openNewMeeting}>
            <Plus size={16} />
            新建本议题会议
          </button>
        </RailCard>
        <RailCard title="待跟进要点" onTitleClick={() => setPage('thread-todos')}>
          {briefing.questions.slice(0, 3).map((item) => (
            <button className="follow-line" key={item} type="button" onClick={() => setPage('thread-todos')}>
              <ChevronRight size={14} />
              {item}
            </button>
          ))}
        </RailCard>
      </aside>
    </div>
  )
}

function ThreadTodosPage({
  thread,
  todos,
  setPage,
  toggleTodo,
  openTodoDrawer,
  openFilter,
}: {
  thread: Thread
  todos: ActionItem[]
  setPage: (page: Page) => void
  toggleTodo: (id: string) => void
  openTodoDrawer: (id?: string) => void
  openFilter: () => void
}) {
  return (
    <div className="page-stack">
      <Breadcrumb onBack={() => setPage('briefing')} label={`我的会议 / ${thread.title} / 关联待办`} />
      <PageHeader
        title="议题关联待办"
        description="这里展示该议题下全部待办，包括已完成项。"
        actions={
          <>
            <button className="button secondary" type="button" onClick={openFilter}>
              <Filter size={16} />
              筛选
            </button>
            <button className="button primary" type="button" onClick={() => openTodoDrawer()}>
              <Plus size={16} />
              新增待办
            </button>
          </>
        }
      />
      <TodoSummary todos={todos} />
      <section className="card task-list-card">
        <TaskList todos={todos} toggleTodo={toggleTodo} openTodoDrawer={openTodoDrawer} />
      </section>
    </div>
  )
}

function LiveMeetingPage({
  transcript,
  meeting,
  authToken,
  sessionId,
  setPage,
  setTranscript,
  notify,
  onReportDraft,
}: {
  transcript: TranscriptItem[]
  meeting: MeetingRecord
  authToken: string | null
  sessionId: string | null
  setPage: (page: Page) => void
  setTranscript: React.Dispatch<React.SetStateAction<TranscriptItem[]>>
  notify: (message: string) => void
  onReportDraft: (draft: ReportDraftResponse | null) => void
}) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [recordingProvider, setRecordingProvider] = useState<'funasr' | 'browser' | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [asrStatus, setAsrStatus] = useState('等待开始')
  const [asrStats, setAsrStats] = useState({ sentKb: 0, messages: 0, micFrames: 0 })
  const [assistantText, setAssistantText] = useState('您好，我正在旁听会议。您可以随时向我提问，或者让我帮您整理纪要和待办。')
  const [question, setQuestion] = useState('')
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const shouldRestartRecognitionRef = useRef(false)
  const funAsrSocketRef = useRef<WebSocket | null>(null)
  const finalizedFunAsrKeysRef = useRef<Set<string>>(new Set())
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const pcmQueueRef = useRef<Int16Array>(new Int16Array())
  const sentBytesRef = useRef(0)
  const socketMessagesRef = useRef(0)
  const micFramesRef = useRef(0)
  const lastStatsPaintRef = useRef(0)
  const recordingStartedAtRef = useRef<number | null>(null)
  const elapsedBeforeStartRef = useRef(0)
  const recordingStateRef = useRef<RecordingState>('idle')

  const isRecording = recordingState === 'recording'
  const isPaused = recordingState === 'paused'
  const recordingHint = isRecording
    ? recordingProvider === 'funasr'
      ? '正在使用本地 FunASR 实时识别'
      : '正在使用浏览器麦克风识别'
    : isPaused
      ? '录音已暂停，可继续转写'
      : '点击开始录音后生成实时转写'

  useEffect(() => {
    if (!isRecording) return undefined
    const timer = window.setInterval(() => {
      const startedAt = recordingStartedAtRef.current ?? Date.now()
      setElapsedSeconds(Math.floor((elapsedBeforeStartRef.current + Date.now() - startedAt) / 1000))
    }, 500)
    return () => window.clearInterval(timer)
  }, [isRecording])

  useEffect(() => {
    recordingStateRef.current = recordingState
  }, [recordingState])

  const persistTranscript = async (segments: TranscriptItem[]) => {
    if (!authToken || !sessionId || segments.length === 0) return
    try {
      await api.createTranscription(authToken, sessionId, {
        provider: 'browser-speech',
        mode: 'realtime',
        durationSeconds: elapsedSeconds,
        segments: segments.map((segment) => ({
          speakerText: segment.speaker,
          text: segment.text,
          startedAt: new Date().toISOString(),
        })),
      })
    } catch (error) {
      notify(error instanceof Error ? error.message : '转写内容保存失败')
    }
  }

  const persistProviderTranscript = async (provider: string, segments: TranscriptItem[]) => {
    if (!authToken || !sessionId || segments.length === 0) return
    try {
      await api.createTranscription(authToken, sessionId, {
        provider,
        mode: 'realtime',
        durationSeconds: elapsedSeconds,
        segments: segments.map((segment) => ({
          speakerText: segment.speaker,
          text: segment.text,
          startedAt: new Date().toISOString(),
        })),
      })
    } catch (error) {
      notify(error instanceof Error ? error.message : '转写内容保存失败')
    }
  }

  const createRecognition = () => {
    const Recognition = (window as SpeechRecognitionWindow).SpeechRecognition ?? (window as SpeechRecognitionWindow).webkitSpeechRecognition
    if (!Recognition) return null
    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'zh-CN'
    recognition.onresult = (event) => {
      const finalSegments: TranscriptItem[] = []
      let interim = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result[0]?.transcript.trim() ?? ''
        if (!text) continue
        if (result.isFinal) {
          finalSegments.push({
            id: `tr-${Date.now()}-${index}`,
            speaker: 'Speaker 1',
            role: '实时转写',
            time: formatClock(new Date().toISOString()),
            text,
          })
        } else {
          interim = text
        }
      }
      if (finalSegments.length > 0) {
        setTranscript((items) => [...items, ...finalSegments])
        void persistTranscript(finalSegments)
      }
      setInterimTranscript(interim)
    }
    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return
      shouldRestartRecognitionRef.current = false
      setRecordingState('idle')
      notify(event.error === 'not-allowed' ? '浏览器未授权麦克风，无法录音' : `语音识别失败：${event.error}`)
    }
    recognition.onend = () => {
      if (!shouldRestartRecognitionRef.current) return
      try {
        recognition.start()
      } catch {
        shouldRestartRecognitionRef.current = false
      }
    }
    return recognition
  }

  const paintAsrStats = (force = false) => {
    const now = Date.now()
    if (!force && now - lastStatsPaintRef.current <= 500) return
    lastStatsPaintRef.current = now
    setAsrStats((current) => ({
      ...current,
      sentKb: Math.round(sentBytesRef.current / 1024),
      micFrames: micFramesRef.current,
    }))
  }

  const enqueuePcmToSocket = (socket: WebSocket | null, pcm: Int16Array) => {
    paintAsrStats()
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    pcmQueueRef.current = concatInt16Arrays(pcmQueueRef.current, pcm)
    const samplesPerPacket = 3200
    while (pcmQueueRef.current.length >= samplesPerPacket) {
      const chunk = pcmQueueRef.current.slice(0, samplesPerPacket)
      pcmQueueRef.current = pcmQueueRef.current.slice(samplesPerPacket)
      socket.send(chunk.buffer)
      sentBytesRef.current += chunk.byteLength
      paintAsrStats()
    }
  }

  const enqueueFunAsrPcm = (pcm: Int16Array) => {
    enqueuePcmToSocket(funAsrSocketRef.current, pcm)
  }

  const stopStreamingAudio = () => {
    audioProcessorRef.current?.disconnect()
    audioSourceRef.current?.disconnect()
    audioContextRef.current?.close().catch(() => undefined)
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    const funAsrSocket = funAsrSocketRef.current
    if (funAsrSocket && funAsrSocket.readyState === WebSocket.OPEN) {
      funAsrSocket.send(JSON.stringify({ is_speaking: false }))
      window.setTimeout(() => funAsrSocket.close(), 300)
    }
    audioProcessorRef.current = null
    audioSourceRef.current = null
    audioContextRef.current = null
    mediaStreamRef.current = null
    funAsrSocketRef.current = null
    pcmQueueRef.current = new Int16Array()
    sentBytesRef.current = 0
    socketMessagesRef.current = 0
    micFramesRef.current = 0
    lastStatsPaintRef.current = 0
  }

  useEffect(() => {
    return () => {
      shouldRestartRecognitionRef.current = false
      recognitionRef.current?.stop()
      stopStreamingAudio()
    }
  }, [])

  const startMicrophoneStream = async (sampleRate: number, onPcm: (pcm: Int16Array) => void) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前浏览器不支持麦克风录音')
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, sampleRate },
    })
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      stream.getTracks().forEach((track) => track.stop())
      throw new Error('没有检测到可用的麦克风输入')
    }
    const audioContext = new AudioContext({ sampleRate })
    await audioContext.resume()
    const source = audioContext.createMediaStreamSource(stream)
    const processor = audioContext.createScriptProcessor(4096, 1, 1)
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0)
      micFramesRef.current += 1
      onPcm(downsampleToPcm16(input, audioContext.sampleRate, sampleRate))
      paintAsrStats()
    }
    source.connect(processor)
    processor.connect(audioContext.destination)
    mediaStreamRef.current = stream
    audioContextRef.current = audioContext
    audioSourceRef.current = source
    audioProcessorRef.current = processor
  }

  const handleFunAsrMessage = (message: FunAsrMessage) => {
    socketMessagesRef.current += 1
    setAsrStats((current) => ({ ...current, messages: socketMessagesRef.current }))
    const text = stringFromUnknown(message.text)
    if (!text) {
      setAsrStatus('FunASR 已返回消息')
      return
    }
    const mode = message.mode ?? ''
    const final = message.is_final === true || mode.includes('offline')
    if (!final) {
      setInterimTranscript(text)
      setAsrStatus('FunASR 正在接收临时识别结果')
      return
    }
    const key = `${message.wav_name ?? 'funasr'}:${message.timestamp ?? text}`
    if (finalizedFunAsrKeysRef.current.has(key)) return
    finalizedFunAsrKeysRef.current.add(key)
    const segment = {
      id: `funasr-${Date.now()}-${finalizedFunAsrKeysRef.current.size}`,
      speaker: 'Speaker 1',
      role: 'FunASR 实时转写',
      time: formatClock(new Date().toISOString()),
      text,
    }
    setTranscript((items) => [...items, segment])
    setInterimTranscript('')
    setAsrStatus('已收到 FunASR 稳定转写结果')
    void persistProviderTranscript('funasr', [segment])
  }

  const startFunAsrRecording = async () => {
    if (!authToken || !sessionId) throw new Error('当前会议还没有可用的后端会话')
    sentBytesRef.current = 0
    socketMessagesRef.current = 0
    micFramesRef.current = 0
    setAsrStats({ sentKb: 0, messages: 0, micFrames: 0 })
    const socket = new WebSocket(FUNASR_WS_URL, 'binary')
    socket.binaryType = 'arraybuffer'
    setAsrStatus('正在连接本地 FunASR')
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error(`连接本地 FunASR 超时：${FUNASR_WS_URL}`))
      }, 5000)
      socket.onopen = () => {
        window.clearTimeout(timer)
        resolve()
      }
      socket.onerror = () => {
        window.clearTimeout(timer)
        reject(new Error(`无法连接本地 FunASR：${FUNASR_WS_URL}`))
      }
      socket.onclose = () => {
        window.clearTimeout(timer)
        reject(new Error(`本地 FunASR 连接已关闭：${FUNASR_WS_URL}`))
      }
    })
    funAsrSocketRef.current = socket
    finalizedFunAsrKeysRef.current = new Set()
    socket.send(
      JSON.stringify({
        mode: '2pass',
        wav_name: `meeting-${sessionId}-${Date.now()}`,
        wav_format: 'pcm',
        audio_fs: 16000,
        is_speaking: true,
        chunk_size: [5, 10, 5],
        chunk_interval: 10,
        itn: true,
      }),
    )
    setAsrStatus('FunASR 已连接，正在发送音频')
    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return
      try {
        handleFunAsrMessage(JSON.parse(event.data) as FunAsrMessage)
      } catch {
        notify('FunASR 返回了无法解析的结果')
      }
    }
    socket.onerror = () => {
      setAsrStatus('FunASR WebSocket 出错')
      notify('FunASR WebSocket 出错')
    }
    socket.onclose = () => {
      if (recordingStateRef.current === 'recording') setAsrStatus('FunASR 连接已关闭，请确认本地服务仍在运行')
    }
    await startMicrophoneStream(16000, enqueueFunAsrPcm)
  }

  const startBrowserRecognition = () => {
    if (!authToken || !sessionId) {
      notify('当前会议还没有可用的后端会话')
      return
    }
    const recognition = createRecognition()
    if (!recognition) {
      notify('当前浏览器不支持实时语音识别，请使用 Chrome 或 Edge')
      return
    }
    try {
      recognitionRef.current = recognition
      shouldRestartRecognitionRef.current = true
      recordingStartedAtRef.current = Date.now()
      recognition.start()
      setRecordingProvider('browser')
      setRecordingState('recording')
    } catch {
      shouldRestartRecognitionRef.current = false
      notify('录音启动失败，请检查浏览器麦克风权限')
      setAsrStatus('浏览器识别启动失败')
    }
  }

  const startRecording = async () => {
    if (!authToken || !sessionId) {
      notify('当前会议还没有可用的后端会话')
      return
    }
    try {
      await startFunAsrRecording()
      recordingStartedAtRef.current = Date.now()
      setRecordingProvider('funasr')
      setRecordingState('recording')
      notify('已连接本地 FunASR 实时识别')
    } catch (error) {
      stopStreamingAudio()
      const fallbackMessage =
        error instanceof Error
          ? `${error.message}，请先运行 scripts/start-funasr.ps1，已切换浏览器识别`
          : 'FunASR 启动失败，请先运行 scripts/start-funasr.ps1，已切换浏览器识别'
      notify(fallbackMessage)
      setAsrStatus(`FunASR 不可用：${FUNASR_WS_URL}`)
      startBrowserRecognition()
    }
  }

  const pauseRecording = () => {
    shouldRestartRecognitionRef.current = false
    recognitionRef.current?.stop()
    stopStreamingAudio()
    if (recordingStartedAtRef.current) {
      elapsedBeforeStartRef.current += Date.now() - recordingStartedAtRef.current
      setElapsedSeconds(Math.floor(elapsedBeforeStartRef.current / 1000))
    }
    recordingStartedAtRef.current = null
    setInterimTranscript('')
    setAsrStatus('录音已暂停')
    setRecordingState('paused')
  }

  const stopRecording = () => {
    if (isRecording) {
      pauseRecording()
    }
    shouldRestartRecognitionRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
    stopStreamingAudio()
    setRecordingProvider(null)
    setAsrStatus('录音已停止')
    setRecordingState('idle')
  }

  const ask = async (text: string) => {
    if (!authToken || !sessionId) {
      notify('当前会议还没有可用的后端会话')
      return
    }
    try {
      const result = await api.askAssistant(authToken, sessionId, text)
      setAssistantText(result.answer)
      setQuestion('')
    } catch (error) {
      notify(error instanceof Error ? error.message : '助手调用失败')
    }
  }

  const endMeeting = async () => {
    stopRecording()
    if (!authToken || !sessionId) {
      setPage('ai-progress')
      return
    }
    try {
      setPage('ai-progress')
      const meetingContent = transcript.map((line) => `${line.speaker}: ${line.text}`).join('\n')
      const draft = await api.generateReportDraft(authToken, sessionId, meetingContent)
      onReportDraft(draft)
      setPage('overview')
    } catch (error) {
      notify(error instanceof Error ? error.message : '生成会议综述失败')
      setPage('overview')
    }
  }

  return (
    <div className="live-layout">
      <section className="card live-main">
        <div className="live-top">
          <div>
            <span className="eyebrow">Workspace</span>
            <h2>{meeting.title}</h2>
          </div>
          <div className="recording-clock">
            <span className={`pulse-dot ${recordingState}`} />
            {isPaused ? '已暂停' : formatDuration(elapsedSeconds)}
          </div>
        </div>
        <div className="recorder-strip">
          <div className="mic-orb">
            <Mic size={26} />
          </div>
          <div>
            <strong>实时语音转写</strong>
            <span>{recordingHint}</span>
          </div>
          <button className="button secondary" type="button" onClick={isRecording ? pauseRecording : () => void startRecording()}>
            {isRecording ? <PauseCircle size={16} /> : <Play size={16} />}
            {isRecording ? '暂停录音' : isPaused ? '继续录音' : '开始录音'}
          </button>
          <button className="button danger" type="button" onClick={() => void endMeeting()}>
            <StopCircle size={16} />
            结束会议
          </button>
        </div>
        <div className="asr-status">
          <span>{asrStatus}</span>
          {recordingProvider === 'funasr' && (
            <small>
              麦克风帧 {asrStats.micFrames} · 已发送 {asrStats.sentKb} KB · 收到 {asrStats.messages} 条消息
            </small>
          )}
        </div>
        <div className="transcript-stream">
          {transcript.length === 0 && !interimTranscript && (
            <div className="transcript-empty">等待麦克风输入，识别出的内容会实时出现在这里。</div>
          )}
          {transcript.map((line, index) => (
            <TranscriptLine key={line.id} line={line} live={isRecording && index === transcript.length - 1} />
          ))}
          {interimTranscript && (
            <TranscriptLine
              line={{
                id: 'interim-transcript',
                speaker: 'Speaker 1',
                role: '正在识别',
                time: formatDuration(elapsedSeconds),
                text: interimTranscript,
              }}
              live
            />
          )}
        </div>
      </section>
      <aside className="card assistant-panel">
        <div className="assistant-head">
          <div>
            <Bot size={19} />
            <strong>会议 AI 助手</strong>
          </div>
          <span>{isRecording ? '实时分析中' : isPaused ? '等待继续' : '待开始'}</span>
        </div>
        <div className="quick-prompts">
          {['总结刚才张总的发言重点', '提取目前已确定的待办事项', '分析市场部和研发部的核心分歧点'].map((item) => (
            <button key={item} type="button" onClick={() => void ask(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="assistant-message">
          <Bot size={18} />
          <p>{assistantText}</p>
        </div>
        <div className="ask-box">
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="@助手 总结刚才的分歧" />
          <button
            type="button"
            aria-label="发送"
            onClick={() => (question.trim() ? void ask(question) : notify('先输入一个问题'))}
          >
            <Send size={16} />
          </button>
        </div>
      </aside>
    </div>
  )
}

function AiProgressPage({ setPage }: { setPage: (page: Page) => void }) {
  const [progress, setProgress] = useState(65)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((value) => (value >= 96 ? value : value + 1))
    }, 650)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <section className="ai-progress-page">
      <LogoBlock />
      <div className="card ai-progress-card">
        <div className="progress-icon">
          <Sparkles size={42} />
        </div>
        <h2>会议已结束，AI 正在生成会议报告</h2>
        <p>正在提炼会议精华、结构化文档与待办清单。</p>
        <div className="progress-meta">
          <span>分析进度</span>
          <strong>{progress}%</strong>
        </div>
        <div className="progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <ProgressStep done label="提取核心观点" state="已完成" />
        <ProgressStep active label="整理待办事项" state="进行中" />
        <ProgressStep label="润色会议纪要" state="等待中" />
        <button className="button primary wide" type="button" onClick={() => setPage('overview')}>
          查看会议综述
        </button>
      </div>
    </section>
  )
}

function OverviewPage({
  meeting,
  activeThread,
  reportDraft,
  setPage,
  openDrawer,
  exportReport,
}: {
  meeting: MeetingRecord
  activeThread: Thread | null
  reportDraft: ReportDraftResponse | null
  setPage: (page: Page) => void
  openDrawer: (kind: DrawerKind) => void
  exportReport: () => void
}) {
  const summary = reportDraft?.summary?.content || '会议报告尚未生成或仍在整理中。'
  const decisionTags = (reportDraft?.decisions ?? [])
    .map((item) => (typeof item.content === 'string' ? item.content : ''))
    .filter(Boolean)
    .slice(0, 3)
  return (
    <div className="page-stack report-page">
      <Breadcrumb onBack={() => setPage(activeThread ? 'briefing' : 'threads')} label={activeThread ? `我的会议 / ${activeThread.title} / 返回` : '我的会议 / 返回'} />
      <MeetingTabs active="overview" setPage={setPage} />
      <PageHeader
        eyebrow={`${meeting.date} ${meeting.time}`}
        title={meeting.title}
        description={`参与人：${meeting.participants}`}
        actions={
          <button className="button secondary" type="button" onClick={() => openDrawer('meeting')}>
            <Edit3 size={16} />
            编辑
          </button>
        }
      />
      <section className="card strategy-card">
        <div className="section-heading">
          <Sparkles size={20} />
          <div>
            <h3>AI 核心策略总结</h3>
            <span>基于当前会议内容和会前快照生成</span>
          </div>
        </div>
        <blockquote>{summary}</blockquote>
        <div className="keyword-row">
          {(decisionTags.length > 0 ? decisionTags : ['等待会议结论', '请确认草稿', '可继续编辑']).map((tag, index) => (
            <Tag key={tag} label={tag} tone={index === 0 ? 'todo' : index === 1 ? 'warning' : 'done'} />
          ))}
        </div>
      </section>
      <div className="project-grid">
        <ProjectCard icon={<LayoutDashboard size={20} />} title="产品功能优化" tag="P1" text="针对核心工作流进行深度重构，减少用户操作层级。优先解决 Q2 遗留的 3 个高优体验缺陷。" />
        <ProjectCard icon={<ShieldCheck size={20} />} title="商业模式设计" tag="P0" tone="p0" text="探索基于用量计费的新型订阅模式，需要解决与现有按座席收费模式的冲突。" />
        <ProjectCard icon={<Target size={20} />} title="市场推广策略" tag="P2" tone="p2" text="行业峰会赞助和产品体验官招募已启动，但预算审批延迟导致宣发物料进度滞后。" />
      </div>
      <section className="card table-card">
        <div className="table-head">
          <h3>项目跟进进度表</h3>
          <button className="button secondary" type="button" onClick={exportReport}>
            <Download size={16} />
            导出
          </button>
        </div>
        <DataTable columns={['项目名称', '关键里程碑', '截止日期', '负责人', '优先级']} rows={projectRows} statusIndex={4} />
      </section>
    </div>
  )
}

function TranscriptPage({
  transcript,
  setPage,
  openTranscript,
  exportTranscript,
}: {
  transcript: TranscriptItem[]
  setPage: (page: Page) => void
  openTranscript: (id: string) => void
  exportTranscript: () => void
}) {
  const [keyword, setKeyword] = useState('')
  const visible = transcript.filter((line) => `${line.speaker}${line.text}`.includes(keyword.trim()))

  return (
    <div className="page-stack">
      <MeetingTabs active="transcript" setPage={setPage} />
      <PageHeader
        eyebrow="会议详情"
        title="会议转写记录"
        description="2026-05-17 14:00 - 15:30"
        actions={
          <>
            <div className="inline-search">
              <Search size={15} />
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索发言" />
            </div>
            <button className="button secondary" type="button" onClick={exportTranscript}>
              <Download size={16} />
              导出
            </button>
          </>
        }
      />
      <section className="card transcript-card">
        {visible.map((line) => (
          <TranscriptLine key={line.id} line={line} editable onEdit={() => openTranscript(line.id)} />
        ))}
      </section>
    </div>
  )
}

function MeetingTodosPage({
  todos,
  setPage,
  toggleTodo,
  openTodoDrawer,
  openFilter,
}: {
  todos: ActionItem[]
  setPage: (page: Page) => void
  toggleTodo: (id: string) => void
  openTodoDrawer: (id?: string) => void
  openFilter: () => void
}) {
  return (
    <div className="page-stack">
      <MeetingTabs active="todos" setPage={setPage} />
      <PageHeader
        eyebrow="提取自会议记录"
        title="Q3 产品战略对齐 - 待办事项"
        description="用户确认后写入正式跟进清单"
        actions={
          <>
            <button className="button secondary" type="button" onClick={openFilter}>
              <Filter size={16} />
              筛选
            </button>
            <button className="button primary" type="button" onClick={() => openTodoDrawer()}>
              <Plus size={16} />
              新增待办
            </button>
          </>
        }
      />
      <section className="card task-list-card">
        <TaskList todos={todos} toggleTodo={toggleTodo} openTodoDrawer={openTodoDrawer} />
      </section>
    </div>
  )
}

function MyTodosPage({
  todos,
  view,
  setView,
  toggleTodo,
  openTodoDrawer,
  openFilter,
}: {
  todos: ActionItem[]
  view: ViewMode
  setView: (view: ViewMode) => void
  toggleTodo: (id: string) => void
  openTodoDrawer: (id?: string) => void
  openFilter: () => void
}) {
  const groups = useMemo(
    () => ({
      importantUrgent: todos.filter((item) => item.importance === 'high' && item.urgency === 'high'),
      importantNotUrgent: todos.filter((item) => item.importance === 'high' && item.urgency === 'low'),
      notImportantUrgent: todos.filter((item) => item.importance === 'low' && item.urgency === 'high'),
      notImportantNotUrgent: todos.filter((item) => item.importance === 'low' && item.urgency === 'low'),
    }),
    [todos],
  )

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Action Center"
        title="我的待办"
        description="使用重要/紧急矩阵管理跨会议线程的任务优先级。"
        actions={
          <button className="button primary" type="button" onClick={() => openTodoDrawer()}>
            <Plus size={16} />
            新建任务
          </button>
        }
      />
      <div className="view-toggle">
        <button className={view === 'matrix' ? 'active' : ''} type="button" onClick={() => setView('matrix')}>
          矩阵视图
        </button>
        <button className={view === 'list' ? 'active' : ''} type="button" onClick={() => setView('list')}>
          列表视图
        </button>
        <button type="button" onClick={openFilter}>
          <Filter size={15} />
          筛选
        </button>
      </div>
      {view === 'matrix' ? (
        <section className="matrix-grid">
          <MatrixColumn title="重要且紧急" badge="DO NOW" tone="danger" items={groups.importantUrgent} toggleTodo={toggleTodo} openTodoDrawer={openTodoDrawer} />
          <MatrixColumn title="重要不紧急" badge="SCHEDULE" tone="todo" items={groups.importantNotUrgent} toggleTodo={toggleTodo} openTodoDrawer={openTodoDrawer} />
          <MatrixColumn title="紧急不重要" badge="DELEGATE" tone="warning" items={groups.notImportantUrgent} toggleTodo={toggleTodo} openTodoDrawer={openTodoDrawer} />
          <MatrixColumn title="不重要不紧急" badge="ELIMINATE" tone="muted" items={groups.notImportantNotUrgent} toggleTodo={toggleTodo} openTodoDrawer={openTodoDrawer} />
        </section>
      ) : (
        <section className="card task-list-card">
          <TaskList todos={todos} toggleTodo={toggleTodo} openTodoDrawer={openTodoDrawer} />
        </section>
      )}
    </div>
  )
}

type ModelConfigMode = 'backend' | 'custom'

const backendModelConfig = {
  provider: 'OpenAI Compatible',
  baseUrl: '已由后端配置',
  apiKey: '已配置，前端不可见',
  model: 'gpt-5.5',
}

const initialCustomModelConfig = {
  provider: 'OpenAI Compatible',
  baseUrl: '',
  apiKey: '',
  model: 'gpt-5.5',
}

function SettingsPage({
  authToken,
  initialSettings,
  notify,
  openHelp,
  onSettingsChange,
}: {
  authToken: string | null
  initialSettings: SettingsState | null
  notify: (message: string) => void
  openHelp: () => void
  onSettingsChange: (settings: SettingsState | null) => void
}) {
  const [tested, setTested] = useState<string>('')
  const [configMode, setConfigMode] = useState<ModelConfigMode>(initialSettings?.activeSource === 'user' ? 'custom' : 'backend')
  const [customConfig, setCustomConfig] = useState(() => ({
    ...initialCustomModelConfig,
    provider: initialSettings?.custom.provider || initialCustomModelConfig.provider,
    baseUrl: initialSettings?.custom.baseUrl || initialCustomModelConfig.baseUrl,
    model: initialSettings?.custom.model || initialCustomModelConfig.model,
    apiKey: '',
  }))
  const backendConfig = initialSettings
    ? {
        provider: initialSettings.system.provider,
        baseUrl: initialSettings.system.baseUrlConfigured ? '已由后端配置' : '未配置',
        apiKey: initialSettings.system.apiKeyConfigured ? '已配置，前端不可见' : '未配置',
        model: initialSettings.system.model,
      }
    : backendModelConfig
  const isCustom = configMode === 'custom'

  const selectConfigMode = (mode: ModelConfigMode) => {
    setConfigMode(mode)
    setTested('')
  }
  const updateCustomConfig = (config: Partial<typeof initialCustomModelConfig>) => {
    setCustomConfig((current) => ({ ...current, ...config }))
    setTested('')
  }

  const testConnection = async () => {
    if (!authToken) return
    try {
      const result = await api.testSettings(authToken)
      setTested(result.ok ? `${isCustom ? '自定义配置' : '后端默认配置'}连接成功，延迟 ${result.latencyMs}ms` : result.message || '连接失败')
    } catch (error) {
      setTested(error instanceof Error ? error.message : '连接失败')
    }
  }

  const saveSettings = async () => {
    if (!authToken) return
    if (!isCustom) {
      notify('当前已使用后端默认配置')
      return
    }
    try {
      await api.saveCustomSettings(authToken, {
        provider: customConfig.provider,
        baseUrl: customConfig.baseUrl,
        model: customConfig.model,
        apiKey: customConfig.apiKey,
      })
      const latest = await api.getSettings(authToken)
      onSettingsChange(toSettingsState(latest))
      notify('自定义模型配置已保存')
    } catch (error) {
      notify(error instanceof Error ? error.message : '保存配置失败')
    }
  }

  return (
    <div className="settings-layout">
      <section className="page-stack">
        <PageHeader
          eyebrow="会议助手 v0.1"
          title="系统设置"
          description="默认使用后端统一模型服务，也可以为当前工作区配置自定义 OpenAI Compatible 服务。"
        />
        <section className="card settings-card">
          <div className="section-heading">
            <Settings size={20} />
            <div>
              <h3>模型服务配置</h3>
              <span>{isCustom ? '当前使用自定义配置，保存后由后端代理调用' : '当前使用后端默认配置'}</span>
            </div>
          </div>
          <div className="view-toggle config-toggle" aria-label="模型配置来源">
            <button className={!isCustom ? 'active' : ''} type="button" onClick={() => selectConfigMode('backend')}>
              后端默认
            </button>
            <button className={isCustom ? 'active' : ''} type="button" onClick={() => selectConfigMode('custom')}>
              自定义
            </button>
          </div>
          <div className="settings-grid">
            <label className="readonly-field">
              <span>提供商</span>
              <input
                value={isCustom ? customConfig.provider : backendConfig.provider}
                readOnly={!isCustom}
                onChange={(event) => updateCustomConfig({ provider: event.target.value })}
              />
            </label>
            <label className="readonly-field">
              <span>Base URL</span>
              <input
                value={isCustom ? customConfig.baseUrl : backendConfig.baseUrl}
                readOnly={!isCustom}
                placeholder="https://api.example.com/v1"
                onChange={(event) => updateCustomConfig({ baseUrl: event.target.value })}
              />
            </label>
            <label className="readonly-field">
              <span>API Key</span>
              <input
                value={isCustom ? customConfig.apiKey : backendConfig.apiKey}
                readOnly={!isCustom}
                type={isCustom ? 'password' : 'text'}
                placeholder="sk-..."
                onChange={(event) => updateCustomConfig({ apiKey: event.target.value })}
              />
            </label>
            <label className="readonly-field">
              <span>模型版本</span>
              <input
                value={isCustom ? customConfig.model : backendConfig.model}
                readOnly={!isCustom}
                placeholder="gpt-5.5"
                onChange={(event) => updateCustomConfig({ model: event.target.value })}
              />
            </label>
          </div>
          <div className="notice">
            <ShieldCheck size={17} />
            {isCustom
              ? '自定义配置会提交到后端保存并脱敏展示；API Key 不会在页面明文回显。'
              : '使用后端默认模型服务时，浏览器不会接触 API Key。'}
          </div>
          <div className="form-actions">
            <button className="button secondary" type="button" onClick={() => void testConnection()}>
              <RefreshCw size={16} />
              测试连接
            </button>
            <button className="button primary" type="button" onClick={() => void saveSettings()}>
              保存配置
            </button>
          </div>
          {tested && <Tag label={tested} tone={tested.includes('成功') ? 'done' : 'warning'} />}
        </section>
      </section>
      <aside className="right-rail">
        <RailCard title="配置文档" onTitleClick={openHelp}>
          <p className="rail-copy">后端默认配置适合大多数会议；自定义配置适合私有模型、企业网关或专属额度。</p>
        </RailCard>
        <RailCard title="安全提示" onTitleClick={openHelp}>
          <p className="rail-copy">自定义 API Key 应由后端加密保存，日志不能记录 Authorization token 或会议全文。</p>
        </RailCard>
      </aside>
    </div>
  )
}

function MeetingTabs({ active, setPage }: { active: 'overview' | 'transcript' | 'todos'; setPage?: (page: Page) => void }) {
  const tabs = [
    { key: 'overview', label: '会议综述', page: 'overview' as Page },
    { key: 'transcript', label: '会议详情(全量记录)', page: 'transcript' as Page },
    { key: 'todos', label: '待办事项', page: 'meeting-todos' as Page },
  ]

  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button className={active === tab.key ? 'active' : ''} key={tab.key} type="button" onClick={() => setPage?.(tab.page)}>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function TaskList({
  todos,
  toggleTodo,
  openTodoDrawer,
}: {
  todos: ActionItem[]
  toggleTodo: (id: string) => void
  openTodoDrawer: (id?: string) => void
}) {
  return (
    <div className="task-list">
      <div className="task-row task-labels">
        <span>任务描述</span>
        <span>优先级</span>
        <span>状态</span>
        <span>负责人</span>
        <span>截止日期</span>
        <span>操作</span>
      </div>
      {todos.map((todo) => (
        <div className={`task-row ${todo.status === 'done' ? 'completed' : ''}`} key={todo.id}>
          <button className="todo-title-button" type="button" onClick={() => toggleTodo(todo.id)}>
            <span className="todo-check">{todo.status === 'done' && <Check size={13} />}</span>
            <span>{todo.title}</span>
          </button>
          <Tag label={todo.priority} tone={priorityTone[todo.priority]} />
          <Tag label={statusText(todo.status)} tone={statusTone(todo.status)} />
          <span>{todo.owner}</span>
          <span>{todo.due}</span>
          <button className="ghost-icon" type="button" aria-label="编辑待办" onClick={() => openTodoDrawer(todo.id)}>
            <Edit3 size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}

function TodoSummary({ todos }: { todos: ActionItem[] }) {
  return (
    <div className="todo-summary">
      <StatCard label="全部待办" value={String(todos.length)} icon={<ClipboardList size={22} />} />
      <StatCard label="未完成" value={String(todos.filter((todo) => todo.status !== 'done').length)} tone="todo" icon={<Clock3 size={22} />} />
      <StatCard label="已完成" value={String(todos.filter((todo) => todo.status === 'done').length)} tone="done" icon={<CheckCircle2 size={22} />} />
    </div>
  )
}

function Modal({
  kind,
  close,
  saveThread,
  saveMeeting,
  threads,
  selectedThreadId,
  exportCurrent,
}: {
  kind: ModalKind
  close: () => void
  saveThread: (title: string, summary: string) => void
  saveMeeting: (title: string, threadId?: string, newThread?: { title: string; summary: string }) => void
  threads: Thread[]
  selectedThreadId: string
  exportCurrent: () => void
}) {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [meetingTitle, setMeetingTitle] = useState('')
  const [newThreadTitle, setNewThreadTitle] = useState('')
  const [newThreadSummary, setNewThreadSummary] = useState('')
  const [threadId, setThreadId] = useState(selectedThreadId)

  if (!kind) return null

  const titleMap: Record<Exclude<ModalKind, null>, string> = {
    'new-thread': '创建议题文件夹',
    'new-meeting': '新建会议',
    notifications: '通知',
    help: '帮助',
    export: '导出',
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true" aria-label={titleMap[kind]}>
        <div className="modal-head">
          <h2>{titleMap[kind]}</h2>
          <button className="ghost-icon" type="button" onClick={close} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        {kind === 'new-thread' && (
          <div className="form-grid">
            <label>
              议题文件夹名称
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：客户 A 项目推进" />
            </label>
            <label>
              背景说明
              <textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="这组会议主要追踪什么？" />
            </label>
            <button className="button primary wide" type="button" onClick={() => saveThread(title || '未命名议题文件夹', summary.trim())}>
              创建议题
            </button>
          </div>
        )}
        {kind === 'new-meeting' && (
          <div className="form-grid">
            <label>
              归入议题
              <select value={threadId} onChange={(event) => setThreadId(event.target.value)}>
                <option value="">不归入议题（独立会议）</option>
                <option value={NEW_THREAD_OPTION}>新建议题</option>
                {threads.map((thread) => (
                  <option value={thread.id} key={thread.id}>
                    {thread.title}
                  </option>
                ))}
              </select>
            </label>
            {threadId === NEW_THREAD_OPTION && (
              <>
                <label>
                  议题名称
                  <input value={newThreadTitle} onChange={(event) => setNewThreadTitle(event.target.value)} placeholder="例如：客户 A 项目推进" />
                </label>
                <label>
                  背景说明
                  <textarea value={newThreadSummary} onChange={(event) => setNewThreadSummary(event.target.value)} placeholder="这组会议主要追踪什么？" />
                </label>
              </>
            )}
            <label>
              会议标题
              <input value={meetingTitle} onChange={(event) => setMeetingTitle(event.target.value)} placeholder="例如：5 月 17 日周会" />
            </label>
            <button
              className="button primary wide"
              type="button"
              onClick={() =>
                saveMeeting(
                  meetingTitle || '未命名会议',
                  threadId,
                  threadId === NEW_THREAD_OPTION
                    ? { title: newThreadTitle || meetingTitle || '未命名议题', summary: newThreadSummary }
                    : undefined,
                )
              }
            >
              创建会议
            </button>
          </div>
        )}
        {kind === 'notifications' && (
          <div className="notification-list">
            <p>3 个待办将在 3 天内到期。</p>
            <p>AI 已生成最新会后草稿，可进入会议综述确认。</p>
          </div>
        )}
        {kind === 'help' && (
          <div className="help-list">
            <p>议题像文件夹，会议像文件；同一议题下的后续会议会继承前序会议上下文。</p>
            <p>待办可以从任何位置完成或编辑，后续会接入后端 API。</p>
            <p>设置页不会显示或保存模型 API Key。</p>
          </div>
        )}
        {kind === 'export' && (
          <div className="form-grid">
            <p>导出当前会议报告、待办和关键结论为 JSON 文件。</p>
            <button className="button primary wide" type="button" onClick={exportCurrent}>
              导出 JSON
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function Drawer({
  kind,
  close,
  briefing,
  saveBriefing,
  todo,
  saveTodo,
  filters,
  setFilters,
  transcript,
  saveTranscript,
}: {
  kind: DrawerKind
  close: () => void
  briefing: typeof initialBriefing
  saveBriefing: (briefing: typeof initialBriefing) => void
  todo?: ActionItem
  saveTodo: (todo: ActionItem) => void
  filters: { status: string; priority: string }
  setFilters: (filters: { status: string; priority: string }) => void
  transcript?: TranscriptItem
  saveTranscript: (item: TranscriptItem) => void
}) {
  const [draftBriefing, setDraftBriefing] = useState(briefing)
  const [draftTodo, setDraftTodo] = useState<ActionItem>(todo ?? emptyTodo())
  const [draftTranscript, setDraftTranscript] = useState<TranscriptItem>(transcript ?? emptyTranscript())

  if (!kind) return null

  const titleMap: Record<Exclude<DrawerKind, null>, string> = {
    briefing: '编辑简报',
    todo: todo ? '编辑待办' : '新建待办',
    filters: '筛选',
    meeting: '编辑会议综述',
    transcript: '编辑转写片段',
  }

  return (
    <div className="drawer-backdrop" role="presentation" onClick={close}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={titleMap[kind]} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>{titleMap[kind]}</h2>
          <button className="ghost-icon" type="button" onClick={close} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        {kind === 'briefing' && (
          <div className="form-grid">
            <label>
              建议关注
              <textarea value={draftBriefing.focus} onChange={(event) => setDraftBriefing({ ...draftBriefing, focus: event.target.value })} />
            </label>
            <EditableList label="建议议程" items={draftBriefing.agenda} onChange={(agenda) => setDraftBriefing({ ...draftBriefing, agenda })} />
            <EditableList label="上次共识" items={draftBriefing.consensus} onChange={(consensus) => setDraftBriefing({ ...draftBriefing, consensus })} />
            <EditableList label="遗留问题" items={draftBriefing.questions} onChange={(questions) => setDraftBriefing({ ...draftBriefing, questions })} />
            <button className="button primary wide" type="button" onClick={() => saveBriefing(draftBriefing)}>
              保存简报
            </button>
          </div>
        )}
        {kind === 'todo' && (
          <div className="form-grid">
            <label>
              任务描述
              <input value={draftTodo.title} onChange={(event) => setDraftTodo({ ...draftTodo, title: event.target.value })} />
            </label>
            <label>
              负责人
              <input value={draftTodo.owner} onChange={(event) => setDraftTodo({ ...draftTodo, owner: event.target.value })} />
            </label>
            <label>
              截止日期
              <input value={draftTodo.due} onChange={(event) => setDraftTodo({ ...draftTodo, due: event.target.value })} />
            </label>
            <label>
              优先级
              <select value={draftTodo.priority} onChange={(event) => setDraftTodo({ ...draftTodo, priority: event.target.value as Priority })}>
                <option>P0</option>
                <option>P1</option>
                <option>P2</option>
                <option>P3</option>
              </select>
            </label>
            <label>
              状态
              <select value={draftTodo.status} onChange={(event) => setDraftTodo({ ...draftTodo, status: event.target.value as TodoStatus })}>
                <option value="pending">待处理</option>
                <option value="in_progress">进行中</option>
                <option value="done">已完成</option>
                <option value="canceled">已取消</option>
              </select>
            </label>
            <button className="button primary wide" type="button" onClick={() => saveTodo({ ...draftTodo, title: draftTodo.title || '未命名待办' })}>
              保存待办
            </button>
          </div>
        )}
        {kind === 'filters' && (
          <div className="form-grid">
            <label>
              状态
              <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                <option value="all">全部</option>
                <option value="pending">待处理</option>
                <option value="in_progress">进行中</option>
                <option value="done">已完成</option>
                <option value="canceled">已取消</option>
              </select>
            </label>
            <label>
              优先级
              <select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}>
                <option value="all">全部</option>
                <option value="P0">P0</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
              </select>
            </label>
            <button className="button primary wide" type="button" onClick={close}>
              应用筛选
            </button>
          </div>
        )}
        {kind === 'meeting' && (
          <div className="form-grid">
            <label>
              核心总结
              <textarea defaultValue="在 Q3，我们必须将重点从单纯的功能堆砌转移到用户体验的深度打磨上。" />
            </label>
            <button className="button primary wide" type="button" onClick={close}>
              保存会议综述
            </button>
          </div>
        )}
        {kind === 'transcript' && (
          <div className="form-grid">
            <label>
              发言人
              <input value={draftTranscript.speaker} onChange={(event) => setDraftTranscript({ ...draftTranscript, speaker: event.target.value })} />
            </label>
            <label>
              内容
              <textarea value={draftTranscript.text} onChange={(event) => setDraftTranscript({ ...draftTranscript, text: event.target.value })} />
            </label>
            <button className="button primary wide" type="button" onClick={() => saveTranscript(draftTranscript)}>
              保存转写
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}

function EditableList({ label, items, onChange }: { label: string; items: string[]; onChange: (items: string[]) => void }) {
  return (
    <div className="editable-list">
      <span>{label}</span>
      {items.map((item, index) => (
        <input
          key={`${label}-${index}`}
          value={item}
          onChange={(event) => onChange(items.map((current, currentIndex) => (currentIndex === index ? event.target.value : current)))}
        />
      ))}
      <button className="button secondary" type="button" onClick={() => onChange([...items, ''])}>
        <Plus size={14} />
        新增一条
      </button>
    </div>
  )
}

function LogoBlock() {
  return (
    <div className="logo-block">
      <div className="logo-mark">
        <MessageSquareText size={18} />
      </div>
      <div>
        <strong>会议助手</strong>
        <span>Meeting OS</span>
      </div>
    </div>
  )
}

function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

function Breadcrumb({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button className="breadcrumb" type="button" onClick={onBack}>
      <ArrowLeft size={16} />
      {label}
    </button>
  )
}

function StatCard({ label, value, tone = 'neutral', icon }: { label: string; value: string; tone?: string; icon: React.ReactNode }) {
  return (
    <section className={`card stat-card ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <i>{icon}</i>
    </section>
  )
}

function TwoColumnList({ title, items, numbered = false }: { title: string; items: string[]; numbered?: boolean }) {
  return (
    <div className="brief-section">
      <h4>{title}</h4>
      <div className="brief-items">
        {items.map((item, index) => (
          <div className="brief-item" key={`${title}-${item}`}>
            {numbered ? <b>{index + 1}</b> : <CheckCircle2 size={16} />}
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RailCard({
  title,
  count,
  children,
  onTitleClick,
}: {
  title: string
  count?: string
  children: React.ReactNode
  onTitleClick?: () => void
}) {
  const HeaderTag = onTitleClick ? 'button' : 'div'
  return (
    <section className="card rail-card">
      <HeaderTag
        className={`rail-title ${onTitleClick ? 'interactive' : ''}`}
        {...(onTitleClick ? { type: 'button' as const, onClick: onTitleClick } : {})}
      >
        <h3>{title}</h3>
        {count && <Tag label={count} tone="todo" />}
      </HeaderTag>
      <div className="rail-body">{children}</div>
    </section>
  )
}

function MiniTodo({ item, onClick }: { item: ActionItem; onClick: () => void }) {
  return (
    <button className="mini-todo" type="button" onClick={onClick}>
      <span>{item.title}</span>
      <small>
        {item.owner} · {item.due} · {item.priority}
      </small>
    </button>
  )
}

function MiniMeeting({ meeting, onClick }: { meeting: MeetingRecord; onClick: () => void }) {
  return (
    <button className="mini-meeting" type="button" onClick={onClick}>
      <CalendarDays size={16} />
      <span>{meeting.title}</span>
      <small>
        {meeting.date} · {meeting.time} · {meeting.todoCount} 个待办
      </small>
    </button>
  )
}

function TranscriptLine({
  line,
  live,
  editable,
  onEdit,
}: {
  line: TranscriptItem
  live?: boolean
  editable?: boolean
  onEdit?: () => void
}) {
  return (
    <article className={`transcript-line ${live ? 'live' : ''}`}>
      <div className="speaker-avatar">{line.speaker.slice(0, 1)}</div>
      <div>
        <div className="speaker-meta">
          <strong>{line.speaker}</strong>
          <span>{line.role}</span>
          <time>{line.time}</time>
          {live && <Tag label="实时" tone="todo" />}
        </div>
        <p>{line.text}</p>
      </div>
      {editable && (
        <button className="ghost-icon" type="button" aria-label="编辑转写片段" onClick={onEdit}>
          <Edit3 size={15} />
        </button>
      )}
    </article>
  )
}

function ProgressStep({ label, state, done, active }: { label: string; state: string; done?: boolean; active?: boolean }) {
  return (
    <div className={`progress-step ${active ? 'active' : ''}`}>
      {done ? <CheckCircle2 size={18} /> : active ? <RefreshCw size={18} /> : <Circle size={18} />}
      <span>{label}</span>
      <small>{state}</small>
    </div>
  )
}

function ProjectCard({ icon, title, tag, text, tone }: { icon: React.ReactNode; title: string; tag: Priority; text: string; tone?: string }) {
  return (
    <section className="card project-card">
      <div className="project-head">
        <i>{icon}</i>
        <Tag label={tag} tone={tone ?? priorityTone[tag]} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      <small>负责人：张三 · 优先级：{tag}</small>
    </section>
  )
}

function DataTable({ columns, rows, statusIndex }: { columns: string[]; rows: string[][]; statusIndex?: number }) {
  return (
    <div className="data-table">
      <div className="data-row data-labels">
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      {rows.map((row) => (
        <div className="data-row" key={row.join('-')}>
          {row.map((cell, index) => (
            <span key={`${cell}-${index}`}>
              {index === statusIndex ? <Tag label={cell} tone={priorityTone[cell as Priority] ?? 'muted'} /> : cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

function MatrixColumn({
  title,
  badge,
  tone,
  items,
  toggleTodo,
  openTodoDrawer,
}: {
  title: string
  badge: string
  tone: string
  items: ActionItem[]
  toggleTodo: (id: string) => void
  openTodoDrawer: (id?: string) => void
}) {
  return (
    <section className={`card matrix-column ${tone}`}>
      <div className="matrix-head">
        <div>
          <h3>{title}</h3>
          <Tag label={badge} tone={tone} />
        </div>
        <span>{items.length} 个任务</span>
      </div>
      <div className="matrix-list">
        {items.map((item) => (
          <article className={`todo-card ${item.status === 'done' ? 'completed' : ''}`} key={item.id}>
            <div>
              <button className="todo-title-button" type="button" onClick={() => toggleTodo(item.id)}>
                <span className="todo-check">{item.status === 'done' && <Check size={13} />}</span>
                <h4>{item.title}</h4>
              </button>
              <button className="ghost-icon" type="button" aria-label="编辑待办" onClick={() => openTodoDrawer(item.id)}>
                <MoreHorizontal size={16} />
              </button>
            </div>
            <div className="keyword-row">
              <Tag label={item.priority} tone={priorityTone[item.priority]} />
              <span className="deadline">
                <Clock3 size={13} />
                {item.due}
              </span>
            </div>
            <small>负责人：{item.owner}</small>
          </article>
        ))}
      </div>
    </section>
  )
}

function Tag({ label, tone = 'muted' }: { label: string; tone?: string }) {
  return <span className={`tag ${tone}`}>{label}</span>
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}

function statusText(status: TodoStatus) {
  return { pending: '待处理', in_progress: '进行中', done: '已完成', canceled: '已取消' }[status]
}

function statusTone(status: TodoStatus) {
  return { pending: 'todo', in_progress: 'warning', done: 'done', canceled: 'muted' }[status]
}

function matchesTodoFilters(todo: ActionItem, filters: { status: string; priority: string }) {
  const statusOk = filters.status === 'all' || todo.status === filters.status
  const priorityOk = filters.priority === 'all' || todo.priority === filters.priority
  return statusOk && priorityOk
}

function isStandaloneThread(thread: Thread) {
  return thread.summary === STANDALONE_THREAD_BACKGROUND || thread.title === STANDALONE_THREAD_TITLE
}

function sortMeetings(items: MeetingRecord[]) {
  return [...items].sort((a, b) => getMeetingTime(b) - getMeetingTime(a))
}

function getMeetingTime(meeting: MeetingRecord) {
  const explicitTime = Date.parse(meeting.sortAt)
  if (!Number.isNaN(explicitTime)) return explicitTime
  const firstTime = meeting.time.split(' ')[0] || '00:00'
  const inferredTime = Date.parse(`${meeting.date}T${firstTime}`)
  return Number.isNaN(inferredTime) ? 0 : inferredTime
}

function meetingCreatedAt(meeting: MeetingRecord) {
  return meeting.time === '待安排' ? meeting.date : `${meeting.date} ${meeting.time}`
}

function displayParticipants(value: string) {
  return value === '当前账号上下文' ? '我' : value
}

function displayThreadSummary(value: string) {
  return value === '暂无背景说明' ? '' : value
}

function toThread(item: ThreadListItem): Thread {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary || item.background || '',
    risk: item.risk ?? item.highRiskCount ?? 0,
    updatedAt: formatDateTime(item.updatedAt),
    members: ['我'],
  }
}

function toThreadLike(item: { id: string; title: string; background?: string }): Thread {
  return {
    id: item.id,
    title: item.title,
    summary: item.background || '',
    risk: 0,
    updatedAt: '刚刚',
    members: ['我'],
  }
}

function toMeetingRecord(
  item:
    | SessionDetailResponse
    | {
        id: string
        title: string
        status?: string
        summary?: string
        startedAt?: string | null
        endedAt?: string | null
        createdAt?: string
        updatedAt?: string
        todoCount?: number
      },
): MeetingRecord {
  const baseTime = item.startedAt || item.createdAt || item.updatedAt || new Date().toISOString()
  return {
    id: item.id,
    title: item.title,
    date: formatDateOnly(baseTime),
    time: formatTimeRange(item.startedAt, item.endedAt),
    sortAt: baseTime,
    participants: '当前账号上下文',
    todoCount: item.todoCount ?? 0,
  }
}

function toBriefing(data: PreparationResponse) {
  return {
    focus: data.suggestedFocus?.join('；') || '请确认本次会议的关键目标、风险和负责人。',
    agenda: data.suggestedAgenda?.length ? data.suggestedAgenda : ['同步上次待办进展', '确认本次关键决策'],
    consensus: data.lastConsensus ?? [],
    decisions: data.lastDecisions ?? [],
    questions: data.openQuestions ?? [],
  }
}

function toPreparationSnapshot(briefing: typeof initialBriefing) {
  return {
    lastConsensus: briefing.consensus,
    lastDecisions: briefing.decisions,
    openActionItems: [],
    progressUpdates: [],
    openQuestions: briefing.questions,
    risks: [],
    suggestedFocus: briefing.focus ? [briefing.focus] : [],
    suggestedAgenda: briefing.agenda,
    manualNotes: [],
    warnings: [],
  }
}

function toTranscript(item: SessionDetailResponse['transcriptSegments'][number]): TranscriptItem {
  return {
    id: item.id,
    speaker: item.speakerText || 'Speaker 1',
    role: item.source === 'edited' ? '已编辑' : item.source === 'manual' ? '手动记录' : '实时转写',
    time: formatClock(item.startedAt || item.endedAt || new Date().toISOString()),
    text: item.text,
  }
}

function toTodo(item: Record<string, unknown>): ActionItem {
  const priority = normalizePriority(stringValue(item.priority))
  const status = normalizeTodoStatus(stringValue(item.status))
  return {
    id: stringValue(item.id) || `todo-${Date.now()}`,
    title: stringValue(item.title) || stringValue(item.description) || '未命名待办',
    owner: stringValue(item.owner) || stringValue(item.ownerText) || '待确认',
    due: stringValue(item.due) || stringValue(item.dueDate) || '待定',
    priority,
    status,
    importance: stringValue(item.importance) === 'high' ? 'high' : 'low',
    urgency: stringValue(item.urgency) === 'high' ? 'high' : 'low',
    threadId: stringValue(item.threadId),
    meetingId: stringValue(item.meetingId) || stringValue(item.sessionId),
    risk: normalizeRisk(stringValue(item.risk) || stringValue(item.riskLevel)),
  }
}

function mergeTodos(current: ActionItem[], incoming: ActionItem[]) {
  const byId = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => {
    byId.set(item.id, item)
  })
  return [...byId.values()]
}

function toSettingsState(data: LlmSettingsResponse): SettingsState {
  return {
    system: {
      provider: data.provider,
      baseUrlConfigured: data.baseUrlConfigured,
      model: data.model,
      apiKeyConfigured: data.apiKeyConfigured,
    },
    custom: {
      provider: data.custom.provider,
      baseUrl: data.custom.baseUrl,
      model: data.custom.model,
      apiKeyConfigured: data.custom.apiKeyConfigured,
    },
    activeSource: data.activeSource,
  }
}

function normalizePriority(value: string): Priority {
  const upper = value.toUpperCase()
  if (upper === 'P0' || upper === 'URGENT') return 'P0'
  if (upper === 'P1' || upper === 'HIGH') return 'P1'
  if (upper === 'P2' || upper === 'MEDIUM') return 'P2'
  return 'P3'
}

function normalizeTodoStatus(value: string): TodoStatus {
  if (value === 'done') return 'done'
  if (value === 'in_progress') return 'in_progress'
  if (value === 'canceled') return 'canceled'
  return 'pending'
}

function normalizeRisk(value: string): ActionItem['risk'] {
  if (value === 'high_risk') return 'high_risk'
  if (value === 'at_risk') return 'at_risk'
  return 'normal'
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function formatDateTime(value?: string | null) {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatDateOnly(value?: string | null) {
  if (!value) return '待定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatClock(value?: string | null) {
  if (!value) return '00:00:00'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainingSeconds = safeSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function downsampleToPcm16(input: Float32Array, inputSampleRate: number, outputSampleRate: number) {
  if (outputSampleRate === inputSampleRate) return floatToPcm16(input)
  const sampleRateRatio = inputSampleRate / outputSampleRate
  const outputLength = Math.floor(input.length / sampleRateRatio)
  const output = new Int16Array(outputLength)
  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * sampleRateRatio)
    const end = Math.min(Math.floor((index + 1) * sampleRateRatio), input.length)
    let sum = 0
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      sum += input[sampleIndex]
    }
    const average = sum / Math.max(1, end - start)
    output[index] = clampPcmSample(average)
  }
  return output
}

function floatToPcm16(input: Float32Array) {
  const output = new Int16Array(input.length)
  for (let index = 0; index < input.length; index += 1) {
    output[index] = clampPcmSample(input[index])
  }
  return output
}

function clampPcmSample(sample: number) {
  const clamped = Math.max(-1, Math.min(1, sample))
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
}

function concatInt16Arrays(left: Int16Array, right: Int16Array) {
  const output = new Int16Array(left.length + right.length)
  output.set(left, 0)
  output.set(right, left.length)
  return output
}

function stringFromUnknown(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function formatTimeRange(start?: string | null, end?: string | null) {
  if (!start && !end) return '待安排'
  return `${formatClock(start)} - ${formatClock(end)}`
}

function emptyTodo(): ActionItem {
  return {
    id: `todo-${Date.now()}`,
    title: '',
    owner: '我',
    due: '2026-05-25',
    priority: 'P2',
    status: 'pending',
    importance: 'high',
    urgency: 'low',
    threadId: 'thread-q1',
    meetingId: 'meeting-budget',
    risk: 'normal',
  }
}

function emptyTranscript(): TranscriptItem {
  return { id: `tr-${Date.now()}`, speaker: '', role: '', time: '', text: '' }
}

export default App
