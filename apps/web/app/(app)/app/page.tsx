import type { WorkflowSummaryDto } from '@flowcraft/shared-types';
import { getSession } from '@/lib/auth';
import { listWorkflows } from '@/lib/data';
import { getPlanAndUsage } from '@/lib/billing';
import { WORKFLOW_TEMPLATES } from '@/lib/templates';
import { WorkflowList } from '@/components/workflow-list';
import { TemplateGallery } from '@/components/template-gallery';
import { BillingPanel } from '@/components/billing-panel';

export const dynamic = 'force-dynamic';

const templateMeta = WORKFLOW_TEMPLATES.map((t) => ({
  slug: t.slug,
  name: t.name,
  description: t.description,
  category: t.category,
  icon: t.icon,
  accent: t.accent,
}));

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { upgraded?: string };
}) {
  const session = (await getSession())!;
  const [workflows, usage] = await Promise.all([
    listWorkflows(session.sub) as Promise<WorkflowSummaryDto[]>,
    getPlanAndUsage(session.sub),
  ]);
  const firstName = session.name.split(' ')[0] || 'there';

  return (
    <div className="flex flex-col gap-8">
      {searchParams.upgraded && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm">
          🎉 You’re upgraded to <b>{usage.plan.name}</b> — enjoy the higher limits and scheduling.
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {firstName} 👋</h1>
        <p className="mt-1 text-sm text-muted">
          Build a flow on the canvas, then run it durably — retries, delays, and branching included.
        </p>
      </div>

      <BillingPanel
        planId={usage.planId}
        planName={usage.plan.name}
        workflows={usage.workflows}
        runsThisMonth={usage.runsThisMonth}
        maxWorkflows={usage.plan.maxWorkflows}
        maxRunsPerMonth={usage.plan.maxRunsPerMonth}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Your workflows</h2>
        <WorkflowList initial={workflows} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Start from a template
          </h2>
          <p className="mt-1 text-xs text-muted">
            Curated flows for common use cases — fork one into your account and tweak it.
          </p>
        </div>
        <TemplateGallery templates={templateMeta} />
      </section>
    </div>
  );
}
