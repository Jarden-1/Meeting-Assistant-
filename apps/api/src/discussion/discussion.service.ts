import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThreadMemoryService } from '../thread-memory/thread-memory.service';
import { ExtractDiscussionDto } from './dto';

@Injectable()
export class DiscussionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: ThreadMemoryService,
    private readonly ai: AiService,
  ) {}

  async extract(userId: string, sessionId: string, dto: ExtractDiscussionDto) {
    const session = await this.memory.assertSession(userId, sessionId);
    if (dto.meetingContent !== undefined) {
      await this.prisma.meetingSession.update({
        where: { id: sessionId },
        data: { meetingContent: dto.meetingContent },
      });
    }

    const context = await this.memory.buildReportContext(userId, sessionId);
    const result = await this.ai.generateDiscussionChains(userId, context);
    const discussionChains = Array.isArray(result.discussionChains)
      ? (result.discussionChains.filter(
          (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item),
        ) as Record<string, unknown>[])
      : [];
    const warnings = Array.isArray(result.warnings) ? result.warnings : [];

    await this.prisma.discussionChain.deleteMany({ where: { userId, sessionId } });
    if (discussionChains.length) {
      await this.prisma.discussionChain.createMany({
        data: discussionChains.map((item) => ({
          userId,
          threadId: session.threadId,
          sessionId,
          topic: this.stringValue(item.topic),
          facts: this.arrayValue(item.facts) as Prisma.InputJsonValue,
          opinions: this.arrayValue(item.opinions) as Prisma.InputJsonValue,
          disagreements: this.arrayValue(item.disagreements) as Prisma.InputJsonValue,
          decision: this.stringValue(item.decision),
          openQuestions: this.arrayValue(item.openQuestions) as Prisma.InputJsonValue,
          nextActions: this.arrayValue(item.nextActions) as Prisma.InputJsonValue,
          sourceText: this.stringValue(item.sourceText),
        })),
      });
    }

    return {
      discussionChains,
      warnings,
    };
  }

  async list(userId: string, sessionId: string) {
    await this.memory.assertSession(userId, sessionId);
    const items = await this.prisma.discussionChain.findMany({
      where: { userId, sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return { items };
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' ? value : '';
  }

  private arrayValue(value: unknown) {
    return Array.isArray(value) ? value : [];
  }
}
