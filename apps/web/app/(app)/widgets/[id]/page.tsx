import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getWidget } from '@/lib/widget-data';
import { listWorkflows } from '@/lib/data';
import { getUserPlan } from '@/lib/billing';
import { WidgetEditor } from '@/components/widgets/widget-editor';

export const dynamic = 'force-dynamic';

export default async function WidgetEditorPage({ params }: { params: { id: string } }) {
  const s = (await getSession())!;
  const [widget, workflows, plan] = await Promise.all([
    getWidget(params.id, s.sub),
    listWorkflows(s.sub),
    getUserPlan(s.sub),
  ]);
  if (!widget) notFound();

  return (
    <WidgetEditor
      widget={widget}
      workflows={workflows.map((w) => ({ id: w.id, name: w.name }))}
      customStyling={plan.customStyling}
      removeBranding={plan.removeBranding}
    />
  );
}
