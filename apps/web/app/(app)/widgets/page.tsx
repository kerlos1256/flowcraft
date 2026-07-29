import { listWidgets } from '@/lib/widget-data';
import { listWorkflowTriggerInfo } from '@/lib/data';
import { getUserPlan } from '@/lib/billing';
import { planConfig } from '@/lib/plans';
import { resolveTenant, scopeWhere } from '@/lib/workspace/tenant';
import { prisma } from '@/lib/prisma';
import { WidgetsClient } from '@/components/widgets/widgets-client';

export const dynamic = 'force-dynamic';

export default async function WidgetsPage() {
  const tenant = (await resolveTenant())!;
  const [widgets, workflows, count] = await Promise.all([
    listWidgets(tenant),
    listWorkflowTriggerInfo(tenant),
    prisma.widget.count({ where: scopeWhere(tenant) }),
  ]);
  const plan = tenant.kind === 'workspace' ? planConfig('team') : await getUserPlan(tenant.userId);

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
