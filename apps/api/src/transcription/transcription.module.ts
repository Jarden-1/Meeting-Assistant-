import { Module } from '@nestjs/common';
import { ThreadMemoryModule } from '../thread-memory/thread-memory.module';
import { EnhancementAudioStorageService } from './enhancement-audio-storage.service';
import { EnhancementChunksService } from './enhancement-chunks.service';
import { EnhancementWorkerService } from './enhancement-worker.service';
import { SpeakerAlignmentService } from './speaker-alignment.service';
import { TranscriptionController } from './transcription.controller';
import { TranscriptionService } from './transcription.service';
import { TencentAsrService } from './tencent-asr.service';

@Module({
  imports: [ThreadMemoryModule],
  controllers: [TranscriptionController],
  providers: [
    TranscriptionService,
    TencentAsrService,
    EnhancementChunksService,
    EnhancementAudioStorageService,
    SpeakerAlignmentService,
    EnhancementWorkerService,
  ],
})
export class TranscriptionModule {}
