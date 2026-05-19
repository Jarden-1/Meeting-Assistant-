import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../common/api-response';
import { CurrentUserParam } from '../common/current-user.decorator';
import type { CurrentUser } from '../common/types';
import { AssistantService } from './assistant.service';
import { AssistantAskDto } from './dto';

@Controller('sessions/:sessionId/assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('ask')
  async ask(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: AssistantAskDto,
    @Req() request: Request,
  ) {
    return ok(await this.assistantService.ask(user.id, sessionId, dto), request);
  }

  @Get('messages')
  async messages(@CurrentUserParam() user: CurrentUser, @Param('sessionId') sessionId: string, @Req() request: Request) {
    return ok(await this.assistantService.messages(user.id, sessionId), request);
  }
}
