import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { stripe, planForPriceId } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Stripe webhook — the source of truth that syncs subscription state → user plan. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get('stripe-signature');
  if (!secret || !sig) return NextResponse.json({ error: 'not configured' }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    return NextResponse.json({ error: `signature: ${(e as Error).message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe().subscriptions.retrieve(String(session.subscription));
          await syncSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
    }
  } catch (e) {
    // Log but 200 so Stripe doesn't hammer retries on a transient DB blip.
    console.error('webhook handler error', (e as Error).message);
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const userId = sub.metadata?.userId;
  if (!userId) return;
  const priceId = sub.items.data[0]?.price?.id;
  const active = ['active', 'trialing', 'past_due'].includes(sub.status);
  const plan = active ? (planForPriceId(priceId) ?? 'free') : 'free';

  await prisma.user
    .update({
      where: { id: userId },
      data: {
        plan,
        stripeSubscriptionId: sub.id,
        stripeStatus: sub.status,
        stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      },
    })
    .catch(() => undefined);
}
