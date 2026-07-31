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
  maxWidgets: number; // embeddable widgets
  customStyling: boolean; // full widget theme control
  removeBranding: boolean; // hide "Powered by Flowcraft"
  // ── AI assistant (token budget; Sonnet costs 1, Opus costs 2) ──
  aiTokens: number; // budget per window
  aiTokenWindow: 'lifetime' | 'month'; // Free = lifetime trial; paid = calendar month
  aiPerWorkflowTokens: number | null; // Free = 1 per workflow; null = unlimited per workflow
  aiOpus: boolean; // may select the Opus model (2 tokens/use)
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
    maxWidgets: 1,
    customStyling: false,
    removeBranding: false,
    aiTokens: 3,
    aiTokenWindow: 'lifetime',
    aiPerWorkflowTokens: 1,
    aiOpus: false,
    features: [
      '5 active workflows',
      '100 runs / month',
      '1 embeddable widget',
      '✨ 3 AI workflow builds (1 per workflow)',
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
    maxWidgets: 10,
    customStyling: true,
    removeBranding: true,
    aiTokens: 150,
    aiTokenWindow: 'month',
    aiPerWorkflowTokens: null,
    aiOpus: true,
    popular: true,
    stripePriceEnv: 'STRIPE_PRICE_PRO',
    features: [
      '25 active workflows',
      '10,000 runs / month',
      '10 widgets — full styling, no branding',
      '✨ 150 AI tokens / month — Sonnet & Opus',
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
    maxWidgets: Number.POSITIVE_INFINITY,
    customStyling: true,
    removeBranding: true,
    aiTokens: 750,
    aiTokenWindow: 'month',
    aiPerWorkflowTokens: null,
    aiOpus: true,
    stripePriceEnv: 'STRIPE_PRICE_TEAM',
    features: [
      'Shared workspace — invite your team',
      '2 members included, then $12 / member',
      'Roles & granular permissions',
      '30,000 runs & 400 AI tokens / mo per workspace',
      '✨ Buy non-expiring top-ups anytime',
      'Unlimited workflows & widgets, full styling',
      'Scheduled (cron) triggers',
      'Everything in Pro · 365-day history',
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
