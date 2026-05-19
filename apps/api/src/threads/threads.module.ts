import { Module } from '@nestjs/common';
import { ThreadMemoryModule } from '../thread-memory/thread-memory.module';
import { ThreadsController } from './threads.controller';
import { ThreadsService } from './threads.service';

@Module({
  imports: [ThreadMemoryModule],
  controllers: [ThreadsController],
  providers: [ThreadsService],
  exports: [ThreadsService],
})
export class ThreadsModule {}
