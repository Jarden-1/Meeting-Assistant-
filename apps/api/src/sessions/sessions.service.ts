import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseDate, toDateOnly } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import { ThreadMemoryService } from '../thread-memory/thread-memory.service';
import {
  CreateSessionDto,
  FinalizeSessionDto,
  TranscriptSegmentInputDto,
  UpdateActionItemDto,
  UpdateSessionDto,
  UpdateTranscriptSegmentDto,
} from './dto';

type ReportContent = {
  summary?: { content?: string } | string;
  memorySummary?: string;
  decisions?: Array<Record<string, unknown>>;
  consensus?: Array<Record<string, unknown> | string>;
  actionItems?: Array<Record<string, unknown>>;
  risks?: Array<Record<string, unknown>>;
  openQuestions?: Array<Record<string, unknown> | string>;
  progressUpdates?: Array<Record<string, unknown> | string>;
  carryInItems?: Array<Record<string, unknown>>;
  discussionChains?: Array<Record<string, unknown>>;
};

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: ThreadMemoryService,
  ) {}

  async create(userId: string, threadId: string, dto: CreateSessionDto) {
    await this.memory.assertThread(userId, threadId);
    const carryInSnapshot = dto.preparationSnapshot ?? (await this.memory.buildPreparation(userId, threadId));
    const session = await this.prisma.meetingSession.create({
      data: {
        userId,
        threadId,
        title: dto.title.trim(),
        carryInSnapshot: carryInSnapshot as Prisma.InputJsonValue,
      },
    });
    return this.get(userId, session.id);
  }

  async list(userId: string, threadId: string, page = 1, pageSize = 20) {
    await this.memory.assertThread(userId, threadId);
    const safePage = Math.max(1, Number(page ?? 1));
    const safePageSize = Math.min(100, Math.max(1, Number(pageSize ?? 20)));
    const where = { userId, threadId };
    const [items, total] = await Promise.all([
      this.prisma.meetingSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        select: {
          id: true,
          title: true,
          status: true,
          summary: true,
          startedAt: true,
          endedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { actionItems: true } },
        },
      }),
      this.prisma.meetingSession.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        todoCount: item._count.actionItems,
      })),
      page: safePage,
      pageSize: safePageSize,
      total,
    };
  }

  async get(userId: string, sessionId: string) {
    const session = await this.memory.assertSession(userId, sessionId);
    const transcriptSegments = await this.prisma.transcriptSegment.findMany({
      where: { userId, sessionId },
      orderBy: { sequence: 'asc' },
    });
    return {
      id: session.id,
      threadId: session.threadId,
      title: session.title,
      status: session.status,
      meetingContent: session.meetingContent,
      summary: session.summary,
      memorySummary: session.memorySummary,
      carryInSnapshot: session.carryInSnapshot,
      transcriptSegments,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  async update(userId: string, sessionId: string, dto: UpdateSessionDto) {
    const session = await this.memory.assertSession(userId, sessionId);
    const meetingContent =
      dto.transcriptSegments && dto.transcriptSegments.length > 0
        ? dto.transcriptSegments.map((segment) => `${segment.speakerText ?? 'Speaker'}: ${segment.text}`).join('\n')
        : dto.meetingContent;

    await this.prisma.$transaction(async (tx) => {
      await tx.meetingSession.update({
        where: { id: sessionId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(meetingContent !== undefined ? { meetingContent } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.status === 'in_meeting' && !session.startedAt ? { startedAt: new Date() } : {}),
        },
      });

      if (dto.transcriptSegments) {
        await tx.transcriptSegment.deleteMany({ where: { userId, sessionId } });
        await tx.transcriptSegment.createMany({
          data: dto.transcriptSegments.map((segment, index) =>
            this.toTranscriptCreateInput(userId, session.threadId, sessionId, segment, index + 1),
          ),
        });
      } else if (dto.meetingContent !== undefined) {
        const existingCount = await tx.transcriptSegment.count({ where: { userId, sessionId } });
        if (existingCount === 0 && dto.meetingContent.trim()) {
          await tx.transcriptSegment.create({
            data: {
              userId,
              threadId: session.threadId,
              sessionId,
              speakerText: '手动记录',
              text: dto.meetingContent,
              source: 'manual',
              sequence: 1,
            },
          });
        }
      }
    });

    return this.get(userId, sessionId);
  }

  async remove(userId: string, sessionId: string) {
    await this.memory.assertSession(userId, sessionId);
    await this.prisma.meetingSession.delete({
      where: { id: sessionId },
    });
    return { deleted: true };
  }

  async move(userId: string, sessionId: string, targetThreadId: string) {
    const session = await this.memory.assertSession(userId, sessionId);
    await this.memory.assertThread(userId, targetThreadId);
    if (session.threadId === targetThreadId) return this.get(userId, sessionId);

    await this.prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.meetingSession.update({ where: { id: sessionId }, data: { threadId: targetThreadId } }),
        tx.decision.updateMany({ where: { userId, sessionId }, data: { threadId: targetThreadId } }),
        tx.actionItem.updateMany({ where: { userId, sessionId }, data: { threadId: targetThreadId } }),
        tx.progressUpdate.updateMany({ where: { userId, sessionId }, data: { threadId: targetThreadId } }),
        tx.risk.updateMany({ where: { userId, sessionId }, data: { threadId: targetThreadId } }),
        tx.openQuestion.updateMany({ where: { userId, sessionId }, data: { threadId: targetThreadId } }),
        tx.discussionChain.updateMany({ where: { userId, sessionId }, data: { threadId: targetThreadId } }),
        tx.assistantMessage.updateMany({ where: { userId, sessionId }, data: { threadId: targetThreadId } }),
        tx.reportDraft.updateMany({ where: { userId, sessionId }, data: { threadId: targetThreadId } }),
        tx.transcription.updateMany({ where: { userId, sessionId }, data: { threadId: targetThreadId } }),
        tx.transcriptSegment.updateMany({ where: { userId, sessionId }, data: { threadId: targetThreadId } }),
        tx.carryInItem.updateMany({ where: { userId, sourceSessionId: sessionId }, data: { threadId: targetThreadId } }),
      ]);
    });

    return this.get(userId, sessionId);
  }

  async finalize(userId: string, sessionId: string, dto: FinalizeSessionDto) {
    const session = await this.memory.assertSession(userId, sessionId);
    const content = await this.resolveFinalizeContent(userId, sessionId, dto);
    const summary = typeof content.summary === 'string' ? content.summary : content.summary?.content ?? '';
    const memorySummary = content.memorySummary ?? summary.slice(0, 500);
    const decisions = [...this.asArray(content.consensus).map((item) => ({ item, type: 'consensus' })), ...this.asArray(content.decisions).map((item) => ({ item, type: 'decision' }))];
    const actionItems = this.asArray(content.actionItems);
    const risks = this.asArray(content.risks);
    const openQuestions = this.asArray(content.openQuestions);
    const progressUpdates = this.asArray(content.progressUpdates);
    const carryInItems = this.asArray(content.carryInItems);
    const discussionChains = this.asArray(content.discussionChains);

    await this.prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.decision.deleteMany({ where: { userId, sessionId } }),
        tx.actionItem.deleteMany({ where: { userId, sessionId } }),
        tx.risk.deleteMany({ where: { userId, sessionId } }),
        tx.openQuestion.deleteMany({ where: { userId, sessionId } }),
        tx.progressUpdate.deleteMany({ where: { userId, sessionId } }),
        tx.discussionChain.deleteMany({ where: { userId, sessionId } }),
      ]);

      if (decisions.length) {
        await tx.decision.createMany({
          data: decisions.map(({ item, type }) => ({
            userId,
            threadId: session.threadId,
            sessionId,
            type,
            content: this.textField(item, 'content'),
            rationale: this.textField(item, 'rationale'),
            sourceText: this.textField(item, 'sourceText'),
          })),
        });
      }

      if (actionItems.length) {
        await tx.actionItem.createMany({
          data: actionItems.map((item) => ({
            userId,
            threadId: session.threadId,
            sessionId,
            description: this.textField(item, 'description') || this.textField(item, 'content'),
            ownerText: this.textField(item, 'ownerText'),
            dueDate: parseDate(this.textField(item, 'dueDate')),
            status: this.textField(item, 'status') || 'pending',
            priority: this.textField(item, 'priority') || 'medium',
            riskLevel: this.textField(item, 'riskLevel') || 'none',
            importance: this.textField(item, 'importance') || 'low',
            urgency: this.textField(item, 'urgency') || 'low',
            sourceText: this.textField(item, 'sourceText'),
          })),
        });
      }

      if (risks.length) {
        await tx.risk.createMany({
          data: risks.map((item) => ({
            userId,
            threadId: session.threadId,
            sessionId,
            content: this.textField(item, 'content'),
            level: this.textField(item, 'level') || 'medium',
            status: this.textField(item, 'status') || 'active',
            sourceText: this.textField(item, 'sourceText'),
          })),
        });
      }

      if (openQuestions.length) {
        await tx.openQuestion.createMany({
          data: openQuestions.map((item) => ({
            userId,
            threadId: session.threadId,
            sessionId,
            content: this.textField(item, 'content'),
            status: this.textField(item, 'status') || 'open',
            sourceText: this.textField(item, 'sourceText'),
          })),
        });
      }

      if (progressUpdates.length) {
        await tx.progressUpdate.createMany({
          data: progressUpdates.map((item) => ({
            userId,
            threadId: session.threadId,
            sessionId,
            content: this.textField(item, 'content'),
            sourceText: this.textField(item, 'sourceText'),
          })),
        });
      }

      if (carryInItems.length) {
        await tx.carryInItem.createMany({
          data: carryInItems.map((item) => ({
            userId,
            threadId: session.threadId,
            sourceSessionId: sessionId,
            type: this.textField(item, 'type') || 'progress_needed',
            content: this.textField(item, 'content'),
            status: this.textField(item, 'status') || 'active',
          })),
        });
      }

      if (discussionChains.length) {
        await tx.discussionChain.createMany({
          data: discussionChains.map((item) => ({
            userId,
            threadId: session.threadId,
            sessionId,
            topic: this.textField(item, 'topic'),
            facts: this.jsonArrayField(item, 'facts'),
            opinions: this.jsonArrayField(item, 'opinions'),
            disagreements: this.jsonArrayField(item, 'disagreements'),
            decision: this.textField(item, 'decision'),
            openQuestions: this.jsonArrayField(item, 'openQuestions'),
            nextActions: this.jsonArrayField(item, 'nextActions'),
            sourceText: this.textField(item, 'sourceText'),
          })),
        });
      }

      await tx.reportDraft.updateMany({
        where: { userId, sessionId, status: 'draft' },
        data: { status: 'applied' },
      });
      await tx.meetingSession.update({
        where: { id: sessionId },
        data: {
          summary,
          memorySummary,
          status: 'finalized',
          endedAt: new Date(),
        },
      });
      await tx.meetingThread.update({
        where: { id: session.threadId },
        data: { lastMeetingAt: new Date() },
      });
    });

    return this.get(userId, sessionId);
  }

  async getTranscriptSegments(userId: string, sessionId: string, keyword?: string) {
    await this.memory.assertSession(userId, sessionId);
    const trimmed = keyword?.trim();
    const items = await this.prisma.transcriptSegment.findMany({
      where: {
        userId,
        sessionId,
        ...(trimmed ? { OR: [{ text: { contains: trimmed, mode: 'insensitive' } }, { speakerText: { contains: trimmed, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { sequence: 'asc' },
    });
    return { items };
  }

  async updateTranscriptSegment(userId: string, segmentId: string, dto: UpdateTranscriptSegmentDto) {
    const segment = await this.prisma.transcriptSegment.findFirst({ where: { id: segmentId, userId } });
    if (!segment) throw new NotFoundException('TRANSCRIPT_SEGMENT_NOT_FOUND');
    await this.prisma.transcriptSegment.update({
      where: { id: segmentId },
      data: {
        ...(dto.speakerText !== undefined ? { speakerText: dto.speakerText } : {}),
        ...(dto.text !== undefined ? { text: dto.text, source: 'edited' } : {}),
      },
    });
    await this.rebuildMeetingContent(userId, segment.sessionId);
    return this.getTranscriptSegments(userId, segment.sessionId);
  }

  async getMyActionItems(userId: string, view?: string, status?: string) {
    const statuses = status?.split(',').map((item) => item.trim()).filter(Boolean);
    const items = await this.prisma.actionItem.findMany({
      where: {
        userId,
        ...(statuses?.length ? { status: { in: statuses } } : {}),
      },
      include: { thread: { select: { id: true, title: true } }, session: { select: { id: true, title: true } } },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    const mapped = items.map((item) => ({
      ...item,
      dueDate: toDateOnly(item.dueDate),
      title: item.description,
      owner: item.ownerText,
      meetingId: item.sessionId,
      risk: item.riskLevel,
    }));

    if (view === 'matrix') {
      return {
        matrix: {
          importantUrgent: mapped.filter((item) => item.importance === 'high' && item.urgency === 'high'),
          importantNotUrgent: mapped.filter((item) => item.importance === 'high' && item.urgency !== 'high'),
          notImportantUrgent: mapped.filter((item) => item.importance !== 'high' && item.urgency === 'high'),
          notImportantNotUrgent: mapped.filter((item) => item.importance !== 'high' && item.urgency !== 'high'),
        },
      };
    }

    return { items: mapped };
  }

  async updateActionItem(userId: string, actionItemId: string, dto: UpdateActionItemDto) {
    const item = await this.prisma.actionItem.findFirst({ where: { id: actionItemId, userId } });
    if (!item) throw new NotFoundException('ACTION_ITEM_NOT_FOUND');
    const updated = await this.prisma.actionItem.update({
      where: { id: actionItemId },
      data: {
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.ownerText !== undefined ? { ownerText: dto.ownerText } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: parseDate(dto.dueDate) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.riskLevel !== undefined ? { riskLevel: dto.riskLevel } : {}),
        ...(dto.importance !== undefined ? { importance: dto.importance } : {}),
        ...(dto.urgency !== undefined ? { urgency: dto.urgency } : {}),
      },
    });
    return { ...updated, dueDate: toDateOnly(updated.dueDate) };
  }

  private async resolveFinalizeContent(userId: string, sessionId: string, dto: FinalizeSessionDto): Promise<ReportContent> {
    if (dto.content && typeof dto.content === 'object') return dto.content as ReportContent;
    const draft = await this.prisma.reportDraft.findFirst({
      where: { userId, sessionId, status: 'draft' },
      orderBy: { createdAt: 'desc' },
    });
    if (!draft) throw new NotFoundException('REPORT_DRAFT_NOT_FOUND');
    return draft.content as ReportContent;
  }

  private toTranscriptCreateInput(
    userId: string,
    threadId: string,
    sessionId: string,
    segment: TranscriptSegmentInputDto,
    fallbackSequence: number,
  ) {
    return {
      userId,
      threadId,
      sessionId,
      speakerText: segment.speakerText ?? 'Speaker 1',
      startedAt: parseDate(segment.startedAt),
      endedAt: parseDate(segment.endedAt),
      text: segment.text,
      source: segment.source ?? 'manual',
      sequence: segment.sequence ?? fallbackSequence,
    };
  }

  private async rebuildMeetingContent(userId: string, sessionId: string) {
    const segments = await this.prisma.transcriptSegment.findMany({
      where: { userId, sessionId },
      orderBy: { sequence: 'asc' },
    });
    await this.prisma.meetingSession.update({
      where: { id: sessionId },
      data: { meetingContent: segments.map((segment) => `${segment.speakerText}: ${segment.text}`).join('\n') },
    });
  }

  private asArray(value: unknown): Array<Record<string, unknown> | string> {
    return Array.isArray(value) ? value : [];
  }

  private textField(item: Record<string, unknown> | string, field: string): string {
    if (typeof item === 'string') return field === 'content' || field === 'description' ? item : '';
    const value = item[field];
    return typeof value === 'string' ? value : '';
  }

  private jsonArrayField(item: Record<string, unknown> | string, field: string): Prisma.InputJsonValue {
    if (typeof item === 'string') return [];
    const value = item[field];
    return Array.isArray(value) ? (value as Prisma.InputJsonValue) : [];
  }
}
