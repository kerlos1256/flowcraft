import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { RunsService } from './runs.service';

@Controller('runs')
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Get()
  list(@Query('workflowId') workflowId?: string) {
    return this.runs.list(workflowId);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.runs.detail(id);
  }
}
