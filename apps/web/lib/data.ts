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
import { TEMPLATE_BY_SLUG } from './templates';
import { assertCanCreateWorkflow, assertCanRun, assertCanSchedule } from './billing';

// ── Users ────────────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<{ id: string; email: string; name: string }> {
  const user = await prisma.user.create({
    data: { email: input.email.toLowerCase().trim(), name: input.name, passwordHash: input.passwordHash },
  });
  // No auto-seed — new users pick a use case in onboarding and get a tailored starter.
  return { id: user.id, email: user.email, name: user.name };
}

// ── Reads (scoped to the owner) ──────────────────────────────────────────────

export async function listWorkflows(userId: string): Promise<WorkflowSummaryDto[]> {
  const rows = await prisma.workflow.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
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

export async function getWorkflow(id: string, userId: string): Promise<WorkflowDto | null> {
  const r = await prisma.workflow.findFirst({ where: { id, userId } });
  return r ? toWorkflowDto(r) : null;
}

export async function listRuns(userId: string, workflowId?: string): Promise<WorkflowRunDto[]> {
  const rows = await prisma.workflowRun.findMany({
    where: { workflow: { userId }, ...(workflowId ? { workflowId } : {}) },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });
  return rows.map(toRunDto);
}

export async function getRun(id: string, userId: string): Promise<RunDetailDto | null> {
  const run = await prisma.workflowRun.findFirst({
    where: { id, workflow: { userId } },
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

// ── Writes (scoped to the owner) ─────────────────────────────────────────────

export async function createWorkflow(userId: string, name: string): Promise<WorkflowDto> {
  await assertCanCreateWorkflow(userId); // throws LimitError → 402
  const r = await prisma.workflow.create({
    data: { userId, name, graph: emptyGraph() as object, status: 'draft' },
  });
  return toWorkflowDto(r);
}

export async function createWorkflowFromTemplate(
  userId: string,
  slug: string,
): Promise<WorkflowDto | null> {
  const tpl = TEMPLATE_BY_SLUG[slug];
  if (!tpl) return null;
  await assertCanCreateWorkflow(userId);
  const r = await prisma.workflow.create({
    data: { userId, name: tpl.name, graph: tpl.graph as object, status: 'draft' },
  });
  return toWorkflowDto(r);
}

export async function updateWorkflow(
  id: string,
  userId: string,
  input: { name?: string; graph?: FlowGraph; status?: WorkflowStatus },
): Promise<WorkflowDto | null> {
  const owned = await prisma.workflow.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return null;
  // Activating a workflow enables its scheduled/cron trigger — gate on plan.
  if (input.status === 'active') await assertCanSchedule(userId);
  const r = await prisma.workflow.update({
    where: { id },
    data: { name: input.name, graph: input.graph as object | undefined, status: input.status },
  });
  return toWorkflowDto(r);
}

export async function deleteWorkflow(id: string, userId: string): Promise<boolean> {
  const owned = await prisma.workflow.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return false;
  await prisma.workflow.delete({ where: { id } });
  return true;
}

/** Manual "Run Now" — requires ownership. */
export async function runWorkflow(
  id: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<WorkflowRunDto | null> {
  const owned = await prisma.workflow.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return null;
  await assertCanRun(userId); // throws LimitError → 402
  return dispatchRun(id, 'manual', payload);
}

/** Webhook trigger — external caller (no session); counts against the owner's run quota. */
export async function runWorkflowByWebhook(
  id: string,
  payload: Record<string, unknown>,
): Promise<WorkflowRunDto | null> {
  const wf = await prisma.workflow.findUnique({ where: { id }, select: { userId: true } });
  if (!wf) return null;
  await assertCanRun(wf.userId);
  return dispatchRun(id, 'webhook', payload);
}

async function dispatchRun(
  workflowId: string,
  triggeredBy: TriggerKind,
  payload: Record<string, unknown>,
): Promise<WorkflowRunDto> {
  const run = await prisma.workflowRun.create({
    data: { workflowId, status: 'running', triggeredBy },
  });
  await inngest.send({
    name: WORKFLOW_RUN_EVENT,
    data: { workflowId, runId: run.id, triggeredBy, payload },
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
