import { Injectable } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class EnhancementAudioStorageService {
  async save(sessionId: string, chunkIndex: number, audioBase64: string, audioMimeType = 'audio/wav') {
    const extension = audioMimeType.includes('webm') ? 'webm' : audioMimeType.includes('mpeg') ? 'mp3' : 'wav';
    const root = process.env.ENHANCEMENT_AUDIO_TEMP_DIR || join(process.cwd(), 'tmp', 'enhancement-audio');
    const dir = join(root, sessionId);
    await mkdir(dir, { recursive: true });
    const path = join(dir, `chunk-${chunkIndex}.${extension}`);
    const cleaned = audioBase64.includes(',') ? audioBase64.split(',').pop() ?? '' : audioBase64;
    await writeFile(path, Buffer.from(cleaned, 'base64'));
    return path;
  }

  async remove(audioPath: string) {
    if (!audioPath) return;
    try {
      await unlink(audioPath);
    } catch {
      // 临时音频清理失败不影响已落库的精修文本。
    }
  }
}
