// Seat management (pre-buy-then-assign). The 2 base seats come with the Team plan;
// extra seats are each their own $12/mo Stripe subscription. A seat can be paid but
// unassigned; joining a workspace consumes a free seat. Server-only.
import 'server-only';
import { prisma } from '@/lib/prisma';

/** Seats included in the Team base plan (owner + 1). */
export const BASE_SEATS = 2;
/** Soft cap on total seats per workspace (support/abuse bound). */
export const MAX_SEATS = 25;

export type SeatStatus = 'active' | 'past_due' | 'canceled';

export interface SeatInfo {
  id: string;
  kind: 'base' | 'extra';
  status: string;
  assignedMembershipId: string | null;
  assignedName: string | null;
  subscriptionId: string | null;
}

/** Create the 2 base seats for a new workspace and seat the owner. */
export async function provisionBaseSeats(workspaceId: string, ownerMembershipId: string): Promise<void> {
  await prisma.workspaceSeat.create({
    data: { workspaceId, kind: 'base', status: 'active', assignedMembershipId: ownerMembershipId },
  });
  await prisma.workspaceSeat.create({ data: { workspaceId, kind: 'base', status: 'active' } });
}

/** Backfill base seats for a workspace that predates seat tracking. */
export async function ensureBaseSeats(workspaceId: string, ownerMembershipId: string): Promise<void> {
  const count = await prisma.workspaceSeat.count({ where: { workspaceId, kind: 'base' } });
  if (count === 0) await provisionBaseSeats(workspaceId, ownerMembershipId);
}

/** Seat a membership on the first free active seat (base seats fill first). */
export async function assignFreeSeat(workspaceId: string, membershipId: string): Promise<boolean> {
  const already = await prisma.workspaceSeat.findUnique({ where: { assignedMembershipId: membershipId } });
  if (already) return true;
  const seat = await prisma.workspaceSeat.findFirst({
    where: { workspaceId, status: 'active', assignedMembershipId: null },
    orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }], // 'base' < 'extra'
  });
  if (!seat) return false;
  await prisma.workspaceSeat.update({ where: { id: seat.id }, data: { assignedMembershipId: membershipId } });
  return true;
}

/** Seats left to fill = free active seats − pending invites (each reserves one). */
export async function availableSeats(workspaceId: string): Promise<number> {
  const [free, pending] = await Promise.all([
    prisma.workspaceSeat.count({ where: { workspaceId, status: 'active', assignedMembershipId: null } }),
    prisma.workspaceInvite.count({ where: { workspaceId, status: 'pending' } }),
  ]);
  return free - pending;
}

/** Total non-canceled seats (for the MAX_SEATS cap). */
export async function seatCount(workspaceId: string): Promise<number> {
  return prisma.workspaceSeat.count({ where: { workspaceId, status: { not: 'canceled' } } });
}

export async function listSeats(workspaceId: string): Promise<SeatInfo[]> {
  const rows = await prisma.workspaceSeat.findMany({
    where: { workspaceId },
    orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
    include: { assignedMembership: { select: { displayName: true } } },
  });
  return rows.map((s) => ({
    id: s.id,
    kind: s.kind as 'base' | 'extra',
    status: s.status,
    assignedMembershipId: s.assignedMembershipId,
    assignedName: s.assignedMembership?.displayName ?? null,
    subscriptionId: s.stripeSubscriptionId,
  }));
}

export async function getSeat(workspaceId: string, seatId: string) {
  return prisma.workspaceSeat.findFirst({ where: { id: seatId, workspaceId } });
}

/**
 * Reconcile a seat with its Stripe subscription state (called from the webhook).
 * Creates the seat on first sight, mirrors status onto the assigned member
 * (past_due/canceled → deactivated; active → active), and removes it on cancel.
 */
export async function upsertSeatFromSubscription(
  workspaceId: string | undefined,
  subscriptionId: string,
  status: SeatStatus,
): Promise<void> {
  const existing = await prisma.workspaceSeat.findUnique({ where: { stripeSubscriptionId: subscriptionId } });

  if (status === 'canceled') {
    if (existing) {
      if (existing.assignedMembershipId) {
        await prisma.membership.update({ where: { id: existing.assignedMembershipId }, data: { status: 'deactivated' } });
      }
      await prisma.workspaceSeat.delete({ where: { id: existing.id } });
    }
    return;
  }

  if (existing) {
    await prisma.workspaceSeat.update({ where: { id: existing.id }, data: { status } });
    if (existing.assignedMembershipId) {
      await prisma.membership.update({
        where: { id: existing.assignedMembershipId },
        data: { status: status === 'active' ? 'active' : 'deactivated' },
      });
    }
    return;
  }

  if (!workspaceId) return; // can't create a seat without knowing its workspace
  await prisma.workspaceSeat.create({
    data: { workspaceId, kind: 'extra', stripeSubscriptionId: subscriptionId, status },
  });
}
