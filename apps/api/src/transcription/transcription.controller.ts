import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../common/api-response';
import { CurrentUserParam } from '../common/current-user.decorator';
import type { CurrentUser } from '../common/types';
import {
  CompleteEnhancementChunkDto,
  CreateEnhancementChunkDto,
  CreateTencentSessionDto,
  CreateTranscriptionDto,
  FailEnhancementChunkDto,
  PersistTencentResultDto,
} from './dto';
import { EnhancementChunksService } from './enhancement-chunks.service';
import { TranscriptionService } from './transcription.service';

@Controller('sessions/:sessionId/transcriptions')
export class TranscriptionController {
  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly enhancementChunks: EnhancementChunksService,
  ) {}

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

  @Post('enhancement-chunks')
  async createEnhancementChunk(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateEnhancementChunkDto,
    @Req() request: Request,
  ) {
    return ok(await this.enhancementChunks.create(user.id, sessionId, dto), request);
  }

  @Get('enhancement-chunks')
  async listEnhancementChunks(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Req() request: Request,
  ) {
    return ok(await this.enhancementChunks.list(user.id, sessionId), request);
  }

  @Get('enhancement-status')
  async getEnhancementStatus(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Req() request: Request,
  ) {
    return ok(await this.enhancementChunks.getStatus(user.id, sessionId), request);
  }

  @Post('enhancement-chunks/:chunkId/result')
  async completeEnhancementChunk(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Param('chunkId') chunkId: string,
    @Body() dto: CompleteEnhancementChunkDto,
    @Req() request: Request,
  ) {
    return ok(await this.enhancementChunks.complete(user.id, sessionId, chunkId, dto), request);
  }

  @Patch('enhancement-chunks/:chunkId/status')
  async updateEnhancementChunkStatus(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Param('chunkId') chunkId: string,
    @Body() dto: FailEnhancementChunkDto,
    @Req() request: Request,
  ) {
    return ok(await this.enhancementChunks.fail(user.id, sessionId, chunkId, dto), request);
  }
}
