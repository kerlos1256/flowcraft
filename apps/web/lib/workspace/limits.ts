// Workspace metered allotments + non-expiring top-up packs. Client-SAFE (pure
// data) so the billing UI and server enforcement share one source of truth.
//
// Capacity is DECOUPLED from seats: a workspace has a FLAT monthly allotment
// regardless of seat count. Need more? Buy top-ups — one-time purchases that
// credit a non-expiring balance, consumed only after the monthly allotment.

export const WORKSPACE_LIMITS = {
  /** Runs per calendar month (resets monthly). */
  runsPerMonth: 30_000,
  /** AI assistant tokens per calendar month (resets monthly). */
  aiTokensPerMonth: 400,
  /** Embeddable widgets (persistent cap, not monthly). */
  maxWidgets: 25,
} as const;

export type TopupKind = 'runs' | 'ai_tokens';

export interface TopupPack {
  id: string;
  kind: TopupKind;
  label: string;
  /** Units credited (runs or AI tokens). */
  amount: number;
  /** One-time price in cents (USD). */
  priceCents: number;
}

export const TOPUP_PACKS: Record<string, TopupPack> = {
  runs_10k: { id: 'runs_10k', kind: 'runs', label: '10,000 runs', amount: 10_000, priceCents: 500 },
  ai_100: { id: 'ai_100', kind: 'ai_tokens', label: '100 AI tokens', amount: 100, priceCents: 800 },
};

export const TOPUP_PACK_IDS = Object.keys(TOPUP_PACKS);

export const isTopupPackId = (v: unknown): v is string => typeof v === 'string' && v in TOPUP_PACKS;

export const dollars = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
