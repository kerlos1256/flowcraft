import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe, stripeEnabled, seatPriceId, appBaseUrl } from '@/lib/stripe';
import { getMembership } from '@/lib/workspace/data';
import { seatCount, MAX_SEATS } from '@/lib/workspace/seats';
import { membershipCan } from '@/lib/workspace/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Buy one extra seat — creates a dedicated $12/mo subscription on the owner's customer. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await getMembership(params.id, s.sub);
  if (!me || me.status !== 'active' || !membershipCan(me, 'workspace.billing')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!stripeEnabled()) return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 });
  const priceId = seatPriceId();
  if (!priceId) return NextResponse.json({ error: 'Seat price not configured.' }, { status: 503 });

  if ((await seatCount(params.id)) >= MAX_SEATS) {
    return NextResponse.json({ error: `Workspaces are limited to ${MAX_SEATS} seats.` }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: s.sub } });
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const checkout = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appBaseUrl()}/workspace`,
    cancel_url: `${appBaseUrl()}/workspace`,
    metadata: { kind: 'seat', workspaceId: params.id },
    subscription_data: { metadata: { kind: 'seat', workspaceId: params.id } },
  });

  return NextResponse.json({ url: checkout.url });
}
