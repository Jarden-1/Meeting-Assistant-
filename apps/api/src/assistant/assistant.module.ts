import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ThreadMemoryModule } from '../thread-memory/thread-memory.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [AiModule, ThreadMemoryModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
