import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../common/api-response';
import { CurrentUserParam } from '../common/current-user.decorator';
import type { CurrentUser } from '../common/types';
import { CreateProgressUpdateDto, CreateThreadDto, ThreadQueryDto, UpdateThreadDto } from './dto';
import { ThreadsService } from './threads.service';

@Controller('threads')
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get()
  async list(@CurrentUserParam() user: CurrentUser, @Query() query: ThreadQueryDto, @Req() request: Request) {
    return ok(await this.threadsService.list(user.id, query), request);
  }

  @Post()
  async create(@CurrentUserParam() user: CurrentUser, @Body() dto: CreateThreadDto, @Req() request: Request) {
    return ok(await this.threadsService.create(user.id, dto), request);
  }

  @Get(':threadId')
  async get(@CurrentUserParam() user: CurrentUser, @Param('threadId') threadId: string, @Req() request: Request) {
    return ok(await this.threadsService.get(user.id, threadId), request);
  }

  @Patch(':threadId')
  async update(
    @CurrentUserParam() user: CurrentUser,
    @Param('threadId') threadId: string,
    @Body() dto: UpdateThreadDto,
    @Req() request: Request,
  ) {
    return ok(await this.threadsService.update(user.id, threadId, dto), request);
  }

  @Delete(':threadId')
  async remove(@CurrentUserParam() user: CurrentUser, @Param('threadId') threadId: string, @Req() request: Request) {
    return ok(await this.threadsService.remove(user.id, threadId), request);
  }

  @Get(':threadId/preparation')
  async preparation(
    @CurrentUserParam() user: CurrentUser,
    @Param('threadId') threadId: string,
    @Req() request: Request,
  ) {
    return ok(await this.threadsService.getPreparation(user.id, threadId), request);
  }

  @Post(':threadId/preparation/refresh')
  async refreshPreparation(
    @CurrentUserParam() user: CurrentUser,
    @Param('threadId') threadId: string,
    @Req() request: Request,
  ) {
    return ok(await this.threadsService.getPreparation(user.id, threadId), request);
  }

  @Get(':threadId/action-items')
  async actionItems(
    @CurrentUserParam() user: CurrentUser,
    @Param('threadId') threadId: string,
    @Query('status') status: string | undefined,
    @Req() request: Request,
  ) {
    return ok(await this.threadsService.getThreadActionItems(user.id, threadId, status), request);
  }

  @Get(':threadId/progress-updates')
  async progressUpdates(
    @CurrentUserParam() user: CurrentUser,
    @Param('threadId') threadId: string,
    @Req() request: Request,
  ) {
    return ok(await this.threadsService.getProgressUpdates(user.id, threadId), request);
  }

  @Post(':threadId/progress-updates')
  async addProgressUpdate(
    @CurrentUserParam() user: CurrentUser,
    @Param('threadId') threadId: string,
    @Body() dto: CreateProgressUpdateDto,
    @Req() request: Request,
  ) {
    return ok(await this.threadsService.addProgressUpdate(user.id, threadId, dto), request);
  }
}
