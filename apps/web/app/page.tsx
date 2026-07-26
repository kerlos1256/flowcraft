import Link from 'next/link';
import { appConfig } from '@/config/app.config';
import { getSession } from '@/lib/auth';
import { WORKFLOW_TEMPLATES } from '@/lib/templates';
import { TemplateCarousel } from '@/components/landing/template-carousel';
import { ThemeToggle } from '@/components/theme-toggle';

export const dynamic = 'force-dynamic';

const meta = WORKFLOW_TEMPLATES.map((t) => ({
  slug: t.slug,
  name: t.name,
  description: t.description,
  category: t.category,
  icon: t.icon,
  accent: t.accent,
}));

const FEATURES = [
  { icon: '🎨', title: 'Visual builder', body: 'Drag nodes onto a canvas and connect them into a flow — triggers, actions, delays, and branches.' },
  { icon: '⚡', title: 'Durable execution', body: 'Every run is powered by Inngest — steps survive crashes, retries, and multi-hour delays without holding a server open.' },
  { icon: '🔁', title: 'Automatic retries', body: 'Flaky step? It retries on its own, and the run history shows every attempt until it succeeds or gives up.' },
  { icon: '🧭', title: 'Run history', body: 'See exactly what happened at each step — inputs, outputs, branches taken, and which nodes were skipped.' },
];

export default async function LandingPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-5">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-lg">{appConfig.logoGlyph}</span> {appConfig.name}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/pricing" className="hidden px-3 py-1.5 text-sm text-muted hover:text-foreground sm:inline">
              Pricing
            </Link>
            <ThemeToggle />
            {session ? (
              <Link href="/app" className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground">
                Go to app
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-foreground">
                  Sign in
                </Link>
                <Link href="/signup" className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="fc-aurora relative overflow-hidden">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-5 pb-10 pt-20 text-center">
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
            Visual workflows · durable execution
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-6xl">
            Build workflows visually.
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Run them durably.
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted sm:text-lg">
            {appConfig.name} is a no-code workflow builder. Drag nodes onto a canvas, connect them,
            and let each flow run reliably in the background — surviving crashes, retries, and
            multi-hour delays.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={session ? '/app' : '/signup'}
              className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5"
            >
              {session ? 'Open your workflows' : 'Start building — free'}
            </Link>
            <Link
              href={session ? '/app' : '/login'}
              className="rounded-lg border border-border bg-surface px-6 py-3 text-sm font-semibold hover:bg-surface-muted"
            >
              {session ? 'Dashboard' : 'Sign in'}
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted">No credit card. Starter templates included.</p>
        </div>
      </section>

      {/* Template carousel */}
      <section className="py-10">
        <div className="mx-auto mb-5 max-w-6xl px-5 text-center">
          <h2 className="text-xl font-semibold sm:text-2xl">Templates for common use cases</h2>
          <p className="mt-1 text-sm text-muted">Fork one into your account and make it yours.</p>
        </div>
        <TemplateCarousel templates={meta} />
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-surface p-5">
              <div className="text-2xl">{f.icon}</div>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-5 pb-20">
        <div className="fc-aurora overflow-hidden rounded-2xl border border-border p-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to automate something?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
            Sign up free, pick a template, and run your first durable workflow in under a minute.
          </p>
          <Link
            href={session ? '/app' : '/signup'}
            className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5"
          >
            {session ? 'Go to your workflows' : 'Create your free account'}
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted">
        {appConfig.logoGlyph} {appConfig.name} — {appConfig.tagline}
      </footer>
    </div>
  );
}
