import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type SpeakerRef = {
  id: string;
  label: string;
};

type SegmentForAlignment = {
  text: string;
  startMs: number;
  endMs: number;
};

@Injectable()
export class SpeakerAlignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveGlobalSpeaker(
    userId: string,
    sessionId: string,
    chunkIndex: number,
    localSpeaker: string,
    segment: SegmentForAlignment,
    speakerMap: Map<string, SpeakerRef>,
  ) {
    const cached = speakerMap.get(localSpeaker);
    if (cached) return cached;

    const matched = await this.findOverlappingSpeaker(userId, sessionId, segment);
    if (matched) {
      speakerMap.set(localSpeaker, matched);
      return matched;
    }

    const speaker = await this.createOrReuseSpeaker(userId, sessionId, chunkIndex, localSpeaker);
    speakerMap.set(localSpeaker, speaker);
    return speaker;
  }

  private async findOverlappingSpeaker(userId: string, sessionId: string, segment: SegmentForAlignment) {
    const overlapping = await this.prisma.transcriptSegment.findMany({
      where: {
        userId,
        sessionId,
        source: 'enhanced',
        speakerId: { not: null },
        startMs: { lte: segment.endMs + 3000 },
        endMs: { gte: segment.startMs - 3000 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    const matched = overlapping.find((item) => item.speakerId && this.textSimilarity(item.text, segment.text) >= 0.55);
    return matched?.speakerId ? { id: matched.speakerId, label: matched.speakerText } : null;
  }

  private async createOrReuseSpeaker(userId: string, sessionId: string, chunkIndex: number, localSpeaker: string) {
    if (chunkIndex === 0 && /^speaker\s+\d+$/i.test(localSpeaker)) {
      const label = this.normalizeSpeakerLabel(localSpeaker);
      const speaker = await this.prisma.sessionSpeaker.upsert({
        where: { sessionId_label: { sessionId, label } },
        create: { userId, sessionId, label },
        update: {},
      });
      return { id: speaker.id, label: speaker.label };
    }

    const speaker = await this.prisma.sessionSpeaker.create({
      data: { userId, sessionId, label: await this.nextSpeakerLabel(sessionId) },
    });
    return { id: speaker.id, label: speaker.label };
  }

  private async nextSpeakerLabel(sessionId: string) {
    const count = await this.prisma.sessionSpeaker.count({ where: { sessionId } });
    return `Speaker ${count + 1}`;
  }

  private normalizeSpeakerLabel(label: string) {
    const normalized = label.trim().replace(/^speaker\s*/i, 'Speaker ');
    return normalized || 'Speaker 1';
  }

  private textSimilarity(left: string, right: string) {
    const leftTokens = new Set(this.textTokens(left));
    const rightTokens = new Set(this.textTokens(right));
    if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
    let intersection = 0;
    for (const token of leftTokens) {
      if (rightTokens.has(token)) intersection += 1;
    }
    return intersection / Math.max(leftTokens.size, rightTokens.size);
  }

  private textTokens(text: string) {
    const normalized = text.toLowerCase().replace(/\s+/g, '');
    const tokens: string[] = [];
    for (let index = 0; index < normalized.length; index += 2) {
      tokens.push(normalized.slice(index, index + 2));
    }
    return tokens.filter(Boolean);
  }
}
