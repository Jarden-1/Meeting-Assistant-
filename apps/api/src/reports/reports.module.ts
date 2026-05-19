import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ThreadMemoryModule } from '../thread-memory/thread-memory.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AiModule, ThreadMemoryModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
