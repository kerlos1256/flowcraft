'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatLimit } from '@/lib/plans';
import { openBillingPortal } from '@/lib/api';

interface Props {
  planId: string;
  planName: string;
  workflows: number;
  runsThisMonth: number;
  maxWorkflows: number;
  maxRunsPerMonth: number;
}

export function BillingPanel(p: Props) {
  const [busy, setBusy] = useState(false);
  const isPaid = p.planId !== 'free';

  async function manage() {
    setBusy(true);
    try {
      await openBillingPortal();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Plan</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isPaid ? 'bg-primary text-primary-foreground' : 'border border-border text-muted'
            }`}
          >
            {p.planName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isPaid ? (
            <button
              onClick={manage}
              disabled={busy}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-muted disabled:opacity-60"
            >
              {busy ? 'Opening…' : 'Manage billing'}
            </button>
          ) : (
            <Link
              href="/pricing"
              className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Upgrade
            </Link>
          )}
          <Link href="/pricing" className="text-xs text-muted hover:text-foreground">
            View plans
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Meter label="Active workflows" used={p.workflows} max={p.maxWorkflows} />
        <Meter label="Runs this month" used={p.runsThisMonth} max={p.maxRunsPerMonth} />
      </div>
    </div>
  );
}

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const unlimited = max === Number.POSITIVE_INFINITY;
  const pct = unlimited ? 8 : Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  const near = !unlimited && pct >= 80;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={near ? 'font-semibold text-amber-500' : 'text-muted'}>
          {used.toLocaleString()} / {formatLimit(max)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: near ? '#f59e0b' : 'var(--primary)' }}
        />
      </div>
    </div>
  );
}
