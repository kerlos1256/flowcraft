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
import { scopeWhere, createStamp, type Tenant } from './workspace/tenant';
import { assertWorkspaceCanRun } from './workspace/usage';

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

export async function listWorkflows(tenant: Tenant): Promise<WorkflowSummaryDto[]> {
  const rows = await prisma.workflow.findMany({ where: scopeWhere(tenant), orderBy: { updatedAt: 'desc' } });
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

export async function getWorkflow(id: string, tenant: Tenant): Promise<WorkflowDto | null> {
  const r = await prisma.workflow.findFirst({ where: { id, ...scopeWhere(tenant) } });
  return r ? toWorkflowDto(r) : null;
}

export type TriggerKindInfo = 'webhook' | 'manual' | 'none';

export interface WorkflowTriggerInfo {
  id: string;
  name: string;
  triggerKind: TriggerKindInfo;
}

/** Classify a graph's entry trigger — used to guide/validate widget linking. */
export function graphTriggerKind(graph: FlowGraph): TriggerKindInfo {
  const types = (graph.nodes ?? []).map((n) => n.data?.type);
  if (types.includes('webhook_trigger')) return 'webhook';
  if (types.includes('manual_trigger')) return 'manual';
  return 'none';
}

/** The user's workflows with their trigger kind (for the widget link picker). */
export async function listWorkflowTriggerInfo(tenant: Tenant): Promise<WorkflowTriggerInfo[]> {
  const rows = await prisma.workflow.findMany({
    where: scopeWhere(tenant),
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, graph: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    triggerKind: graphTriggerKind(r.graph as unknown as FlowGraph),
  }));
}

export async function listRuns(tenant: Tenant, workflowId?: string): Promise<WorkflowRunDto[]> {
  const rows = await prisma.workflowRun.findMany({
    where: { workflow: scopeWhere(tenant), ...(workflowId ? { workflowId } : {}) },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });
  return rows.map(toRunDto);
}

export async function getRun(id: string, tenant: Tenant): Promise<RunDetailDto | null> {
  const run = await prisma.workflowRun.findFirst({
    where: { id, workflow: scopeWhere(tenant) },
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

export async function createWorkflow(tenant: Tenant, name: string): Promise<WorkflowDto> {
  if (tenant.kind === 'personal') await assertCanCreateWorkflow(tenant.userId); // → 402
  const r = await prisma.workflow.create({
    data: { ...createStamp(tenant), name, graph: emptyGraph() as object, status: 'draft' },
  });
  return toWorkflowDto(r);
}

export async function createWorkflowFromTemplate(
  tenant: Tenant,
  slug: string,
): Promise<WorkflowDto | null> {
  const tpl = TEMPLATE_BY_SLUG[slug];
  if (!tpl) return null;
  if (tenant.kind === 'personal') await assertCanCreateWorkflow(tenant.userId);
  const r = await prisma.workflow.create({
    data: { ...createStamp(tenant), name: tpl.name, graph: tpl.graph as object, status: 'draft' },
  });
  return toWorkflowDto(r);
}

export async function updateWorkflow(
  id: string,
  tenant: Tenant,
  input: { name?: string; graph?: FlowGraph; status?: WorkflowStatus },
): Promise<WorkflowDto | null> {
  const owned = await prisma.workflow.findFirst({ where: { id, ...scopeWhere(tenant) }, select: { id: true } });
  if (!owned) return null;
  // Activating enables the scheduled/cron trigger. Personal is plan-gated; a
  // workspace (Team) allows scheduling — permission is checked in the route.
  if (input.status === 'active' && tenant.kind === 'personal') await assertCanSchedule(tenant.userId);
  const r = await prisma.workflow.update({
    where: { id },
    data: { name: input.name, graph: input.graph as object | undefined, status: input.status },
  });

  // Any widget dropped as a trigger in this canvas should now fire THIS workflow.
  if (input.graph) {
    const widgetIds = input.graph.nodes
      .filter((n) => n.data?.type === 'widget_trigger')
      .map((n) => String(n.data.config?.widgetId ?? ''))
      .filter(Boolean);
    if (widgetIds.length) {
      await prisma.widget.updateMany({
        where: { id: { in: widgetIds }, ...scopeWhere(tenant) },
        data: { workflowId: id },
      });
    }
  }

  return toWorkflowDto(r);
}

export async function deleteWorkflow(id: string, tenant: Tenant): Promise<boolean> {
  const owned = await prisma.workflow.findFirst({ where: { id, ...scopeWhere(tenant) }, select: { id: true } });
  if (!owned) return false;
  await prisma.workflow.delete({ where: { id } });
  return true;
}

/** Manual "Run Now" — requires access in the current tenant. */
export async function runWorkflow(
  id: string,
  tenant: Tenant,
  payload: Record<string, unknown>,
): Promise<WorkflowRunDto | null> {
  const owned = await prisma.workflow.findFirst({ where: { id, ...scopeWhere(tenant) }, select: { id: true } });
  if (!owned) return null;
  if (tenant.kind === 'personal') await assertCanRun(tenant.userId);
  else await assertWorkspaceCanRun(tenant.workspaceId); // allotment + top-up runs
  return dispatchRun(id, 'manual', payload);
}

/** Webhook trigger — external caller (no session); counts against the owner's run quota. */
export async function runWorkflowByWebhook(
  id: string,
  payload: Record<string, unknown>,
): Promise<WorkflowRunDto | null> {
  const wf = await prisma.workflow.findUnique({ where: { id }, select: { userId: true, workspaceId: true } });
  if (!wf) return null;
  if (wf.workspaceId) await assertWorkspaceCanRun(wf.workspaceId);
  else await assertCanRun(wf.userId);
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
