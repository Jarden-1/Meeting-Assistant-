import { Injectable } from '@nestjs/common';
import { toDateOnly } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import { ThreadMemoryService } from '../thread-memory/thread-memory.service';
import { CreateProgressUpdateDto, CreateThreadDto, ThreadQueryDto, UpdateThreadDto } from './dto';

@Injectable()
export class ThreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: ThreadMemoryService,
  ) {}

  async list(userId: string, query: ThreadQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const keyword = query.keyword?.trim();
    const where = {
      userId,
      deletedAt: null,
      ...(keyword
        ? {
            OR: [
              { title: { contains: keyword, mode: 'insensitive' as const } },
              { background: { contains: keyword, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [threads, total] = await Promise.all([
      this.prisma.meetingThread.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.meetingThread.count({ where }),
    ]);

    const items = await Promise.all(threads.map((thread) => this.toThreadListItem(userId, thread)));
    return { items, page, pageSize, total };
  }

  async create(userId: string, dto: CreateThreadDto) {
    const thread = await this.prisma.meetingThread.create({
      data: {
        userId,
        title: dto.title.trim(),
        background: dto.background?.trim() ?? '',
      },
    });
    return this.get(userId, thread.id);
  }

  async get(userId: string, threadId: string) {
    const thread = await this.memory.assertThread(userId, threadId);
    const [sessionCount, openActionCount, highRiskCount, openQuestionCount, decisionCount, activeCarryInCount] =
      await Promise.all([
        this.prisma.meetingSession.count({ where: { userId, threadId } }),
        this.prisma.actionItem.count({ where: { userId, threadId, status: { in: ['pending', 'in_progress'] } } }),
        this.prisma.risk.count({ where: { userId, threadId, status: 'active', level: 'high' } }),
        this.prisma.openQuestion.count({ where: { userId, threadId, status: 'open' } }),
        this.prisma.decision.count({ where: { userId, threadId } }),
        this.prisma.carryInItem.count({ where: { userId, threadId, status: 'active' } }),
      ]);

    return {
      id: thread.id,
      title: thread.title,
      background: thread.background,
      lastMeetingAt: thread.lastMeetingAt,
      stats: {
        sessionCount,
        openActionCount,
        highRiskCount,
        openQuestionCount,
        decisionCount,
        activeCarryInCount,
      },
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  async update(userId: string, threadId: string, dto: UpdateThreadDto) {
    await this.memory.assertThread(userId, threadId);
    await this.prisma.meetingThread.update({
      where: { id: threadId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.background !== undefined ? { background: dto.background.trim() } : {}),
      },
    });
    return this.get(userId, threadId);
  }

  async remove(userId: string, threadId: string) {
    await this.memory.assertThread(userId, threadId);
    await this.prisma.meetingThread.update({
      where: { id: threadId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  async getPreparation(userId: string, threadId: string) {
    return this.memory.buildPreparation(userId, threadId);
  }

  async getThreadActionItems(userId: string, threadId: string, status?: string) {
    await this.memory.assertThread(userId, threadId);
    const statuses = status?.split(',').map((item) => item.trim()).filter(Boolean);
    const items = await this.prisma.actionItem.findMany({
      where: {
        userId,
        threadId,
        ...(statuses?.length ? { status: { in: statuses } } : {}),
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    return { items: items.map((item) => this.toActionItem(item)) };
  }

  async getProgressUpdates(userId: string, threadId: string) {
    await this.memory.assertThread(userId, threadId);
    const items = await this.prisma.progressUpdate.findMany({
      where: { userId, threadId },
      orderBy: { createdAt: 'desc' },
    });
    return { items };
  }

  async addProgressUpdate(userId: string, threadId: string, dto: CreateProgressUpdateDto) {
    await this.memory.assertThread(userId, threadId);
    return this.prisma.progressUpdate.create({
      data: { userId, threadId, content: dto.content },
    });
  }

  private async toThreadListItem(userId: string, thread: { id: string; title: string; background: string; lastMeetingAt: Date | null; createdAt: Date; updatedAt: Date }) {
    const [openActionCount, highRiskCount, openQuestionCount, activeCarryInCount] = await Promise.all([
      this.prisma.actionItem.count({
        where: { userId, threadId: thread.id, status: { in: ['pending', 'in_progress'] } },
      }),
      this.prisma.risk.count({
        where: { userId, threadId: thread.id, status: 'active', level: 'high' },
      }),
      this.prisma.openQuestion.count({ where: { userId, threadId: thread.id, status: 'open' } }),
      this.prisma.carryInItem.count({ where: { userId, threadId: thread.id, status: 'active' } }),
    ]);

    return {
      id: thread.id,
      title: thread.title,
      background: thread.background,
      summary: thread.background,
      lastMeetingAt: thread.lastMeetingAt,
      openActionCount,
      highRiskCount,
      openQuestionCount,
      activeCarryInCount,
      risk: highRiskCount,
      updatedAt: thread.updatedAt,
      createdAt: thread.createdAt,
    };
  }

  private toActionItem(item: {
    id: string;
    description: string;
    ownerText: string;
    dueDate: Date | null;
    status: string;
    priority: string;
    riskLevel: string;
    importance: string;
    urgency: string;
    threadId: string;
    sessionId: string;
  }) {
    return {
      ...item,
      dueDate: toDateOnly(item.dueDate),
      title: item.description,
      owner: item.ownerText,
      risk: item.riskLevel,
      meetingId: item.sessionId,
    };
  }
}
