import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  FlowGraph,
  WorkflowRunDto,
  RunDetailDto,
  RunStepDto,
  RunStatus,
  StepStatus,
  TriggerKind,
  NodeCategory,
} from '@flowcraft/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RunsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workflowId?: string): Promise<WorkflowRunDto[]> {
    const rows = await this.prisma.workflowRun.findMany({
      where: workflowId ? { workflowId } : undefined,
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
    return rows.map(toRunDto);
  }

  async detail(id: string): Promise<RunDetailDto> {
    const run = await this.prisma.workflowRun.findUnique({
      where: { id },
      include: {
        workflow: { select: { name: true, graph: true } },
        steps: { orderBy: { startedAt: 'asc' } },
      },
    });
    if (!run) throw new NotFoundException(`Run ${id} not found`);

    return {
      ...toRunDto(run),
      workflowName: run.workflow.name,
      graph: run.workflow.graph as unknown as FlowGraph,
      steps: run.steps.map(toStepDto),
    };
  }
}

function toRunDto(run: {
  id: string;
  workflowId: string;
  inngestRunId: string | null;
  status: string;
  triggeredBy: string;
  startedAt: Date;
  completedAt: Date | null;
}): WorkflowRunDto {
  return {
    id: run.id,
    workflowId: run.workflowId,
    inngestRunId: run.inngestRunId,
    status: run.status as RunStatus,
    triggeredBy: run.triggeredBy as TriggerKind,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
  };
}

function toStepDto(step: {
  id: string;
  runId: string;
  nodeId: string;
  stepType: string;
  status: string;
  input: unknown;
  output: unknown;
  error: string | null;
  attempts: number;
  startedAt: Date;
  completedAt: Date | null;
}): RunStepDto {
  return {
    id: step.id,
    runId: step.runId,
    nodeId: step.nodeId,
    stepType: step.stepType as NodeCategory,
    status: step.status as StepStatus,
    input: (step.input ?? {}) as Record<string, unknown>,
    output: (step.output ?? null) as Record<string, unknown> | null,
    error: step.error,
    attempts: step.attempts,
    startedAt: step.startedAt.toISOString(),
    completedAt: step.completedAt ? step.completedAt.toISOString() : null,
  };
}
