import { prisma } from './prisma';
import { runWorkflowByWebhook } from './data';
import { assertCanCreateWidget, getUserPlan } from './billing';
import { planConfig } from './plans';
import { scopeWhere, createStamp, type Tenant } from './workspace/tenant';
import {
  DEFAULT_THEME,
  defaultWidgetConfig,
  isWidgetType,
  type WidgetConfig,
  type WidgetPlacement,
  type WidgetType,
  type WidgetSummary,
  type WidgetFull,
} from './widgets';
import type { WorkflowRunDto } from '@flowcraft/shared-types';

/** Force config to plan entitlements: lock styling / branding on lower tiers.
 *  A workspace is Team-backed, so it always gets full styling / no forced branding. */
async function sanitizeForPlan(tenant: Tenant, config: WidgetConfig): Promise<WidgetConfig> {
  const plan = tenant.kind === 'workspace' ? planConfig('team') : await getUserPlan(tenant.userId);
  return {
    ...config,
    theme: plan.customStyling ? config.theme : { ...DEFAULT_THEME },
    branding: plan.removeBranding ? config.branding : true,
  };
}

export async function listWidgets(tenant: Tenant): Promise<WidgetSummary[]> {
  const rows = await prisma.widget.findMany({
    where: scopeWhere(tenant),
    orderBy: { createdAt: 'desc' },
    include: { workflow: { select: { name: true } } },
  });
  return rows.map((r) => toSummary(r, r.workflow.name));
}

export async function getWidget(id: string, tenant: Tenant): Promise<WidgetFull | null> {
  const r = await prisma.widget.findFirst({
    where: { id, ...scopeWhere(tenant) },
    include: { workflow: { select: { name: true } } },
  });
  if (!r) return null;
  return { ...toSummary(r, r.workflow.name), config: r.config as unknown as WidgetConfig };
}

/** Public read for the embed (no owner scope). */
export async function getWidgetPublic(
  id: string,
): Promise<{ id: string; type: string; placement: string; config: WidgetConfig; workflowId: string } | null> {
  const r = await prisma.widget.findUnique({ where: { id } });
  if (!r) return null;
  return {
    id: r.id,
    type: r.type,
    placement: r.placement,
    config: r.config as unknown as WidgetConfig,
    workflowId: r.workflowId,
  };
}

export async function createWidget(
  tenant: Tenant,
  input: { name: string; type: string; workflowId: string; placement?: WidgetPlacement },
): Promise<WidgetFull | null> {
  if (!isWidgetType(input.type)) return null;
  const owns = await prisma.workflow.findFirst({
    where: { id: input.workflowId, ...scopeWhere(tenant) },
    select: { id: true },
  });
  if (!owns) return null; // must link a workflow in this tenant
  if (tenant.kind === 'personal') await assertCanCreateWidget(tenant.userId); // → 402 (workspace: Phase 3)

  const base = defaultWidgetConfig(input.type);
  const config = await sanitizeForPlan(tenant, base);
  const placement = input.placement ?? 'inline';

  const r = await prisma.widget.create({
    data: {
      ...createStamp(tenant),
      workflowId: input.workflowId,
      name: input.name,
      type: input.type,
      placement,
      config: config as object,
    },
    include: { workflow: { select: { name: true } } },
  });
  return { ...toSummary(r, r.workflow.name), config };
}

export async function updateWidget(
  id: string,
  tenant: Tenant,
  patch: { name?: string; placement?: WidgetPlacement; config?: WidgetConfig; workflowId?: string },
): Promise<WidgetFull | null> {
  const owned = await prisma.widget.findFirst({ where: { id, ...scopeWhere(tenant) }, select: { id: true } });
  if (!owned) return null;

  let config: object | undefined;
  if (patch.config) config = (await sanitizeForPlan(tenant, patch.config)) as object;

  // If re-linking, verify the new workflow is in the same tenant.
  if (patch.workflowId) {
    const ok = await prisma.workflow.findFirst({ where: { id: patch.workflowId, ...scopeWhere(tenant) }, select: { id: true } });
    if (!ok) return null;
  }

  const r = await prisma.widget.update({
    where: { id },
    data: { name: patch.name, placement: patch.placement, workflowId: patch.workflowId, config },
    include: { workflow: { select: { name: true } } },
  });
  return { ...toSummary(r, r.workflow.name), config: r.config as unknown as WidgetConfig };
}

export async function deleteWidget(id: string, tenant: Tenant): Promise<boolean> {
  const owned = await prisma.widget.findFirst({ where: { id, ...scopeWhere(tenant) }, select: { id: true } });
  if (!owned) return false;
  await prisma.widget.delete({ where: { id } });
  return true;
}

/** Fire the widget's linked workflow with the submitted payload (durable via Inngest). */
export async function submitToWidget(
  workflowId: string,
  payload: Record<string, unknown>,
): Promise<WorkflowRunDto | null> {
  return runWorkflowByWebhook(workflowId, payload);
}

function toSummary(
  r: { id: string; name: string; type: string; placement: string; workflowId: string; createdAt: Date },
  workflowName: string,
): WidgetSummary {
  return {
    id: r.id,
    name: r.name,
    type: r.type as WidgetType,
    placement: r.placement as WidgetPlacement,
    workflowId: r.workflowId,
    workflowName,
    createdAt: r.createdAt.toISOString(),
  };
}
