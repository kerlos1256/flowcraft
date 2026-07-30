import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { stripe, planForPriceId } from '@/lib/stripe';
import { upsertSeatFromSubscription, type SeatStatus } from '@/lib/workspace/seats';
import { creditTopup } from '@/lib/workspace/usage';
import { TOPUP_PACKS, isTopupPackId } from '@/lib/workspace/limits';

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
        if (session.mode === 'payment' && session.metadata?.kind === 'topup') {
          await creditTopupFromSession(session);
        } else if (session.subscription) {
          const sub = await stripe().subscriptions.retrieve(String(session.subscription));
          await onSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await onSubscription(event.data.object as Stripe.Subscription);
        break;
      }
    }
  } catch (e) {
    // Log but 200 so Stripe doesn't hammer retries on a transient DB blip.
    console.error('webhook handler error', (e as Error).message);
  }

  return NextResponse.json({ received: true });
}

/** Credit a completed top-up purchase to the workspace balance (idempotent). */
async function creditTopupFromSession(session: Stripe.Checkout.Session): Promise<void> {
  const workspaceId = session.metadata?.workspaceId;
  const packId = session.metadata?.packId;
  if (!workspaceId || !isTopupPackId(packId)) return;
  const pack = TOPUP_PACKS[packId];
  const paymentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.id;
  await creditTopup(workspaceId, pack.kind, pack.amount, pack.priceCents, paymentId);
}

/** Route a subscription to seat-sync (workspace extra seat) or plan-sync (user plan). */
async function onSubscription(sub: Stripe.Subscription): Promise<void> {
  if (sub.metadata?.kind === 'seat') {
    const status: SeatStatus =
      sub.status === 'canceled' || sub.status === 'incomplete_expired'
        ? 'canceled'
        : sub.status === 'past_due' || sub.status === 'unpaid'
          ? 'past_due'
          : 'active';
    await upsertSeatFromSubscription(sub.metadata.workspaceId, sub.id, status);
    return;
  }
  await syncSubscription(sub);
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
