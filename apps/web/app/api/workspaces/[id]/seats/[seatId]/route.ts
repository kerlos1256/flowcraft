import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { stripe, stripeEnabled } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { getMembership } from '@/lib/workspace/data';
import { getSeat } from '@/lib/workspace/seats';
import { membershipCan } from '@/lib/workspace/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Release an extra seat — cancels its subscription at period end. Must be empty. */
export async function DELETE(_req: Request, { params }: { params: { id: string; seatId: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await getMembership(params.id, s.sub);
  if (!me || me.status !== 'active' || !membershipCan(me, 'workspace.billing')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const seat = await getSeat(params.id, params.seatId);
  if (!seat) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (seat.kind === 'base') return NextResponse.json({ error: 'Base seats cannot be released.' }, { status: 400 });
  if (seat.assignedMembershipId) {
    return NextResponse.json({ error: 'Remove the member from this seat before releasing it.' }, { status: 400 });
  }

  if (seat.stripeSubscriptionId) {
    if (!stripeEnabled()) return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 });
    // Cancel at period end (no refund); the subscription.deleted webhook removes the seat.
    await stripe().subscriptions.update(seat.stripeSubscriptionId, { cancel_at_period_end: true });
    return NextResponse.json({ releasing: true });
  }

  // No subscription attached (shouldn't happen for extra seats) — drop it directly.
  await prisma.workspaceSeat.delete({ where: { id: seat.id } });
  return new NextResponse(null, { status: 204 });
}
