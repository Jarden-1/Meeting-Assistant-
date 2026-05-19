import { Injectable } from '@nestjs/common';
import { parseDate } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import { ThreadMemoryService } from '../thread-memory/thread-memory.service';
import { CreateTencentSessionDto, CreateTranscriptionDto, PersistTencentResultDto } from './dto';
import { TencentAsrService } from './tencent-asr.service';

@Injectable()
export class TranscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: ThreadMemoryService,
    private readonly tencentAsr: TencentAsrService,
  ) {}

  async create(userId: string, sessionId: string, dto: CreateTranscriptionDto) {
    const session = await this.memory.assertSession(userId, sessionId);
    const text = dto.text ?? dto.segments?.map((segment) => segment.text).join('\n') ?? '';
    const transcription = await this.prisma.transcription.create({
      data: {
        userId,
        threadId: session.threadId,
        sessionId,
        provider: dto.provider ?? 'tencent',
        mode: dto.mode ?? 'realtime',
        text,
        durationSeconds: dto.durationSeconds,
        status: 'completed',
      },
    });

    const currentCount = await this.prisma.transcriptSegment.count({ where: { userId, sessionId } });
    const segments = dto.segments?.length
      ? dto.segments
      : text
        ? [{ text, speakerText: 'Speaker 1', sequence: currentCount + 1 }]
        : [];

    if (segments.length) {
      await this.prisma.transcriptSegment.createMany({
        data: segments.map((segment, index) => ({
          userId,
          threadId: session.threadId,
          sessionId,
          transcriptionId: transcription.id,
          speakerText: segment.speakerText ?? 'Speaker 1',
          startedAt: parseDate(segment.startedAt),
          endedAt: parseDate(segment.endedAt),
          text: segment.text,
          source: 'transcription',
          sequence: segment.sequence ?? currentCount + index + 1,
          confidence: segment.confidence,
          provider: dto.provider ?? 'tencent',
        })),
      });
    }

    await this.rebuildMeetingContent(userId, sessionId);
    const savedSegments = await this.prisma.transcriptSegment.findMany({
      where: { userId, sessionId, transcriptionId: transcription.id },
      orderBy: { sequence: 'asc' },
    });

    return {
      id: transcription.id,
      sessionId,
      text,
      segments: savedSegments,
      durationSeconds: dto.durationSeconds,
      status: transcription.status,
    };
  }

  async createTencentSession(userId: string, sessionId: string, dto: CreateTencentSessionDto) {
    await this.memory.assertSession(userId, sessionId);
    return this.tencentAsr.createRealtimeSession(dto);
  }

  async persistTencentResult(userId: string, sessionId: string, dto: PersistTencentResultDto) {
    const session = await this.memory.assertSession(userId, sessionId);
    const payload = dto.payload ?? {};
    const normalizedSegments = this.normalizeTencentPayload(payload, dto.voiceId, dto.mode);
    if (!normalizedSegments.length) {
      return { accepted: true, created: 0, updated: 0, ignored: true };
    }

    let created = 0;
    let updated = 0;
    let transcriptionId: string | null = null;

    if (dto.voiceId) {
      const existing = await this.prisma.transcription.findFirst({
        where: {
          userId,
          sessionId,
          text: { contains: dto.voiceId },
        },
        select: { id: true },
      });
      transcriptionId = existing?.id ?? null;
    }

    if (!transcriptionId) {
      const transcription = await this.prisma.transcription.create({
        data: {
          userId,
          threadId: session.threadId,
          sessionId,
          provider: 'tencent',
          mode: dto.mode ?? this.tencentAsr.getStatus().mode,
          text: dto.voiceId ? `voice_id:${dto.voiceId}` : 'tencent-realtime',
          status: 'processing',
        },
      });
      transcriptionId = transcription.id;
    }

    for (const segment of normalizedSegments) {
      const existing = segment.externalSegmentId
        ? await this.prisma.transcriptSegment.findFirst({
            where: { externalSegmentId: segment.externalSegmentId },
          })
        : null;

      if (existing) {
        await this.prisma.transcriptSegment.update({
          where: { id: existing.id },
          data: {
            speakerText: segment.speakerText,
            text: segment.text,
            startedAt: segment.startedAt,
            endedAt: segment.endedAt,
            confidence: segment.confidence,
            provider: 'tencent',
            source: 'transcription',
          },
        });
        updated += 1;
      } else {
        await this.prisma.transcriptSegment.create({
          data: {
            userId,
            threadId: session.threadId,
            sessionId,
            transcriptionId,
            externalSegmentId: segment.externalSegmentId,
            speakerText: segment.speakerText,
            startedAt: segment.startedAt,
            endedAt: segment.endedAt,
            text: segment.text,
            source: 'transcription',
            sequence: segment.sequence,
            confidence: segment.confidence,
            provider: 'tencent',
          },
        });
        created += 1;
      }
    }

    await this.rebuildMeetingContent(userId, sessionId);
    await this.prisma.transcription.update({
      where: { id: transcriptionId },
      data: {
        status: 'completed',
      },
    });

    return { accepted: true, created, updated, ignored: false };
  }

  private async rebuildMeetingContent(userId: string, sessionId: string) {
    const segments = await this.prisma.transcriptSegment.findMany({
      where: { userId, sessionId },
      orderBy: { sequence: 'asc' },
    });
    await this.prisma.meetingSession.update({
      where: { id: sessionId },
      data: {
        meetingContent: segments.map((segment) => `${segment.speakerText}: ${segment.text}`).join('\n'),
      },
    });
  }

  private normalizeTencentPayload(payload: Record<string, unknown>, voiceId?: string, mode?: string) {
    const result = this.objectValue(payload.result) ?? payload;
    const sentences = this.arrayValue(result?.sentence_list) ?? this.arrayValue(result?.sentences);

    if (sentences?.length) {
      return sentences
        .map((sentence, index) => this.normalizeTencentSentence(sentence, voiceId, mode, index))
        .filter(Boolean) as Array<{
        externalSegmentId: string;
        speakerText: string;
        startedAt: Date | null;
        endedAt: Date | null;
        text: string;
        sequence: number;
        confidence?: number;
      }>;
    }

    const text =
      this.stringValue(result?.voice_text_str) ||
      this.stringValue(result?.text) ||
      this.stringValue(payload.text);
    const sliceType = this.numberLike(result?.slice_type);
    if (!text || (sliceType !== null && sliceType === 0)) {
      return [];
    }

    const index = this.numberLike(result?.index) ?? this.numberLike(payload.index) ?? Date.now();
    return [
      {
        externalSegmentId: `${voiceId ?? 'voice'}:${index}`,
        speakerText: 'Speaker 1',
        startedAt: this.msToDate(this.numberLike(result?.start_time)),
        endedAt: this.msToDate(this.numberLike(result?.end_time)),
        text,
        sequence: index,
        confidence: this.numberLike(result?.word_confidence) ?? undefined,
      },
    ];
  }

  private normalizeTencentSentence(sentence: unknown, voiceId?: string, mode?: string, fallbackIndex = 0) {
    const row = this.objectValue(sentence);
    if (!row) return null;
    const text = this.stringValue(row.text) || this.stringValue(row.voice_text_str);
    if (!text) return null;
    const sentenceId =
      this.stringValue(row.sentence_id) ||
      String(this.numberLike(row.index) ?? this.numberLike(row.seq) ?? fallbackIndex + 1);
    const speakerId = this.stringValue(row.speaker_id) || this.stringValue(row.spk_id);
    return {
      externalSegmentId: `${voiceId ?? 'voice'}:${mode ?? 'realtime'}:${sentenceId}`,
      speakerText: speakerId ? `Speaker ${speakerId}` : 'Speaker 1',
      startedAt: this.msToDate(this.numberLike(row.start_time)),
      endedAt: this.msToDate(this.numberLike(row.end_time)),
      text,
      sequence: this.numberLike(row.index) ?? fallbackIndex + 1,
      confidence: this.numberLike(row.confidence) ?? undefined,
    };
  }

  private objectValue(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  }

  private arrayValue(value: unknown) {
    return Array.isArray(value) ? value : null;
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' ? value : '';
  }

  private numberLike(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private msToDate(value: number | null) {
    if (value === null) return null;
    return new Date(value);
  }
}
