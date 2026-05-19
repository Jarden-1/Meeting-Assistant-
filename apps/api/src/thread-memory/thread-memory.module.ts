import { Module } from '@nestjs/common';
import { ThreadMemoryService } from './thread-memory.service';

@Module({
  providers: [ThreadMemoryService],
  exports: [ThreadMemoryService],
})
export class ThreadMemoryModule {}
