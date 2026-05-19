import { Module } from '@nestjs/common';
import { ThreadMemoryModule } from '../thread-memory/thread-memory.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [ThreadMemoryModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
