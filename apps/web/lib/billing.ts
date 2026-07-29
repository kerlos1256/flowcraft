import { prisma } from './prisma';
import { planConfig, type PlanConfig } from './plans';
import { aiTokenCost, type AiModelId } from './ai/models';
import type { Tenant } from './workspace/tenant';

/** Thrown when an action exceeds the user's plan; surfaced as HTTP 402 + upgrade CTA. */
export class LimitError extends Error {
  constructor(
    message: string,
    public code:
      | 'workflow_limit'
      | 'run_limit'
      | 'schedule_locked'
      | 'widget_limit'
      | 'ai_limit'
      | 'ai_workflow_limit'
      | 'ai_opus_locked',
  ) {
    super(message);
    this.name = 'LimitError';
  }
}

function startOfMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface PlanUsage {
  plan: PlanConfig;
  planId: string;
  workflows: number;
  runsThisMonth: number;
}

/** The user's plan + current usage counters (workflows, runs this calendar month). */
export async function getPlanAndUsage(userId: string): Promise<PlanUsage> {
  // Personal usage only — workspace (shared) resources don't count against a
  // user's personal Free/Pro limits.
  const [user, workflows, runsThisMonth] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
    prisma.workflow.count({ where: { userId, workspaceId: null } }),
    prisma.workflowRun.count({
      where: { workflow: { userId, workspaceId: null }, startedAt: { gte: startOfMonthUTC() } },
    }),
  ]);
  const planId = user?.plan ?? 'free';
  return { plan: planConfig(planId), planId, workflows, runsThisMonth };
}

export async function assertCanCreateWorkflow(userId: string): Promise<void> {
  const { plan, workflows } = await getPlanAndUsage(userId);
  if (workflows >= plan.maxWorkflows) {
    throw new LimitError(
      `You've reached your plan's limit of ${plan.maxWorkflows} workflows. Upgrade to create more.`,
      'workflow_limit',
    );
  }
}

export async function assertCanRun(userId: string): Promise<void> {
  const { plan, runsThisMonth } = await getPlanAndUsage(userId);
  if (runsThisMonth >= plan.maxRunsPerMonth) {
    throw new LimitError(
      `You've used all ${plan.maxRunsPerMonth.toLocaleString()} runs in your plan this month. Upgrade for more.`,
      'run_limit',
    );
  }
}

export async function assertCanSchedule(userId: string): Promise<void> {
  const { plan } = await getPlanAndUsage(userId);
  if (!plan.scheduled) {
    throw new LimitError('Scheduled (cron) triggers are a Pro feature. Upgrade to enable scheduling.', 'schedule_locked');
  }
}

/** The user's plan config (for widget entitlements). */
export async function getUserPlan(userId: string): Promise<PlanConfig> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  return planConfig(u?.plan);
}

export async function assertCanCreateWidget(userId: string): Promise<void> {
  const plan = await getUserPlan(userId);
  const widgets = await prisma.widget.count({ where: { userId, workspaceId: null } });
  if (widgets >= plan.maxWidgets) {
    throw new LimitError(
      `Your plan includes ${plan.maxWidgets} widget${plan.maxWidgets === 1 ? '' : 's'}. Upgrade to add more.`,
      'widget_limit',
    );
  }
}

// ── AI assistant token budget ──────────────────────────────────────────────────
// Free: 3 tokens lifetime, 1 per workflow, Sonnet only. Pro/Team: monthly budget,
// Sonnet + Opus. Usage is a SUM of token costs (Sonnet 1, Opus 2), counted at the
// account level — which is the workspace today (no multi-member model yet).

export interface AiUsage {
  planId: string;
  window: 'lifetime' | 'month';
  tokens: number;
  used: number;
  remaining: number;
  perWorkflowLimit: number | null;
  perWorkflowUsed: number;
  allowOpus: boolean;
}

export async function getAiUsage(tenant: Tenant, workflowId?: string): Promise<AiUsage> {
  // Workspace: a shared Team pool counted per workspace (flat allotment + top-ups = Phase 3).
  if (tenant.kind === 'workspace') {
    const plan = planConfig('team');
    const windowStart = plan.aiTokenWindow === 'month' ? startOfMonthUTC() : undefined;
    const usedAgg = await prisma.aiEdit.aggregate({
      _sum: { tokenCost: true },
      where: { workspaceId: tenant.workspaceId, ...(windowStart ? { createdAt: { gte: windowStart } } : {}) },
    });
    const used = usedAgg._sum.tokenCost ?? 0;
    return {
      planId: 'team',
      window: plan.aiTokenWindow,
      tokens: plan.aiTokens,
      used,
      remaining: Math.max(0, plan.aiTokens - used),
      perWorkflowLimit: null,
      perWorkflowUsed: 0,
      allowOpus: plan.aiOpus,
    };
  }

  // Personal: the user's own plan, counted over their personal (workspaceId null) edits.
  const plan = await getUserPlan(tenant.userId);
  const windowStart = plan.aiTokenWindow === 'month' ? startOfMonthUTC() : undefined;
  const [usedAgg, perWfAgg] = await Promise.all([
    prisma.aiEdit.aggregate({
      _sum: { tokenCost: true },
      where: { userId: tenant.userId, workspaceId: null, ...(windowStart ? { createdAt: { gte: windowStart } } : {}) },
    }),
    // Per-workflow cap is lifetime (a workflow gets its one free build ever).
    workflowId
      ? prisma.aiEdit.aggregate({ _sum: { tokenCost: true }, where: { userId: tenant.userId, workspaceId: null, workflowId } })
      : Promise.resolve(null),
  ]);
  const used = usedAgg._sum.tokenCost ?? 0;
  const perWorkflowUsed = perWfAgg?._sum.tokenCost ?? 0;
  return {
    planId: plan.id,
    window: plan.aiTokenWindow,
    tokens: plan.aiTokens,
    used,
    remaining: Math.max(0, plan.aiTokens - used),
    perWorkflowLimit: plan.aiPerWorkflowTokens,
    perWorkflowUsed,
    allowOpus: plan.aiOpus,
  };
}

export async function assertCanUseAi(tenant: Tenant, workflowId: string, model: AiModelId): Promise<void> {
  const cost = aiTokenCost(model);
  const u = await getAiUsage(tenant, workflowId);
  if (model === 'opus' && !u.allowOpus) {
    throw new LimitError('The Opus model is available on paid plans — switch to Sonnet, or upgrade to use Opus.', 'ai_opus_locked');
  }
  if (u.perWorkflowLimit != null && u.perWorkflowUsed + cost > u.perWorkflowLimit) {
    throw new LimitError(
      'The Free plan includes one AI build per workflow. Upgrade to Pro for unlimited AI edits per workflow.',
      'ai_workflow_limit',
    );
  }
  if (u.remaining < cost) {
    const msg =
      u.window === 'lifetime'
        ? "You've used all 3 of your free AI builds. Upgrade to Pro for 150 AI tokens every month."
        : "You've used all your AI tokens for this month. Upgrade or wait for your monthly reset.";
    throw new LimitError(msg, 'ai_limit');
  }
}
