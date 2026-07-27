import { getSession } from '@/lib/auth';
import { listWidgets } from '@/lib/widget-data';
import { listWorkflows } from '@/lib/data';
import { getUserPlan } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import { WidgetsClient } from '@/components/widgets/widgets-client';

export const dynamic = 'force-dynamic';

export default async function WidgetsPage() {
  const s = (await getSession())!;
  const [widgets, workflows, plan, count] = await Promise.all([
    listWidgets(s.sub),
    listWorkflows(s.sub),
    getUserPlan(s.sub),
    prisma.widget.count({ where: { userId: s.sub } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Widgets</h1>
        <p className="mt-1 text-sm text-muted">
          Embeddable triggers — paste one script tag into any site (WordPress, Shopify, anything) and
          every submission runs a workflow, durably.
        </p>
      </div>

      <WidgetsClient
        initial={widgets}
        workflows={workflows.map((w) => ({ id: w.id, name: w.name }))}
        maxWidgets={plan.maxWidgets === Number.POSITIVE_INFINITY ? null : plan.maxWidgets}
        used={count}
      />
    </div>
  );
}
