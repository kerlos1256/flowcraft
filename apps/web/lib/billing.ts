import { prisma } from './prisma';
import { planConfig, type PlanConfig } from './plans';

/** Thrown when an action exceeds the user's plan; surfaced as HTTP 402 + upgrade CTA. */
export class LimitError extends Error {
  constructor(
    message: string,
    public code: 'workflow_limit' | 'run_limit' | 'schedule_locked',
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
  const [user, workflows, runsThisMonth] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
    prisma.workflow.count({ where: { userId } }),
    prisma.workflowRun.count({
      where: { workflow: { userId }, startedAt: { gte: startOfMonthUTC() } },
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
