import { getSession } from '@/lib/auth';
import { listWidgets } from '@/lib/widget-data';
import { listWorkflowTriggerInfo } from '@/lib/data';
import { getUserPlan } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import { WidgetsClient } from '@/components/widgets/widgets-client';

export const dynamic = 'force-dynamic';

export default async function WidgetsPage() {
  const s = (await getSession())!;
  const [widgets, workflows, plan, count] = await Promise.all([
    listWidgets(s.sub),
    listWorkflowTriggerInfo(s.sub),
    getUserPlan(s.sub),
    prisma.widget.count({ where: { userId: s.sub } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Widgets</h1>
        <p className="mt-1 text-sm text-muted">
          Embeddable triggers — paste one script tag into any site (WordPress, Shopify, anything) and
          every submission runs a workflow, durably. Tip: you can also drop a widget as a trigger
          right inside the workflow canvas.
        </p>
      </div>

      <WidgetsClient
        initial={widgets}
        workflows={workflows}
        maxWidgets={plan.maxWidgets === Number.POSITIVE_INFINITY ? null : plan.maxWidgets}
        used={count}
      />
    </div>
  );
}
