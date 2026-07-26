import Link from 'next/link';
import { appConfig } from '@/config/app.config';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { type PlanId } from '@/lib/plans';
import { PricingTable } from '@/components/pricing-table';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pricing — Flowcraft' };

export default async function PricingPage() {
  const session = await getSession();
  let currentPlan: PlanId | null = null;
  if (session) {
    const u = await prisma.user.findUnique({ where: { id: session.sub }, select: { plan: true } });
    currentPlan = (u?.plan as PlanId) ?? 'free';
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-5">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="text-lg">{appConfig.logoGlyph}</span> {appConfig.name}
          </Link>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {session ? (
              <Link href="/app" className="rounded-md bg-primary px-3.5 py-1.5 font-semibold text-primary-foreground">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="px-3 py-1.5 text-muted hover:text-foreground">
                  Sign in
                </Link>
                <Link href="/signup" className="rounded-md bg-primary px-3.5 py-1.5 font-semibold text-primary-foreground">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">Simple, transparent pricing</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Start free — the visual builder, durable execution, and templates are always included.
            Upgrade for more workflows, more runs, and scheduled triggers.
          </p>
        </div>
        <PricingTable loggedIn={!!session} currentPlan={currentPlan} />
        <p className="mt-10 text-center text-xs text-muted">
          Test mode — use Stripe test card <code className="font-mono">4242 4242 4242 4242</code>, any
          future date & CVC.
        </p>
      </div>
    </div>
  );
}
