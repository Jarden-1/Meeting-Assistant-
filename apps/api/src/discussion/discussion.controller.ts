import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../common/api-response';
import { CurrentUserParam } from '../common/current-user.decorator';
import type { CurrentUser } from '../common/types';
import { ExtractDiscussionDto } from './dto';
import { DiscussionService } from './discussion.service';

@Controller('sessions/:sessionId/discussion-chains')
export class DiscussionController {
  constructor(private readonly discussionService: DiscussionService) {}

  @Post('extract')
  async extract(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: ExtractDiscussionDto,
    @Req() request: Request,
  ) {
    return ok(await this.discussionService.extract(user.id, sessionId, dto), request);
  }

  @Get()
  async list(@CurrentUserParam() user: CurrentUser, @Param('sessionId') sessionId: string, @Req() request: Request) {
    return ok(await this.discussionService.list(user.id, sessionId), request);
  }
}
