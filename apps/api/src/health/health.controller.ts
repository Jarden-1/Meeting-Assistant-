import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../common/api-response';
import { Public } from '../common/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async getHealth(@Req() request: Request) {
    let database = 'unknown';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'ok';
    } catch {
      database = 'error';
    }

    return ok(
      {
        ok: database === 'ok',
        service: 'meeting-assistant-api',
        database,
        timestamp: new Date().toISOString(),
      },
      request,
    );
  }
}
