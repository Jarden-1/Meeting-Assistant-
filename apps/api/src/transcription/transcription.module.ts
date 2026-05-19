import { Module } from '@nestjs/common';
import { ThreadMemoryModule } from '../thread-memory/thread-memory.module';
import { TranscriptionController } from './transcription.controller';
import { TranscriptionService } from './transcription.service';
import { TencentAsrService } from './tencent-asr.service';

@Module({
  imports: [ThreadMemoryModule],
  controllers: [TranscriptionController],
  providers: [TranscriptionService, TencentAsrService],
})
export class TranscriptionModule {}
