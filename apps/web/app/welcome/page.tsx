'use client';

import { useState } from 'react';
import Link from 'next/link';
import { appConfig } from '@/config/app.config';
import { ONBOARDING_USE_CASES } from '@/lib/templates';
import { submitOnboarding } from '@/lib/api';

export default function WelcomePage() {
  const [busy, setBusy] = useState<string | null>(null);

  async function choose(useCaseId: string) {
    setBusy(useCaseId);
    try {
      const { workflowId } = await submitOnboarding(useCaseId);
      // Drop the user straight into their tailored starter, or the dashboard.
      window.location.href = workflowId ? `/workflows/${workflowId}` : '/app';
    } catch {
      window.location.href = '/app';
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-12">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">
        <span className="text-lg">{appConfig.logoGlyph}</span> {appConfig.name}
      </div>
      <h1 className="text-3xl font-bold tracking-tight">What do you want to automate?</h1>
      <p className="mt-2 text-muted">
        Pick one and we’ll set up a starter workflow tailored to it — you can change everything later.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {ONBOARDING_USE_CASES.map((u) => (
          <button
            key={u.id}
            onClick={() => choose(u.id)}
            disabled={busy !== null}
            className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary disabled:opacity-60"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-muted text-xl">
              {u.icon}
            </span>
            <div>
              <div className="font-semibold">{u.label}</div>
              <div className="text-xs text-muted">{u.blurb}</div>
            </div>
            <span className="ml-auto self-center text-muted opacity-0 transition-opacity group-hover:opacity-100">
              {busy === u.id ? '…' : '→'}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link href="/app" className="text-sm text-muted hover:text-foreground">
          Skip for now →
        </Link>
      </div>
    </div>
  );
}
