import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe, stripeEnabled, appBaseUrl } from '@/lib/stripe';
import { getMembership } from '@/lib/workspace/data';
import { membershipCan } from '@/lib/workspace/permissions';
import { TOPUP_PACKS, isTopupPackId } from '@/lib/workspace/limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** One-time purchase of a top-up pack (non-expiring balance). Uses inline pricing. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const me = await getMembership(params.id, s.sub);
  if (!me || me.status !== 'active' || !membershipCan(me, 'workspace.billing')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!stripeEnabled()) return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { packId?: string };
  if (!isTopupPackId(body.packId)) return NextResponse.json({ error: 'Unknown top-up pack.' }, { status: 400 });
  const pack = TOPUP_PACKS[body.packId];

  const user = await prisma.user.findUnique({ where: { id: s.sub } });
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe().customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const meta = { kind: 'topup', workspaceId: params.id, packId: pack.id };
  const checkout = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: pack.priceCents,
          product_data: { name: `Flowcraft top-up — ${pack.label}` },
        },
      },
    ],
    success_url: `${appBaseUrl()}/workspace`,
    cancel_url: `${appBaseUrl()}/workspace`,
    metadata: meta,
    payment_intent_data: { metadata: meta },
  });

  return NextResponse.json({ url: checkout.url });
}
