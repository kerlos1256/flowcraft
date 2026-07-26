// Plan entitlements + display metadata — the single source of truth for billing.
// `plan` on the User row is authoritative (kept in sync by the Stripe webhook);
// these configs turn a plan into concrete limits and marketing copy.

export type PlanId = 'free' | 'pro' | 'team';

export interface PlanConfig {
  id: PlanId;
  name: string;
  /** Monthly price in USD (0 for free). */
  priceMonthly: number;
  blurb: string;
  // ── entitlements (enforced) ──
  maxWorkflows: number; // Infinity = unlimited
  maxRunsPerMonth: number;
  scheduled: boolean; // cron/active triggers
  historyDays: number;
  // ── display ──
  features: string[];
  popular?: boolean;
  /** Env var holding the Stripe Price id for this plan (paid plans only). */
  stripePriceEnv?: string;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    blurb: 'For trying things out and small personal automations.',
    maxWorkflows: 5,
    maxRunsPerMonth: 100,
    scheduled: false,
    historyDays: 7,
    features: [
      '5 active workflows',
      '100 runs / month',
      'Manual + webhook triggers',
      'Visual builder + every node type',
      'Durable execution, retries & branching',
      'Starter templates',
      '7-day run history',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 12,
    blurb: 'For makers running real automations in production.',
    maxWorkflows: 25,
    maxRunsPerMonth: 10_000,
    scheduled: true,
    historyDays: 90,
    popular: true,
    stripePriceEnv: 'STRIPE_PRICE_PRO',
    features: [
      '25 active workflows',
      '10,000 runs / month',
      'Scheduled (cron) triggers',
      'Everything in Free',
      '90-day run history',
      'Priority execution & support',
    ],
  },
  team: {
    id: 'team',
    name: 'Team',
    priceMonthly: 39,
    blurb: 'For teams automating at scale.',
    maxWorkflows: Number.POSITIVE_INFINITY,
    maxRunsPerMonth: 100_000,
    scheduled: true,
    historyDays: 365,
    stripePriceEnv: 'STRIPE_PRICE_TEAM',
    features: [
      'Unlimited workflows',
      '100,000 runs / month',
      'Scheduled (cron) triggers',
      'Everything in Pro',
      '365-day run history',
      'SSO on request',
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'team'];

export function planConfig(plan: string | null | undefined): PlanConfig {
  return PLANS[(plan as PlanId) in PLANS ? (plan as PlanId) : 'free'];
}

export function isPlanId(v: string): v is PlanId {
  return v === 'free' || v === 'pro' || v === 'team';
}

/** Human display for a numeric limit ("Unlimited" for Infinity). */
export function formatLimit(n: number): string {
  return n === Number.POSITIVE_INFINITY ? 'Unlimited' : n.toLocaleString();
}
