import Stripe from 'stripe';
import { PLANS, type PlanId } from './plans';

// Stripe client (test keys in dev/portfolio). Lazily instantiated so builds
// without the key still succeed.
let _stripe: Stripe | null = null;
export function stripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(key); // use the SDK's pinned API version
  }
  return _stripe;
}

export const stripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

/** The Stripe Price id for a paid plan (from env), or null for free/unset. */
export function priceIdFor(plan: PlanId): string | null {
  const cfg = PLANS[plan];
  if (!cfg.stripePriceEnv) return null;
  return process.env[cfg.stripePriceEnv] ?? null;
}

/** The Stripe Price id for an extra workspace seat ($12/mo), or null if unset. */
export const seatPriceId = (): string | null => process.env.STRIPE_PRICE_SEAT ?? null;

/** Reverse map a Stripe Price id back to our plan id. */
export function planForPriceId(priceId: string | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_TEAM) return 'team';
  return null;
}

/** The public base URL for Stripe redirect URLs. */
export function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3003';
}
