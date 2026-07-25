import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { WORKFLOW_STATUSES, type FlowGraph, type WorkflowStatus } from '@flowcraft/shared-types';
import { WorkflowsService } from './workflows.service';

class CreateWorkflowDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsObject()
  graph?: FlowGraph;

  @IsOptional()
  @IsIn(WORKFLOW_STATUSES as unknown as string[])
  status?: WorkflowStatus;
}

class TriggerDto {
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  list() {
    return this.workflows.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflows.get(id);
  }

  @Post()
  create(@Body() dto: CreateWorkflowDto) {
    return this.workflows.create(dto.name);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkflowDto) {
    return this.workflows.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.workflows.remove(id);
  }

  /** Manual "Run Now" (spec §4 Phase 3.1). */
  @Post(':id/run')
  @HttpCode(202)
  run(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TriggerDto) {
    return this.workflows.run(id, 'manual', dto.payload ?? {});
  }

  /** Webhook trigger (spec §4 Phase 3.2) — same durable execution, external entry. */
  @Post(':id/trigger')
  @HttpCode(202)
  trigger(@Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.workflows.run(id, 'webhook', body ?? {});
  }
}
