import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  Edit3,
  FileText,
  Filter,
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
  X,
} from 'lucide-react'
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
    participants: '张三、李四、王五、赵六等 8 人',
    todoCount: 5,
  },
  {
    id: 'meeting-weekly',
    title: '11 月 13 日 周度同步例会',
    date: '2026-05-10',
    time: '10:00 - 11:00',
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
  const [threads, setThreads] = useState(initialThreads)
  const [todos, setTodos] = useState(initialTodos)
  const [transcript, setTranscript] = useState(initialTranscript)
  const [briefing, setBriefing] = useState(initialBriefing)
  const [selectedThreadId, setSelectedThreadId] = useState(initialThreads[0].id)
  const [selectedMeeting, setSelectedMeeting] = useState(meetings[0])
  const [modal, setModal] = useState<ModalKind>(null)
  const [drawer, setDrawer] = useState<DrawerKind>(null)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [editingTranscriptId, setEditingTranscriptId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [todoView, setTodoView] = useState<ViewMode>('matrix')
  const [filters, setFilters] = useState({ status: 'all', priority: 'all' })

  const activeThread = threads.find((thread) => thread.id === selectedThreadId) ?? threads[0]
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

  const toggleTodo = (id: string) => {
    setTodos((items) =>
      items.map((item) =>
        item.id === id ? { ...item, status: item.status === 'done' ? 'pending' : 'done' } : item,
      ),
    )
  }

  const saveTodo = (todo: ActionItem) => {
    setTodos((items) => {
      const exists = items.some((item) => item.id === todo.id)
      return exists ? items.map((item) => (item.id === todo.id ? todo : item)) : [todo, ...items]
    })
    setDrawer(null)
    notify('待办已保存')
  }

  const saveThread = (title: string, summary: string) => {
    setThreads((items) => [
      {
        id: `thread-${Date.now()}`,
        title,
        summary,
        risk: 0,
        updatedAt: '刚刚',
        members: [userName.slice(0, 1)],
      },
      ...items,
    ])
    setModal(null)
    notify('会议议题已创建')
  }

  const saveMeeting = (title: string) => {
    setSelectedMeeting({
      id: `meeting-${Date.now()}`,
      title,
      date: '2026-05-17',
      time: '待安排',
      participants: `${userName} 等 1 人`,
      todoCount: 0,
    })
    setModal(null)
    setPage('overview')
    notify('会议已创建')
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

  if (page === 'login') {
    return <LoginPage userName={userName} setUserName={setUserName} onEnter={() => setPage('threads')} />
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
            threads={threads}
            todos={todos}
            query={query}
            setPage={setPage}
            selectThread={(threadId) => setSelectedThreadId(threadId)}
            openModal={setModal}
            openFilter={() => setDrawer('filters')}
            filters={filters}
          />
        )}
        {page === 'briefing' && (
          <BriefingPage
            thread={activeThread}
            briefing={briefing}
            todos={todos.filter((todo) => todo.threadId === activeThread.id)}
            meetings={meetings}
            setPage={setPage}
            openTodoDrawer={openTodoDrawer}
            openBriefing={() => setDrawer('briefing')}
            openMeeting={(meeting) => {
              setSelectedMeeting(meeting)
              setPage('overview')
            }}
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
        {page === 'live' && <LiveMeetingPage transcript={transcript} setPage={setPage} notify={notify} />}
        {page === 'ai-progress' && <AiProgressPage setPage={setPage} />}
        {page === 'overview' && (
          <OverviewPage
            meeting={selectedMeeting}
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
        {page === 'settings' && <SettingsPage notify={notify} openHelp={() => setModal('help')} />}
      </AppShell>

      <Modal
        key={`modal-${modal}`}
        kind={modal}
        close={() => setModal(null)}
        saveThread={saveThread}
        saveMeeting={saveMeeting}
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
        saveTranscript={(item) => {
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
    { key: 'threads' as Page, label: '会议议题', icon: LayoutDashboard },
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
            <button className="button primary" type="button" onClick={() => openModal('new-meeting')}>
              <Plus size={16} />
              新建会议
            </button>
          </div>
        </header>
        <div className="content">{children}</div>
      </section>
    </main>
  )
}

function ThreadsPage({
  threads,
  todos,
  query,
  setPage,
  selectThread,
  openModal,
  openFilter,
  filters,
}: {
  threads: Thread[]
  todos: ActionItem[]
  query: string
  setPage: (page: Page) => void
  selectThread: (threadId: string) => void
  openModal: (kind: ModalKind) => void
  openFilter: () => void
  filters: { status: string; priority: string }
}) {
  const visibleThreads = threads.filter((thread) => {
    const matchesQuery = `${thread.title}${thread.summary}`.includes(query.trim())
    const filtersAreDefault = filters.status === 'all' && filters.priority === 'all'
    const hasFilteredTodos =
      filtersAreDefault || todos.some((todo) => todo.threadId === thread.id && matchesTodoFilters(todo, filters))
    return matchesQuery && hasFilteredTodos
  })
  const openTodoCount = todos.filter((todo) => todo.status !== 'done').length

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Workspace"
        title="会议议题"
        description="从连续会议线程开始，把会前背景、会中记录和会后跟进串起来。"
        actions={
          <button className="button primary" type="button" onClick={() => openModal('new-thread')}>
            <Plus size={16} />
            新建议题
          </button>
        }
      />
      <div className="stats-grid">
        <StatCard label="议题总数" value={String(threads.length)} icon={<FileText size={22} />} />
        <StatCard label="严重卡点议题" value={String(threads.filter((thread) => thread.risk >= 3).length)} tone="danger" icon={<AlertTriangle size={22} />} />
        <StatCard label="待处理事项" value={String(openTodoCount)} tone="todo" icon={<ClipboardList size={22} />} />
      </div>
      <section className="card table-card">
        <div className="table-head">
          <h3>最近会议议题</h3>
          <button className="button secondary" type="button" onClick={openFilter}>
            <Filter size={16} />
            筛选
          </button>
        </div>
        <div className="thread-table">
          <div className="table-row table-labels">
            <span>议题名称</span>
            <span>待办</span>
            <span>风险</span>
            <span>最后更新</span>
            <span>参与成员</span>
          </div>
          {visibleThreads.map((thread) => (
            <button
              className="table-row thread-row"
              key={thread.id}
              type="button"
              onClick={() => {
                selectThread(thread.id)
                setPage('briefing')
              }}
            >
              <span className="thread-title-cell">
                <FileText size={18} />
                <span>
                  <strong>{thread.title}</strong>
                  <small>{thread.summary}</small>
                </span>
              </span>
              <span>{todos.filter((todo) => todo.threadId === thread.id && todo.status !== 'done').length}</span>
              <span className={thread.risk > 2 ? 'risk-number' : ''}>{thread.risk}</span>
              <span>{thread.updatedAt}</span>
              <span className="member-stack">{thread.members.map((item) => <i key={item}>{item}</i>)}</span>
            </button>
          ))}
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
}: {
  thread: Thread
  briefing: typeof initialBriefing
  todos: ActionItem[]
  meetings: MeetingRecord[]
  setPage: (page: Page) => void
  openTodoDrawer: (id?: string) => void
  openBriefing: () => void
  openMeeting: (meeting: MeetingRecord) => void
}) {
  return (
    <div className="briefing-layout">
      <section className="page-stack">
        <Breadcrumb onBack={() => setPage('threads')} label="会议议题 / 返回" />
        <PageHeader
          eyebrow="2026-05-17"
          title={thread.title}
          description="会前简报已基于历史会议、待办、风险和遗留问题动态生成。"
          actions={
            <>
              <button className="button secondary no-wrap" type="button" onClick={openBriefing}>
                <Edit3 size={16} />
                编辑简报
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
        <RailCard title="会议记录" count={String(meetings.length)} onTitleClick={() => openMeeting(meetings[0])}>
          {meetings.map((meeting) => (
            <MiniMeeting key={meeting.id} meeting={meeting} onClick={() => openMeeting(meeting)} />
          ))}
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
      <Breadcrumb onBack={() => setPage('briefing')} label={`会议议题 / ${thread.title} / 关联待办`} />
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
  setPage,
  notify,
}: {
  transcript: TranscriptItem[]
  setPage: (page: Page) => void
  notify: (message: string) => void
}) {
  const [paused, setPaused] = useState(false)
  const [assistantText, setAssistantText] = useState('您好，我正在旁听会议。您可以随时向我提问，或者让我帮您整理纪要和待办。')
  const [question, setQuestion] = useState('')

  const ask = (text: string) => {
    setAssistantText(`根据当前会议内容：${text}。我已经整理出 2 个需要补负责人或截止时间的事项。`)
    setQuestion('')
  }

  return (
    <div className="live-layout">
      <section className="card live-main">
        <div className="live-top">
          <div>
            <span className="eyebrow">Workspace</span>
            <h2>2024Q1 战略执行与部门协同议题</h2>
          </div>
          <div className="recording-clock">
            <span className={`pulse-dot ${paused ? 'paused' : ''}`} />
            {paused ? '已暂停' : '01:24:15'}
          </div>
        </div>
        <div className="recorder-strip">
          <div className="mic-orb">
            <Mic size={26} />
          </div>
          <div>
            <strong>实时语音转写</strong>
            <span>{paused ? '录音已暂停，可继续手动补充内容' : '高清模式已开启'}</span>
          </div>
          <button className="button secondary" type="button" onClick={() => setPaused((value) => !value)}>
            <PauseCircle size={16} />
            {paused ? '继续录音' : '暂停录音'}
          </button>
          <button className="button danger" type="button" onClick={() => setPage('ai-progress')}>
            <StopCircle size={16} />
            结束会议
          </button>
        </div>
        <div className="transcript-stream">
          {transcript.map((line, index) => (
            <TranscriptLine key={line.id} line={line} live={!paused && index === transcript.length - 1} />
          ))}
        </div>
      </section>
      <aside className="card assistant-panel">
        <div className="assistant-head">
          <div>
            <Bot size={19} />
            <strong>会议 AI 助手</strong>
          </div>
          <span>{paused ? '等待继续' : '实时分析中'}</span>
        </div>
        <div className="quick-prompts">
          {['总结刚才张总的发言重点', '提取目前已确定的待办事项', '分析市场部和研发部的核心分歧点'].map((item) => (
            <button key={item} type="button" onClick={() => ask(item)}>
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
            onClick={() => (question.trim() ? ask(question) : notify('先输入一个问题'))}
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
  setPage,
  openDrawer,
  exportReport,
}: {
  meeting: MeetingRecord
  setPage: (page: Page) => void
  openDrawer: (kind: DrawerKind) => void
  exportReport: () => void
}) {
  return (
    <div className="page-stack report-page">
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
        <blockquote>
          在 Q3，我们必须将重点从单纯的功能堆砌转移到用户体验的深度打磨上。产品功能优化是基础，但商业模式创新和精准市场推广才是突破增长瓶颈的关键。
        </blockquote>
        <div className="keyword-row">
          <Tag label="用户体验升级" tone="todo" />
          <Tag label="商业化提速" tone="warning" />
          <Tag label="数据驱动决策" tone="done" />
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

function SettingsPage({ notify, openHelp }: { notify: (message: string) => void; openHelp: () => void }) {
  const [tested, setTested] = useState(false)

  return (
    <div className="settings-layout">
      <section className="page-stack">
        <PageHeader
          eyebrow="会议助手 v0.1"
          title="系统设置"
          description="查看后端模型服务配置状态。API Key 只来自部署环境变量，不在前端录入。"
        />
        <section className="card settings-card">
          <div className="section-heading">
            <Settings size={20} />
            <div>
              <h3>模型服务配置</h3>
              <span>OpenAI Compatible，后端统一封装调用</span>
            </div>
          </div>
          <div className="settings-grid">
            <ReadonlyField label="提供商" value="OpenAI Compatible" />
            <ReadonlyField label="Base URL" value="已由后端配置" />
            <ReadonlyField label="API Key" value="已配置，前端不可见" />
            <ReadonlyField label="模型版本" value="gpt-5.5" />
          </div>
          <div className="notice">
            <ShieldCheck size={17} />
            配置更改应在后端环境完成；前端只展示脱敏状态和连接测试结果。
          </div>
          <div className="form-actions">
            <button className="button secondary" type="button" onClick={() => setTested(true)}>
              <RefreshCw size={16} />
              测试连接
            </button>
            <button className="button primary" type="button" onClick={() => notify('展示偏好已保存')}>
              保存展示偏好
            </button>
          </div>
          {tested && <Tag label="连接成功，延迟 820ms" tone="done" />}
        </section>
      </section>
      <aside className="right-rail">
        <RailCard title="配置文档" onTitleClick={openHelp}>
          <p className="rail-copy">模型配置通过后端环境变量读取，避免 API Key 暴露给浏览器。</p>
        </RailCard>
        <RailCard title="安全提示" onTitleClick={openHelp}>
          <p className="rail-copy">日志不能记录完整 prompt、会议全文、Authorization token 或模型输出全文。</p>
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
  exportCurrent,
}: {
  kind: ModalKind
  close: () => void
  saveThread: (title: string, summary: string) => void
  saveMeeting: (title: string) => void
  exportCurrent: () => void
}) {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')

  if (!kind) return null

  const titleMap: Record<Exclude<ModalKind, null>, string> = {
    'new-thread': '新建议题',
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
              议题名称
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：客户 A 项目推进" />
            </label>
            <label>
              背景说明
              <textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="这组会议主要追踪什么？" />
            </label>
            <button className="button primary wide" type="button" onClick={() => saveThread(title || '未命名会议议题', summary || '暂无背景说明')}>
              创建议题
            </button>
          </div>
        )}
        {kind === 'new-meeting' && (
          <div className="form-grid">
            <label>
              所属议题
              <select defaultValue="thread-q1">
                <option value="thread-q1">2024Q1 战略执行与部门协同议题</option>
                <option value="new">快速新建议题</option>
              </select>
            </label>
            <label>
              会议标题
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：5 月 17 日周会" />
            </label>
            <button className="button primary wide" type="button" onClick={() => saveMeeting(title || '未命名会议')}>
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
            <p>会议议题承载连续会议上下文；会议记录是单次会议报告。</p>
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
      <small>{meeting.todoCount} 个待办</small>
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

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="readonly-field">
      <span>{label}</span>
      <input value={value} readOnly />
    </label>
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
