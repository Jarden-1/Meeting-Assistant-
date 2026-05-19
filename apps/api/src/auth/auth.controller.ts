import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../common/api-response';
import { CurrentUserParam } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import type { CurrentUser } from '../common/types';
import { AuthService } from './auth.service';
import { EnterDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('enter')
  async enter(@Body() dto: EnterDto, @Req() request: Request) {
    return ok(await this.authService.enter(dto.entryName), request);
  }

  @Get('me')
  me(@CurrentUserParam() user: CurrentUser, @Req() request: Request) {
    return ok(user, request);
  }

  @Post('logout')
  logout(@Req() request: Request) {
    return ok({ ok: true }, request);
  }
}
