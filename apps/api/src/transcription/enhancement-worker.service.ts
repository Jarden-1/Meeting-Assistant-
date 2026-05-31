import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type EnhancementWorkerSegment = {
  localSpeaker?: string;
  speakerText?: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
};

export type EnhancementWorkerRequest = {
  chunkId: string;
  sessionId: string;
  chunkIndex: number;
  audioStartMs: number;
  audioEndMs: number;
  overlapMs: number;
  provider: string;
  audioPath?: string;
  audioBase64?: string;
  audioMimeType?: string;
};

export type EnhancementWorkerResult = {
  provider?: string;
  segments: EnhancementWorkerSegment[];
};

@Injectable()
export class EnhancementWorkerService {
  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.workerUrl());
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      workerUrlConfigured: Boolean(this.workerUrl()),
      tokenConfigured: Boolean(this.config.get<string>('ENHANCEMENT_WORKER_TOKEN')?.trim()),
      timeoutMs: this.timeoutMs(),
    };
  }

  async enhance(request: EnhancementWorkerRequest): Promise<EnhancementWorkerResult> {
    const url = this.workerUrl();
    if (!url) throw new Error('ENHANCEMENT_WORKER_URL is not configured');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/enhance`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          ...this.authHeaders(),
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Enhancement worker failed with ${response.status}`);
      }
      return this.normalizeResponse(await response.json());
    } finally {
      clearTimeout(timeout);
    }
  }

  private workerUrl() {
    return this.config.get<string>('ENHANCEMENT_WORKER_URL')?.trim() ?? '';
  }

  private timeoutMs() {
    const value = Number(this.config.get<string>('ENHANCEMENT_WORKER_TIMEOUT_MS') ?? 15 * 60 * 1000);
    return Number.isFinite(value) && value > 0 ? value : 15 * 60 * 1000;
  }

  private authHeaders() {
    const token = this.config.get<string>('ENHANCEMENT_WORKER_TOKEN')?.trim();
    return token ? { authorization: `Bearer ${token}` } : {};
  }

  private normalizeResponse(raw: unknown): EnhancementWorkerResult {
    const payload = this.objectValue(raw);
    const data = this.objectValue(payload?.data) ?? payload;
    const segments = Array.isArray(data?.segments) ? data.segments : [];
    return {
      provider: typeof data?.provider === 'string' ? data.provider : undefined,
      segments: segments
        .map((segment) => this.normalizeSegment(segment))
        .filter((segment): segment is EnhancementWorkerSegment => Boolean(segment)),
    };
  }

  private normalizeSegment(raw: unknown): EnhancementWorkerSegment | null {
    const segment = this.objectValue(raw);
    const text = typeof segment?.text === 'string' ? segment.text.trim() : '';
    const startMs = this.numberValue(segment?.startMs);
    const endMs = this.numberValue(segment?.endMs);
    if (!text || startMs === null || endMs === null) return null;
    return {
      localSpeaker: typeof segment?.localSpeaker === 'string' ? segment.localSpeaker : undefined,
      speakerText: typeof segment?.speakerText === 'string' ? segment.speakerText : undefined,
      startMs,
      endMs,
      text,
      confidence: this.numberValue(segment?.confidence) ?? undefined,
    };
  }

  private objectValue(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  }

  private numberValue(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }
}
