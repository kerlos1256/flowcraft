'use client';

import Link from 'next/link';
import type { TemplateMeta } from '@/components/template-gallery';

/** Auto-scrolling showcase of templates (pauses on hover). */
export function TemplateCarousel({ templates }: { templates: TemplateMeta[] }) {
  const loop = [...templates, ...templates]; // duplicate for a seamless marquee
  return (
    <div className="fc-marquee w-full py-2">
      <div className="fc-marquee-track">
        {loop.map((t, i) => (
          <Link
            key={`${t.slug}-${i}`}
            href="/signup"
            className="group w-[300px] shrink-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-transform hover:-translate-y-1"
          >
            <div className="h-1.5 w-full" style={{ background: t.accent }} />
            <div className="p-4">
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-10 w-10 place-items-center rounded-lg text-xl"
                  style={{ background: `${t.accent}22` }}
                >
                  {t.icon}
                </span>
                <div>
                  <div className="text-sm font-semibold leading-tight">{t.name}</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted">{t.category}</div>
                </div>
              </div>
              <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-muted">{t.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
