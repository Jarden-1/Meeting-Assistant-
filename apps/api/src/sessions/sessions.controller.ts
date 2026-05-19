import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../common/api-response';
import { CurrentUserParam } from '../common/current-user.decorator';
import type { CurrentUser } from '../common/types';
import {
  CreateSessionDto,
  FinalizeSessionDto,
  MoveSessionDto,
  UpdateActionItemDto,
  UpdateSessionDto,
  UpdateTranscriptSegmentDto,
} from './dto';
import { SessionsService } from './sessions.service';

@Controller()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('threads/:threadId/sessions')
  async create(
    @CurrentUserParam() user: CurrentUser,
    @Param('threadId') threadId: string,
    @Body() dto: CreateSessionDto,
    @Req() request: Request,
  ) {
    return ok(await this.sessionsService.create(user.id, threadId, dto), request);
  }

  @Get('threads/:threadId/sessions')
  async list(
    @CurrentUserParam() user: CurrentUser,
    @Param('threadId') threadId: string,
    @Query('page') page: number | undefined,
    @Query('pageSize') pageSize: number | undefined,
    @Req() request: Request,
  ) {
    return ok(await this.sessionsService.list(user.id, threadId, page, pageSize), request);
  }

  @Get('sessions/:sessionId')
  async get(@CurrentUserParam() user: CurrentUser, @Param('sessionId') sessionId: string, @Req() request: Request) {
    return ok(await this.sessionsService.get(user.id, sessionId), request);
  }

  @Patch('sessions/:sessionId')
  async update(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateSessionDto,
    @Req() request: Request,
  ) {
    return ok(await this.sessionsService.update(user.id, sessionId, dto), request);
  }

  @Delete('sessions/:sessionId')
  async remove(@CurrentUserParam() user: CurrentUser, @Param('sessionId') sessionId: string, @Req() request: Request) {
    return ok(await this.sessionsService.remove(user.id, sessionId), request);
  }

  @Patch('sessions/:sessionId/thread')
  async move(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: MoveSessionDto,
    @Req() request: Request,
  ) {
    return ok(await this.sessionsService.move(user.id, sessionId, dto.threadId), request);
  }

  @Post('sessions/:sessionId/finalize')
  async finalize(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: FinalizeSessionDto,
    @Req() request: Request,
  ) {
    return ok(await this.sessionsService.finalize(user.id, sessionId, dto), request);
  }

  @Get('sessions/:sessionId/transcript-segments')
  async transcriptSegments(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Query('keyword') keyword: string | undefined,
    @Req() request: Request,
  ) {
    return ok(await this.sessionsService.getTranscriptSegments(user.id, sessionId, keyword), request);
  }

  @Patch('transcript-segments/:segmentId')
  async updateTranscriptSegment(
    @CurrentUserParam() user: CurrentUser,
    @Param('segmentId') segmentId: string,
    @Body() dto: UpdateTranscriptSegmentDto,
    @Req() request: Request,
  ) {
    return ok(await this.sessionsService.updateTranscriptSegment(user.id, segmentId, dto), request);
  }

  @Get('action-items/mine')
  async myActionItems(
    @CurrentUserParam() user: CurrentUser,
    @Query('view') view: string | undefined,
    @Query('status') status: string | undefined,
    @Req() request: Request,
  ) {
    return ok(await this.sessionsService.getMyActionItems(user.id, view, status), request);
  }

  @Patch('action-items/:actionItemId')
  async updateActionItem(
    @CurrentUserParam() user: CurrentUser,
    @Param('actionItemId') actionItemId: string,
    @Body() dto: UpdateActionItemDto,
    @Req() request: Request,
  ) {
    return ok(await this.sessionsService.updateActionItem(user.id, actionItemId, dto), request);
  }
}
