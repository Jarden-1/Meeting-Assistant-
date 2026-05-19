import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ThreadMemoryModule } from '../thread-memory/thread-memory.module';
import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';

@Module({
  imports: [AiModule, ThreadMemoryModule],
  controllers: [DiscussionController],
  providers: [DiscussionService],
})
export class DiscussionModule {}
