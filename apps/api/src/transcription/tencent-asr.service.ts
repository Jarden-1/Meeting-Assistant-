import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';

type TencentSessionOptions = {
  mode?: string;
  sampleRate?: number;
  hotwordList?: string[];
};

@Injectable()
export class TencentAsrService {
  constructor(private readonly config: ConfigService) {}

  getStatus() {
    return {
      appIdConfigured: Boolean(this.config.get<string>('TENCENT_ASR_APP_ID')),
      secretIdConfigured: Boolean(this.config.get<string>('TENCENT_ASR_SECRET_ID')),
      secretKeyConfigured: Boolean(this.config.get<string>('TENCENT_ASR_SECRET_KEY')),
      mode: this.config.get<string>('TENCENT_ASR_MODE') ?? 'realtime',
    };
  }

  createRealtimeSession(options: TencentSessionOptions = {}) {
    const appId = this.required('TENCENT_ASR_APP_ID');
    const secretId = this.required('TENCENT_ASR_SECRET_ID');
    const secretKey = this.required('TENCENT_ASR_SECRET_KEY');
    const mode = options.mode ?? this.config.get<string>('TENCENT_ASR_MODE') ?? 'realtime';
    const voiceId = randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);
    const expired = timestamp + 24 * 60 * 60;
    const sampleRate = options.sampleRate ?? 16000;
    const endpoint = 'asr.cloud.tencent.com/asr/v2';

    const params = new URLSearchParams();
    params.set('convert_num_mode', '1');
    params.set('engine_model_type', this.engineModelType(mode));
    params.set('expired', String(expired));
    params.set('filter_dirty', '0');
    params.set('filter_modal', '0');
    params.set('filter_punc', '0');
    params.set('needvad', '1');
    params.set('nonce', String(this.randomNonce()));
    params.set('reinforce_hotword', '0');
    params.set('secretid', secretId);
    params.set('timestamp', String(timestamp));
    params.set('vad_silence_time', '800');
    params.set('voice_format', '1');
    params.set('voice_id', voiceId);
    params.set('word_info', '0');
    if (options.hotwordList?.length) {
      params.set('hotword_list', options.hotwordList.join('|'));
    }
    if (mode === 'speaker_diarization') {
      params.set('speaker_diarization', '1');
    }

    const unsigned = `${endpoint}/${appId}?${this.sortedParams(params)}`;
    const signature = createHmac('sha1', secretKey).update(unsigned).digest('base64');
    params.set('signature', signature);

    return {
      provider: 'tencent',
      mode,
      voiceId,
      sampleRate,
      websocketUrl: `wss://${endpoint}/${appId}?${this.sortedParams(params)}`,
      expiresAt: new Date(expired * 1000).toISOString(),
      instructions: {
        audioFormat: '16kHz mono 16-bit PCM',
        sendEndFrame: '{"type":"end"} is not used; close websocket after final audio chunk',
        persistResultsTo: 'POST /api/v1/sessions/:sessionId/transcriptions/tencent-result',
      },
    };
  }

  private engineModelType(mode: string) {
    return mode === 'speaker_diarization' ? '16k_zh_en' : '16k_zh_en';
  }

  private required(key: string) {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`${key} is not configured`);
    }
    return value;
  }

  private randomNonce() {
    return Math.floor(Math.random() * 10_000_000);
  }

  private sortedParams(params: URLSearchParams) {
    return [...params.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
  }
}
