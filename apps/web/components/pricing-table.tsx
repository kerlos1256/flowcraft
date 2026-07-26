'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PLANS, PLAN_ORDER, type PlanId } from '@/lib/plans';
import { startCheckout, openBillingPortal } from '@/lib/api';

export function PricingTable({
  loggedIn,
  currentPlan,
}: {
  loggedIn: boolean;
  currentPlan: PlanId | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(plan: PlanId) {
    setError(null);
    if (!loggedIn) {
      router.push('/signup?next=/pricing');
      return;
    }
    setBusy(plan);
    try {
      if (currentPlan && currentPlan !== 'free') await openBillingPortal();
      else if (plan !== 'free') await startCheckout(plan as 'pro' | 'team');
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      {error && <p className="mb-4 text-center text-sm text-red-500">{error}</p>}
      <div className="grid gap-5 md:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const isCurrent = currentPlan === id;
          const cta = ctaLabel(id, loggedIn, currentPlan);
          return (
            <div
              key={id}
              className={`relative flex flex-col rounded-2xl border bg-surface p-6 ${
                p.popular ? 'border-primary shadow-md' : 'border-border'
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold">${p.priceMonthly}</span>
                <span className="text-sm text-muted">/mo</span>
              </div>
              <p className="mt-2 min-h-[40px] text-sm text-muted">{p.blurb}</p>

              <button
                onClick={() => act(id)}
                disabled={isCurrent || busy === id}
                className={`mt-4 rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60 ${
                  p.popular
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'border border-border hover:bg-surface-muted'
                }`}
              >
                {busy === id ? 'Redirecting…' : cta}
              </button>

              <ul className="mt-5 flex flex-col gap-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 text-primary">✓</span>
                    <span className="text-muted">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ctaLabel(id: PlanId, loggedIn: boolean, current: PlanId | null): string {
  if (!loggedIn) return id === 'free' ? 'Get started free' : `Get started`;
  if (current === id) return 'Current plan';
  if (id === 'free') return current && current !== 'free' ? 'Manage plan' : 'Current plan';
  if (current && current !== 'free') return 'Manage plan';
  return `Upgrade to ${PLANS[id].name}`;
}
