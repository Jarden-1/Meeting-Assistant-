import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThreadMemoryService } from '../thread-memory/thread-memory.service';
import { AssistantAskDto } from './dto';

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: ThreadMemoryService,
    private readonly ai: AiService,
  ) {}

  async ask(userId: string, sessionId: string, dto: AssistantAskDto) {
    const session = await this.memory.assertSession(userId, sessionId);
    await this.prisma.assistantMessage.create({
      data: {
        userId,
        threadId: session.threadId,
        sessionId,
        role: 'user',
        content: dto.question,
        mode: dto.inputMode ?? 'text',
      },
    });

    const context = await this.memory.buildAssistantContext(userId, sessionId, dto.question);
    const result = await this.ai.assistantAsk(userId, context);
    const message = await this.prisma.assistantMessage.create({
      data: {
        userId,
        threadId: session.threadId,
        sessionId,
        role: 'assistant',
        content: result.answer,
        mode: result.mode,
        sources: result.sources as Prisma.InputJsonValue,
      },
    });

    return {
      answer: result.answer,
      mode: result.mode,
      sources: result.sources,
      createdAt: message.createdAt,
    };
  }

  async messages(userId: string, sessionId: string) {
    await this.memory.assertSession(userId, sessionId);
    const items = await this.prisma.assistantMessage.findMany({
      where: { userId, sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return { items };
  }
}
