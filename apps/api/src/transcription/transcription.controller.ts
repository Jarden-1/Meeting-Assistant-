import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../common/api-response';
import { CurrentUserParam } from '../common/current-user.decorator';
import type { CurrentUser } from '../common/types';
import { CreateTencentSessionDto, CreateTranscriptionDto, PersistTencentResultDto } from './dto';
import { TranscriptionService } from './transcription.service';

@Controller('sessions/:sessionId/transcriptions')
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Post()
  async create(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateTranscriptionDto,
    @Req() request: Request,
  ) {
    return ok(await this.transcriptionService.create(user.id, sessionId, dto), request);
  }

  @Post('tencent-session')
  async createTencentSession(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateTencentSessionDto,
    @Req() request: Request,
  ) {
    return ok(await this.transcriptionService.createTencentSession(user.id, sessionId, dto), request);
  }

  @Post('tencent-result')
  async persistTencentResult(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: PersistTencentResultDto,
    @Req() request: Request,
  ) {
    return ok(await this.transcriptionService.persistTencentResult(user.id, sessionId, dto), request);
  }
}
