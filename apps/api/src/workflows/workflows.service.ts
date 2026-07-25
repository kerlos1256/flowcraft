import { Injectable, NotFoundException } from '@nestjs/common';
import {
  emptyGraph,
  type FlowGraph,
  type WorkflowDto,
  type WorkflowSummaryDto,
  type WorkflowRunDto,
  type WorkflowStatus,
  type TriggerKind,
} from '@flowcraft/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { InngestService } from '../inngest/inngest.service';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inngest: InngestService,
  ) {}

  async list(): Promise<WorkflowSummaryDto[]> {
    const rows = await this.prisma.workflow.findMany({ orderBy: { updatedAt: 'desc' } });
    return rows.map((r) => {
      const graph = r.graph as unknown as FlowGraph;
      return {
        id: r.id,
        name: r.name,
        status: r.status as WorkflowStatus,
        nodeCount: graph.nodes?.length ?? 0,
        updatedAt: r.updatedAt.toISOString(),
      };
    });
  }

  async get(id: string): Promise<WorkflowDto> {
    const row = await this.prisma.workflow.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Workflow ${id} not found`);
    return toDto(row);
  }

  async create(name: string): Promise<WorkflowDto> {
    const row = await this.prisma.workflow.create({
      data: { name, graph: emptyGraph() as object, status: 'draft' },
    });
    return toDto(row);
  }

  async update(
    id: string,
    input: { name?: string; graph?: FlowGraph; status?: WorkflowStatus },
  ): Promise<WorkflowDto> {
    await this.requireExists(id);
    const row = await this.prisma.workflow.update({
      where: { id },
      data: {
        name: input.name,
        graph: input.graph as object | undefined,
        status: input.status,
      },
    });
    return toDto(row);
  }

  async remove(id: string): Promise<void> {
    await this.requireExists(id);
    await this.prisma.workflow.delete({ where: { id } });
  }

  /**
   * Create a run row and fire the Inngest event that durably executes the graph
   * (spec §4 Phase 3). Manual "Run Now" and the webhook endpoint both land here.
   */
  async run(
    id: string,
    triggeredBy: TriggerKind,
    payload: Record<string, unknown>,
  ): Promise<WorkflowRunDto> {
    const wf = await this.prisma.workflow.findUnique({ where: { id }, select: { id: true } });
    if (!wf) throw new NotFoundException(`Workflow ${id} not found`);

    const run = await this.prisma.workflowRun.create({
      data: { workflowId: id, status: 'running', triggeredBy },
    });
    await this.inngest.triggerRun({ workflowId: id, runId: run.id, triggeredBy, payload });

    return {
      id: run.id,
      workflowId: run.workflowId,
      inngestRunId: run.inngestRunId,
      status: 'running',
      triggeredBy,
      startedAt: run.startedAt.toISOString(),
      completedAt: null,
    };
  }

  private async requireExists(id: string): Promise<void> {
    const row = await this.prisma.workflow.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`Workflow ${id} not found`);
  }
}

function toDto(row: {
  id: string;
  name: string;
  graph: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): WorkflowDto {
  return {
    id: row.id,
    name: row.name,
    graph: row.graph as FlowGraph,
    status: row.status as WorkflowStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
