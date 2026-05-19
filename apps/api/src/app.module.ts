import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AssistantModule } from './assistant/assistant.module';
import { AuthModule } from './auth/auth.module';
import { DiscussionModule } from './discussion/discussion.module';
import { HealthModule } from './health/health.module';
import { AiModule } from './ai/ai.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { SessionsModule } from './sessions/sessions.module';
import { EncryptionModule } from './security/encryption.module';
import { SettingsModule } from './settings/settings.module';
import { ThreadMemoryModule } from './thread-memory/thread-memory.module';
import { ThreadsModule } from './threads/threads.module';
import { TranscriptionModule } from './transcription/transcription.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EncryptionModule,
    AuthModule,
    AiModule,
    DiscussionModule,
    HealthModule,
    ThreadMemoryModule,
    ThreadsModule,
    SessionsModule,
    AssistantModule,
    ReportsModule,
    TranscriptionModule,
    SettingsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
