import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { toDateOnly } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';

type AssistantLiveTranscriptSnapshot = Array<{
  speakerText?: string;
  speaker?: string;
  text?: string;
  time?: string;
  role?: string;
}>;

@Injectable()
export class ThreadMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async assertThread(userId: string, threadId: string) {
    const thread = await this.prisma.meetingThread.findFirst({
      where: { id: threadId, userId, deletedAt: null },
    });
    if (!thread) throw new NotFoundException('THREAD_NOT_FOUND');
    return thread;
  }

  async assertSession(userId: string, sessionId: string) {
    const session = await this.prisma.meetingSession.findFirst({
      where: { id: sessionId, userId },
      include: { thread: true },
    });
    if (!session) throw new NotFoundException('SESSION_NOT_FOUND');
    if (session.thread.deletedAt) throw new ForbiddenException('THREAD_DELETED');
    return session;
  }

  async buildPreparation(userId: string, threadId: string) {
    await this.assertThread(userId, threadId);
    const [consensus, decisions, actionItems, progressUpdates, openQuestions, risks, carryInItems, latestSessions] =
      await Promise.all([
        this.prisma.decision.findMany({
          where: { userId, threadId, type: 'consensus' },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.prisma.decision.findMany({
          where: { userId, threadId, type: 'decision' },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.prisma.actionItem.findMany({
          where: { userId, threadId, status: { in: ['pending', 'in_progress'] } },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          take: 12,
        }),
        this.prisma.progressUpdate.findMany({
          where: { userId, threadId },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        this.prisma.openQuestion.findMany({
          where: { userId, threadId, status: 'open' },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        this.prisma.risk.findMany({
          where: { userId, threadId, status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        this.prisma.carryInItem.findMany({
          where: { userId, threadId, status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        this.prisma.meetingSession.findMany({
          where: { userId, threadId, status: 'finalized' },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { title: true, memorySummary: true, summary: true, createdAt: true },
        }),
      ]);

    const suggestedFocus = this.buildSuggestedFocus(actionItems, risks, openQuestions, carryInItems);
    const suggestedAgenda = this.buildSuggestedAgenda(actionItems.length, risks.length, openQuestions.length);

    return {
      lastConsensus: consensus.map((item) => item.content),
      lastDecisions: decisions.map((item) => item.content),
      openActionItems: actionItems.map((item) => ({
        id: item.id,
        description: item.description,
        ownerText: item.ownerText,
        dueDate: toDateOnly(item.dueDate),
        status: item.status,
        priority: item.priority,
        riskLevel: item.riskLevel,
        importance: item.importance,
        urgency: item.urgency,
      })),
      progressUpdates: progressUpdates.map((item) => ({ id: item.id, content: item.content })),
      openQuestions: openQuestions.map((item) => item.content),
      risks: risks.map((item) => item.content),
      carryInItems: carryInItems.map((item) => ({
        id: item.id,
        type: item.type,
        content: item.content,
      })),
      recentMeetingSummaries: latestSessions
        .map((session) => session.memorySummary || session.summary)
        .filter(Boolean),
      suggestedFocus,
      suggestedAgenda,
      manualNotes: [],
      warnings: [],
    };
  }

  async buildAssistantContext(userId: string, sessionId: string, question: string, liveTranscriptSnapshot: AssistantLiveTranscriptSnapshot = []) {
    const session = await this.assertSession(userId, sessionId);
    const [preparation, segments, assistantMessages] = await Promise.all([
      this.buildPreparation(userId, session.threadId),
      this.prisma.transcriptSegment.findMany({
        where: { userId, sessionId },
        orderBy: { sequence: 'asc' },
        take: 80,
      }),
      this.prisma.assistantMessage.findMany({
        where: { userId, sessionId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    const persistedTranscript = segments.map((segment) => ({
      speakerText: segment.speakerText,
      text: segment.text,
      time: segment.startedAt?.toISOString() ?? segment.endedAt?.toISOString() ?? '',
      source: 'saved_transcript',
    }));
    const liveTranscript = this.normalizeLiveTranscript(liveTranscriptSnapshot);
    const combinedTranscript = this.mergeTranscriptSnapshots(persistedTranscript, liveTranscript);

    return {
      question,
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
        meetingContent: session.meetingContent,
        carryInSnapshot: session.carryInSnapshot,
      },
      thread: {
        id: session.thread.id,
        title: session.thread.title,
        background: session.thread.background,
      },
      preparation,
      transcriptText: combinedTranscript.map((segment) => `${segment.speakerText}: ${segment.text}`).join('\n'),
      savedTranscriptText: persistedTranscript.map((segment) => `${segment.speakerText}: ${segment.text}`).join('\n'),
      liveTranscriptText: liveTranscript.map((segment) => `${segment.speakerText}: ${segment.text}`).join('\n'),
      transcriptSourceNote:
        liveTranscript.length > 0
          ? 'transcriptText 已合并数据库保存转写和前端实时转写快照；如果重复，以更靠后的实时快照作为最新上下文。'
          : 'transcriptText 来自数据库保存转写。',
      recentAssistantMessages: assistantMessages.reverse().map((message) => ({
        role: message.role,
        content: message.content,
      })),
    };
  }

  async buildReportContext(userId: string, sessionId: string, meetingContentOverride?: string) {
    const session = await this.assertSession(userId, sessionId);
    const [preparation, segments, discussionChains] = await Promise.all([
      this.buildPreparation(userId, session.threadId),
      this.prisma.transcriptSegment.findMany({
        where: { userId, sessionId },
        orderBy: { sequence: 'asc' },
      }),
      this.prisma.discussionChain.findMany({
        where: { userId, sessionId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      session,
      thread: session.thread,
      preparation,
      meetingContent:
        meetingContentOverride !== undefined
          ? meetingContentOverride
          : segments.length > 0
            ? segments.map((segment) => `${segment.speakerText}: ${segment.text}`).join('\n')
            : session.meetingContent,
      discussionChains,
    };
  }

  private buildSuggestedFocus(
    actionItems: Array<{ description: string; riskLevel: string }>,
    risks: Array<{ content: string }>,
    openQuestions: Array<{ content: string }>,
    carryInItems: Array<{ content: string }>,
  ) {
    const focus = [
      ...actionItems
        .filter((item) => item.riskLevel === 'at_risk' || item.riskLevel === 'high_risk')
        .slice(0, 2)
        .map((item) => `确认高风险待办进展：${item.description}`),
      ...risks.slice(0, 2).map((risk) => `处理风险：${risk.content}`),
      ...openQuestions.slice(0, 2).map((question) => `回应遗留问题：${question.content}`),
      ...carryInItems.slice(0, 2).map((item) => `带入事项：${item.content}`),
    ];

    return focus.length > 0 ? focus.slice(0, 6) : ['确认本次会议目标、关键决策和负责人'];
  }

  private buildSuggestedAgenda(actionCount: number, riskCount: number, questionCount: number) {
    const agenda = ['同步上次待办进展', '确认本次关键决策'];
    if (riskCount > 0) agenda.push('评估风险与阻塞');
    if (questionCount > 0) agenda.push('处理遗留问题');
    if (actionCount > 0) agenda.push('补充待办负责人和截止时间');
    return agenda;
  }

  private normalizeLiveTranscript(snapshot: AssistantLiveTranscriptSnapshot) {
    return snapshot
      .map((item) => ({
        speakerText: (item.speakerText ?? item.speaker ?? 'Speaker 1').trim() || 'Speaker 1',
        text: (item.text ?? '').trim(),
        time: item.time ?? '',
        source: 'live_transcript',
      }))
      .filter((item) => item.text)
      .slice(-100);
  }

  private mergeTranscriptSnapshots(
    saved: Array<{ speakerText: string; text: string; time: string; source: string }>,
    live: Array<{ speakerText: string; text: string; time: string; source: string }>,
  ) {
    const merged = new Map<string, { speakerText: string; text: string; time: string; source: string }>();
    [...saved, ...live].forEach((item) => {
      const key = `${item.speakerText}:${item.text}`.replace(/\s+/g, '');
      merged.set(key, item);
    });
    return [...merged.values()].slice(-120);
  }
}
