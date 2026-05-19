import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../common/api-response';
import { CurrentUserParam } from '../common/current-user.decorator';
import type { CurrentUser } from '../common/types';
import { GenerateReportDraftDto } from './dto';
import { ReportsService } from './reports.service';

@Controller('sessions/:sessionId')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('report-draft')
  async generateReportDraft(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: GenerateReportDraftDto,
    @Req() request: Request,
  ) {
    return ok(await this.reportsService.generate(user.id, sessionId, dto), request);
  }

  @Get('report-draft')
  async latestReportDraft(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Req() request: Request,
  ) {
    return ok(await this.reportsService.latest(user.id, sessionId), request);
  }

  @Get('report-draft/progress')
  async progress(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Req() request: Request,
  ) {
    return ok(await this.reportsService.progress(user.id, sessionId), request);
  }

  @Post('follow-up-draft')
  async generateFollowUpAlias(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: GenerateReportDraftDto,
    @Req() request: Request,
  ) {
    return ok(await this.reportsService.generate(user.id, sessionId, dto), request);
  }

  @Get('follow-up-draft')
  async followUpAlias(@CurrentUserParam() user: CurrentUser, @Param('sessionId') sessionId: string, @Req() request: Request) {
    return ok(await this.reportsService.latest(user.id, sessionId), request);
  }

  @Get('follow-up-draft/progress')
  async followUpProgressAlias(
    @CurrentUserParam() user: CurrentUser,
    @Param('sessionId') sessionId: string,
    @Req() request: Request,
  ) {
    return ok(await this.reportsService.progress(user.id, sessionId), request);
  }
}
