// Workspace metered enforcement + top-up balances. Server-only. Capacity is a
// flat monthly allotment (WORKSPACE_LIMITS) plus non-expiring top-up balances,
// consumed only after the allotment runs out.
import 'server-only';
import { prisma } from '@/lib/prisma';
import { LimitError } from '@/lib/billing';
import { WORKSPACE_LIMITS, type TopupKind } from './limits';

function startOfMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function runsThisMonth(workspaceId: string): Promise<number> {
  return prisma.workflowRun.count({
    where: { workflow: { workspaceId }, startedAt: { gte: startOfMonthUTC() } },
  });
}

async function aiTokensThisMonth(workspaceId: string): Promise<number> {
  const agg = await prisma.aiEdit.aggregate({
    _sum: { tokenCost: true },
    where: { workspaceId, createdAt: { gte: startOfMonthUTC() } },
  });
  return agg._sum.tokenCost ?? 0;
}

/** A run always happens, so consume a top-up run immediately on overflow. */
export async function assertWorkspaceCanRun(workspaceId: string): Promise<void> {
  if ((await runsThisMonth(workspaceId)) < WORKSPACE_LIMITS.runsPerMonth) return;
  const res = await prisma.workspace.updateMany({
    where: { id: workspaceId, topupRunsBalance: { gt: 0 } },
    data: { topupRunsBalance: { decrement: 1 } },
  });
  if (res.count === 0) {
    throw new LimitError("This workspace has used its monthly runs. Buy a runs top-up to keep running workflows.", 'run_limit');
  }
}

export async function assertWorkspaceCanCreateWidget(workspaceId: string): Promise<void> {
  const count = await prisma.widget.count({ where: { workspaceId } });
  if (count >= WORKSPACE_LIMITS.maxWidgets) {
    throw new LimitError(`This workspace includes ${WORKSPACE_LIMITS.maxWidgets} widgets.`, 'widget_limit');
  }
}

/** Whether an AI edit of `cost` tokens fits (allotment remaining + top-up balance). */
export async function workspaceAiAvailable(workspaceId: string, cost: number): Promise<boolean> {
  const [used, ws] = await Promise.all([
    aiTokensThisMonth(workspaceId),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { topupAiTokenBalance: true } }),
  ]);
  const allotmentRemaining = Math.max(0, WORKSPACE_LIMITS.aiTokensPerMonth - used);
  return allotmentRemaining + (ws?.topupAiTokenBalance ?? 0) >= cost;
}

/**
 * Deduct the portion of an AI edit that overflows the monthly allotment from the
 * top-up balance. Call AFTER a successful (non-refused) edit, BEFORE recording it
 * (so `used` excludes the current edit). Availability is checked up front.
 */
export async function consumeWorkspaceAiOverflow(workspaceId: string, cost: number): Promise<void> {
  const used = await aiTokensThisMonth(workspaceId);
  const allotmentRemaining = Math.max(0, WORKSPACE_LIMITS.aiTokensPerMonth - used);
  const shortfall = Math.max(0, cost - allotmentRemaining);
  if (shortfall > 0) {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { topupAiTokenBalance: { decrement: shortfall } },
    });
  }
}

export interface WorkspaceUsage {
  runs: { used: number; limit: number };
  ai: { used: number; limit: number };
  widgets: { used: number; limit: number };
  balances: { runs: number; aiTokens: number };
}

export async function getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
  const [runs, aiTokens, widgets, ws] = await Promise.all([
    runsThisMonth(workspaceId),
    aiTokensThisMonth(workspaceId),
    prisma.widget.count({ where: { workspaceId } }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { topupRunsBalance: true, topupAiTokenBalance: true },
    }),
  ]);
  return {
    runs: { used: runs, limit: WORKSPACE_LIMITS.runsPerMonth },
    ai: { used: aiTokens, limit: WORKSPACE_LIMITS.aiTokensPerMonth },
    widgets: { used: widgets, limit: WORKSPACE_LIMITS.maxWidgets },
    balances: { runs: ws?.topupRunsBalance ?? 0, aiTokens: ws?.topupAiTokenBalance ?? 0 },
  };
}

/** Credit a completed top-up to the balance (idempotent on the Stripe payment id). */
export async function creditTopup(
  workspaceId: string,
  kind: TopupKind,
  amount: number,
  priceCents: number,
  stripePaymentId: string | null,
): Promise<void> {
  if (stripePaymentId) {
    const exists = await prisma.topupPurchase.findUnique({ where: { stripePaymentId } });
    if (exists) return;
  }
  await prisma.$transaction([
    prisma.workspace.update({
      where: { id: workspaceId },
      data:
        kind === 'runs'
          ? { topupRunsBalance: { increment: amount } }
          : { topupAiTokenBalance: { increment: amount } },
    }),
    prisma.topupPurchase.create({ data: { workspaceId, kind, amount, priceCents, stripePaymentId } }),
  ]);
}
