import { Body, Controller, Get, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../common/api-response';
import { CurrentUserParam } from '../common/current-user.decorator';
import type { CurrentUser } from '../common/types';
import { SaveCustomLlmDto } from './dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('llm')
  async getLlm(@CurrentUserParam() user: CurrentUser, @Req() request: Request) {
    return ok(await this.settingsService.getLlm(user.id), request);
  }

  @Put('llm/custom')
  async saveCustomLlm(
    @CurrentUserParam() user: CurrentUser,
    @Body() dto: SaveCustomLlmDto,
    @Req() request: Request,
  ) {
    return ok(await this.settingsService.saveCustomLlm(user.id, dto), request);
  }

  @Post('llm/test')
  async testLlm(@CurrentUserParam() user: CurrentUser, @Req() request: Request) {
    return ok(await this.settingsService.testLlm(user.id), request);
  }
}
