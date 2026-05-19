import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThreadMemoryService } from '../thread-memory/thread-memory.service';
import { GenerateReportDraftDto } from './dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: ThreadMemoryService,
    private readonly ai: AiService,
  ) {}

  async generate(userId: string, sessionId: string, dto: GenerateReportDraftDto) {
    const session = await this.memory.assertSession(userId, sessionId);
    if (dto.meetingContent !== undefined) {
      await this.prisma.meetingSession.update({
        where: { id: sessionId },
        data: { meetingContent: dto.meetingContent, status: 'reviewing' },
      });
    }

    const context = await this.memory.buildReportContext(userId, sessionId);
    const content = await this.ai.generateReportDraft(userId, context);
    const draft = await this.prisma.reportDraft.create({
      data: {
        userId,
        threadId: session.threadId,
        sessionId,
        content: content as Prisma.InputJsonValue,
      },
    });
    await this.prisma.meetingSession.update({
      where: { id: sessionId },
      data: { status: 'reviewing' },
    });

    return {
      id: draft.id,
      status: draft.status,
      ...content,
      createdAt: draft.createdAt,
    };
  }

  async latest(userId: string, sessionId: string) {
    await this.memory.assertSession(userId, sessionId);
    const draft = await this.prisma.reportDraft.findFirst({
      where: { userId, sessionId },
      orderBy: { createdAt: 'desc' },
    });
    if (!draft) throw new NotFoundException('REPORT_DRAFT_NOT_FOUND');
    return {
      id: draft.id,
      status: draft.status,
      ...(draft.content as Record<string, unknown>),
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }

  async progress(userId: string, sessionId: string) {
    await this.memory.assertSession(userId, sessionId);
    const draft = await this.prisma.reportDraft.findFirst({
      where: { userId, sessionId },
      orderBy: { createdAt: 'desc' },
      select: { status: true, updatedAt: true },
    });

    if (!draft) {
      return {
        status: 'idle',
        stage: 'idle',
        progress: 0,
        message: '暂无生成任务',
      };
    }

    if (draft.status === 'applied') {
      return {
        status: 'completed',
        stage: 'completed',
        progress: 100,
        message: '会后草稿已确认并写入正式记录',
        updatedAt: draft.updatedAt,
      };
    }

    return {
      status: 'completed',
      stage: 'completed',
      progress: 100,
      message: '会后草稿已生成',
      updatedAt: draft.updatedAt,
    };
  }
}
