import type { WorkflowSummaryDto } from '@flowcraft/shared-types';
import { getSession } from '@/lib/auth';
import { listWorkflows } from '@/lib/data';
import { WORKFLOW_TEMPLATES } from '@/lib/templates';
import { WorkflowList } from '@/components/workflow-list';
import { TemplateGallery } from '@/components/template-gallery';

export const dynamic = 'force-dynamic';

const templateMeta = WORKFLOW_TEMPLATES.map((t) => ({
  slug: t.slug,
  name: t.name,
  description: t.description,
  category: t.category,
  icon: t.icon,
  accent: t.accent,
}));

export default async function DashboardPage() {
  const session = (await getSession())!; // guaranteed by (app)/layout
  const workflows: WorkflowSummaryDto[] = await listWorkflows(session.sub);

  const firstName = session.name.split(' ')[0] || 'there';

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {firstName} 👋</h1>
        <p className="mt-1 text-sm text-muted">
          Build a flow on the canvas, then run it durably — retries, delays, and branching included.
        </p>
      </div>

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
