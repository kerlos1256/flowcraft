import {
  emptyGraph,
  WORKFLOW_RUN_EVENT,
  type FlowGraph,
  type WorkflowDto,
  type WorkflowSummaryDto,
  type WorkflowRunDto,
  type RunDetailDto,
  type RunStepDto,
  type WorkflowStatus,
  type RunStatus,
  type StepStatus,
  type TriggerKind,
  type NodeCategory,
} from '@flowcraft/shared-types';
import { prisma } from './prisma';
import { inngest } from './inngest/client';

// ── Reads ────────────────────────────────────────────────────────────────────

export async function listWorkflows(): Promise<WorkflowSummaryDto[]> {
  const rows = await prisma.workflow.findMany({ orderBy: { updatedAt: 'desc' } });
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

export async function getWorkflow(id: string): Promise<WorkflowDto | null> {
  const r = await prisma.workflow.findUnique({ where: { id } });
  return r ? toWorkflowDto(r) : null;
}

export async function listRuns(workflowId?: string): Promise<WorkflowRunDto[]> {
  const rows = await prisma.workflowRun.findMany({
    where: workflowId ? { workflowId } : undefined,
    orderBy: { startedAt: 'desc' },
    take: 100,
  });
  return rows.map(toRunDto);
}

export async function getRun(id: string): Promise<RunDetailDto | null> {
  const run = await prisma.workflowRun.findUnique({
    where: { id },
    include: {
      workflow: { select: { name: true, graph: true } },
      steps: { orderBy: { startedAt: 'asc' } },
    },
  });
  if (!run) return null;
  return {
    ...toRunDto(run),
    workflowName: run.workflow.name,
    graph: run.workflow.graph as unknown as FlowGraph,
    steps: run.steps.map(toStepDto),
  };
}

// ── Writes ───────────────────────────────────────────────────────────────────

export async function createWorkflow(name: string): Promise<WorkflowDto> {
  const r = await prisma.workflow.create({
    data: { name, graph: emptyGraph() as object, status: 'draft' },
  });
  return toWorkflowDto(r);
}

export async function updateWorkflow(
  id: string,
  input: { name?: string; graph?: FlowGraph; status?: WorkflowStatus },
): Promise<WorkflowDto | null> {
  const exists = await prisma.workflow.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return null;
  const r = await prisma.workflow.update({
    where: { id },
    data: { name: input.name, graph: input.graph as object | undefined, status: input.status },
  });
  return toWorkflowDto(r);
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const exists = await prisma.workflow.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return false;
  await prisma.workflow.delete({ where: { id } });
  return true;
}

/** Create a run row + fire the durable Inngest event that executes the graph. */
export async function runWorkflow(
  id: string,
  triggeredBy: TriggerKind,
  payload: Record<string, unknown>,
): Promise<WorkflowRunDto | null> {
  const wf = await prisma.workflow.findUnique({ where: { id }, select: { id: true } });
  if (!wf) return null;
  const run = await prisma.workflowRun.create({
    data: { workflowId: id, status: 'running', triggeredBy },
  });
  await inngest.send({
    name: WORKFLOW_RUN_EVENT,
    data: { workflowId: id, runId: run.id, triggeredBy, payload },
  });
  return toRunDto(run);
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function toWorkflowDto(r: {
  id: string;
  name: string;
  graph: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): WorkflowDto {
  return {
    id: r.id,
    name: r.name,
    graph: r.graph as FlowGraph,
    status: r.status as WorkflowStatus,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
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

function toStepDto(s: {
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
    id: s.id,
    runId: s.runId,
    nodeId: s.nodeId,
    stepType: s.stepType as NodeCategory,
    status: s.status as StepStatus,
    input: (s.input ?? {}) as Record<string, unknown>,
    output: (s.output ?? null) as Record<string, unknown> | null,
    error: s.error,
    attempts: s.attempts,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
  };
}
