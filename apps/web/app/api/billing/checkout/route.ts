import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe, stripeEnabled, priceIdFor, appBaseUrl } from '@/lib/stripe';
import { isPlanId } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Start a Stripe Checkout session to subscribe to a paid plan. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!stripeEnabled()) return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  const plan = body.plan;
  if (!plan || !isPlanId(plan) || plan === 'free') {
    return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });
  }
  const priceId = priceIdFor(plan);
  if (!priceId) return NextResponse.json({ error: 'Plan price not configured.' }, { status: 503 });

  const user = await prisma.user.findUnique({ where: { id: s.sub } });
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Ensure a Stripe customer exists for this user.
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
    allow_promotion_codes: true,
    success_url: `${appBaseUrl()}/app?upgraded=1`,
    cancel_url: `${appBaseUrl()}/pricing`,
    metadata: { userId: user.id, plan },
    subscription_data: { metadata: { userId: user.id, plan } },
  });

  return NextResponse.json({ url: checkout.url });
}
