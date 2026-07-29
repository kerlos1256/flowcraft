import { notFound } from 'next/navigation';
import { NODE_TEMPLATES, type NodeTemplateDto } from '@flowcraft/shared-types';
import { getWorkflow, listRuns } from '@/lib/data';
import { getAiUsage } from '@/lib/billing';
import { resolveTenant } from '@/lib/workspace/tenant';
import { aiConfigured } from '@/lib/ai/client';
import { listWidgets } from '@/lib/widget-data';
import { Editor } from '@/components/editor/editor';

export const dynamic = 'force-dynamic';

const templates: NodeTemplateDto[] = NODE_TEMPLATES.map((t) => ({
  type: t.type,
  category: t.category,
  label: t.label,
  description: t.description,
  icon: t.icon,
  configSchema: t.configSchema,
}));

export default async function WorkflowEditorPage({ params }: { params: { id: string } }) {
  const tenant = (await resolveTenant())!;
  const [workflow, runs, widgets, aiUsage] = await Promise.all([
    getWorkflow(params.id, tenant),
    listRuns(tenant, params.id),
    listWidgets(tenant),
    getAiUsage(tenant, params.id),
  ]);
  if (!workflow) notFound();
  return (
    <Editor
      workflow={workflow}
      templates={templates}
      initialRuns={runs}
      widgets={widgets.map((w) => ({ id: w.id, name: w.name, type: w.type }))}
      aiUsage={{ ...aiUsage, configured: aiConfigured() }}
    />
  );
}
