import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ThreadMemoryService } from '../thread-memory/thread-memory.service';
import { CompleteEnhancementChunkDto, CreateEnhancementChunkDto, FailEnhancementChunkDto } from './dto';
import { EnhancementAudioStorageService } from './enhancement-audio-storage.service';
import { EnhancementWorkerService } from './enhancement-worker.service';
import { SpeakerAlignmentService } from './speaker-alignment.service';

type EnhancementChunkRow = {
  id: string;
  chunkIndex: number;
  audioStartMs: number;
  audioEndMs: number;
  overlapMs: number;
  provider: string;
  status: string;
  errorMessage: string;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class EnhancementChunksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: ThreadMemoryService,
    private readonly audioStorage: EnhancementAudioStorageService,
    private readonly speakers: SpeakerAlignmentService,
    private readonly worker: EnhancementWorkerService,
  ) {}

  async create(userId: string, sessionId: string, dto: CreateEnhancementChunkDto) {
    const session = await this.memory.assertSession(userId, sessionId);
    const audioPath = dto.audioBase64
      ? await this.audioStorage.save(sessionId, dto.chunkIndex, dto.audioBase64, dto.audioMimeType)
      : '';

    const chunk = await this.prisma.transcriptionEnhancementChunk.upsert({
      where: { sessionId_chunkIndex: { sessionId, chunkIndex: dto.chunkIndex } },
      create: {
        userId,
        threadId: session.threadId,
        sessionId,
        chunkIndex: dto.chunkIndex,
        audioStartMs: dto.audioStartMs,
        audioEndMs: dto.audioEndMs,
        overlapMs: dto.overlapMs ?? 0,
        provider: dto.provider ?? 'moss',
        status: 'queued',
        audioPath,
      },
      update: {
        audioStartMs: dto.audioStartMs,
        audioEndMs: dto.audioEndMs,
        overlapMs: dto.overlapMs ?? 0,
        provider: dto.provider ?? 'moss',
        status: 'queued',
        audioPath,
        errorMessage: '',
        result: undefined,
        startedAt: null,
        completedAt: null,
      },
    });

    if (this.worker.isConfigured()) {
      void this.dispatchToWorker(chunk.id, userId, sessionId, {
        chunkIndex: dto.chunkIndex,
        audioStartMs: dto.audioStartMs,
        audioEndMs: dto.audioEndMs,
        overlapMs: dto.overlapMs ?? 0,
        provider: dto.provider ?? 'moss',
        audioPath,
        audioBase64: audioPath ? undefined : dto.audioBase64,
        audioMimeType: dto.audioMimeType,
      });
    }

    return this.toResponse(chunk);
  }

  async list(userId: string, sessionId: string) {
    await this.memory.assertSession(userId, sessionId);
    const chunks = await this.prisma.transcriptionEnhancementChunk.findMany({
      where: { userId, sessionId },
      orderBy: { chunkIndex: 'asc' },
    });
    return { items: chunks.map((chunk) => this.toResponse(chunk)) };
  }

  async getStatus(userId: string, sessionId: string) {
    await this.memory.assertSession(userId, sessionId);
    const [total, queued, running, completed, failed] = await Promise.all([
      this.prisma.transcriptionEnhancementChunk.count({ where: { userId, sessionId } }),
      this.prisma.transcriptionEnhancementChunk.count({ where: { userId, sessionId, status: 'queued' } }),
      this.prisma.transcriptionEnhancementChunk.count({ where: { userId, sessionId, status: 'running' } }),
      this.prisma.transcriptionEnhancementChunk.count({ where: { userId, sessionId, status: 'completed' } }),
      this.prisma.transcriptionEnhancementChunk.count({ where: { userId, sessionId, status: 'failed' } }),
    ]);
    return {
      worker: this.worker.getStatus(),
      chunks: { total, queued, running, completed, failed },
    };
  }

  async complete(userId: string, sessionId: string, chunkId: string, dto: CompleteEnhancementChunkDto) {
    const chunk = await this.findChunk(userId, sessionId, chunkId);
    const session = await this.memory.assertSession(userId, sessionId);
    const segments = this.normalizeSegments(dto);

    await this.markRunningAndClearPreviousSegments(userId, sessionId, chunk.id, dto.provider ?? chunk.provider, chunk.startedAt);
    await this.createEnhancedSegments(userId, session.threadId, sessionId, chunk.id, chunk.chunkIndex, dto.provider ?? chunk.provider, segments);

    await this.prisma.transcriptionEnhancementChunk.update({
      where: { id: chunk.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: { segments },
        errorMessage: '',
        audioPath: '',
      },
    });
    await this.audioStorage.remove(chunk.audioPath);
    await this.rebuildMeetingContent(userId, sessionId);
    return this.get(userId, sessionId, chunkId);
  }

  async fail(userId: string, sessionId: string, chunkId: string, dto: FailEnhancementChunkDto) {
    await this.findChunk(userId, sessionId, chunkId);
    const updated = await this.prisma.transcriptionEnhancementChunk.update({
      where: { id: chunkId },
      data: {
        status: dto.status ?? 'failed',
        errorMessage: dto.errorMessage,
        completedAt: new Date(),
      },
    });
    return this.toResponse(updated);
  }

  private async dispatchToWorker(
    chunkId: string,
    userId: string,
    sessionId: string,
    request: {
      chunkIndex: number;
      audioStartMs: number;
      audioEndMs: number;
      overlapMs: number;
      provider: string;
      audioPath: string;
      audioBase64?: string;
      audioMimeType?: string;
    },
  ) {
    try {
      await this.prisma.transcriptionEnhancementChunk.update({
        where: { id: chunkId },
        data: { status: 'running', startedAt: new Date(), errorMessage: '' },
      });
      const result = await this.worker.enhance({
        chunkId,
        sessionId,
        chunkIndex: request.chunkIndex,
        audioStartMs: request.audioStartMs,
        audioEndMs: request.audioEndMs,
        overlapMs: request.overlapMs,
        provider: request.provider,
        audioPath: request.audioPath || undefined,
        audioBase64: request.audioBase64,
        audioMimeType: request.audioMimeType,
      });
      await this.complete(userId, sessionId, chunkId, {
        provider: result.provider ?? request.provider,
        segments: result.segments,
      });
    } catch (error) {
      await this.fail(userId, sessionId, chunkId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Enhancement worker failed',
      });
    }
  }

  private async get(userId: string, sessionId: string, chunkId: string) {
    return this.toResponse(await this.findChunk(userId, sessionId, chunkId));
  }

  private async findChunk(userId: string, sessionId: string, chunkId: string) {
    const chunk = await this.prisma.transcriptionEnhancementChunk.findFirst({
      where: { id: chunkId, userId, sessionId },
    });
    if (!chunk) throw new NotFoundException('ENHANCEMENT_CHUNK_NOT_FOUND');
    return chunk;
  }

  private normalizeSegments(dto: CompleteEnhancementChunkDto) {
    return dto.segments
      .map((segment) => ({
        localSpeaker: (segment.localSpeaker ?? segment.speakerText ?? 'Speaker 1').trim() || 'Speaker 1',
        text: segment.text.trim(),
        startMs: Math.max(0, segment.startMs),
        endMs: Math.max(segment.startMs, segment.endMs),
        confidence: segment.confidence,
      }))
      .filter((segment) => segment.text);
  }

  private async markRunningAndClearPreviousSegments(
    userId: string,
    sessionId: string,
    chunkId: string,
    provider: string,
    startedAt: Date | null,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.transcriptionEnhancementChunk.update({
        where: { id: chunkId },
        data: { status: 'running', provider, startedAt: startedAt ?? new Date() },
      });
      await tx.transcriptSegment.deleteMany({ where: { userId, sessionId, enhancementChunkId: chunkId } });
    });
  }

  private async createEnhancedSegments(
    userId: string,
    threadId: string,
    sessionId: string,
    chunkId: string,
    chunkIndex: number,
    provider: string,
    segments: ReturnType<EnhancementChunksService['normalizeSegments']>,
  ) {
    const speakerMap = new Map<string, { id: string; label: string }>();
    const currentMaxSequence = await this.prisma.transcriptSegment.aggregate({
      where: { userId, sessionId },
      _max: { sequence: true },
    });
    let sequence = currentMaxSequence._max.sequence ?? 0;

    for (const segment of segments) {
      const speaker = await this.speakers.resolveGlobalSpeaker(userId, sessionId, chunkIndex, segment.localSpeaker, segment, speakerMap);
      sequence += 1;
      await this.prisma.transcriptSegment.create({
        data: {
          userId,
          threadId,
          sessionId,
          enhancementChunkId: chunkId,
          speakerId: speaker.id,
          speakerText: speaker.label,
          startMs: segment.startMs,
          endMs: segment.endMs,
          text: segment.text,
          source: 'enhanced',
          sequence,
          confidence: segment.confidence,
          provider,
        },
      });
    }
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

  private toResponse(chunk: EnhancementChunkRow) {
    return {
      id: chunk.id,
      chunkIndex: chunk.chunkIndex,
      audioStartMs: chunk.audioStartMs,
      audioEndMs: chunk.audioEndMs,
      overlapMs: chunk.overlapMs,
      provider: chunk.provider,
      status: chunk.status,
      errorMessage: chunk.errorMessage,
      queuedAt: chunk.queuedAt,
      startedAt: chunk.startedAt,
      completedAt: chunk.completedAt,
      createdAt: chunk.createdAt,
      updatedAt: chunk.updatedAt,
    };
  }
}
