import { notFound } from 'next/navigation';
import { getWidget } from '@/lib/widget-data';
import { listWorkflows } from '@/lib/data';
import { getUserPlan } from '@/lib/billing';
import { planConfig } from '@/lib/plans';
import { resolveTenant } from '@/lib/workspace/tenant';
import { WidgetEditor } from '@/components/widgets/widget-editor';

export const dynamic = 'force-dynamic';

export default async function WidgetEditorPage({ params }: { params: { id: string } }) {
  const tenant = (await resolveTenant())!;
  const [widget, workflows] = await Promise.all([getWidget(params.id, tenant), listWorkflows(tenant)]);
  if (!widget) notFound();
  const plan = tenant.kind === 'workspace' ? planConfig('team') : await getUserPlan(tenant.userId);

  return (
    <WidgetEditor
      widget={widget}
      workflows={workflows.map((w) => ({ id: w.id, name: w.name }))}
      customStyling={plan.customStyling}
      removeBranding={plan.removeBranding}
    />
  );
}
