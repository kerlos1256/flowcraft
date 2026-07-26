'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTemplate, isUpgradeError } from '@/lib/api';

export interface TemplateMeta {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  accent: string;
}

export function TemplateGallery({ templates }: { templates: TemplateMeta[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [limit, setLimit] = useState<string | null>(null);

  async function pick(slug: string) {
    setBusy(slug);
    setLimit(null);
    try {
      const wf = await useTemplate(slug);
      router.push(`/workflows/${wf.id}`);
    } catch (e) {
      if (isUpgradeError(e)) setLimit(e.message);
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {limit && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          {limit}{' '}
          <Link href="/pricing" className="font-semibold underline">
            See plans →
          </Link>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => (
        <div
          key={t.slug}
          className="group relative overflow-hidden rounded-xl border border-border bg-surface p-4"
        >
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: t.accent }} />
          <div className="flex items-center gap-2">
            <span
              className="grid h-9 w-9 place-items-center rounded-lg text-lg"
              style={{ background: `${t.accent}22` }}
            >
              {t.icon}
            </span>
            <div>
              <div className="text-sm font-semibold leading-tight">{t.name}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted">{t.category}</div>
            </div>
          </div>
          <p className="mt-2 line-clamp-3 text-xs text-muted">{t.description}</p>
          <button
            onClick={() => pick(t.slug)}
            disabled={busy === t.slug}
            className="mt-3 w-full rounded-md border border-border py-2 text-xs font-medium transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {busy === t.slug ? 'Creating…' : 'Use this template'}
          </button>
        </div>
      ))}
      </div>
    </div>
  );
}
