import { notFound } from 'next/navigation';
import { NODE_TEMPLATES, type NodeTemplateDto } from '@flowcraft/shared-types';
import { getWorkflow, listRuns } from '@/lib/data';
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
  const [workflow, runs] = await Promise.all([getWorkflow(params.id), listRuns(params.id)]);
  if (!workflow) notFound();
  return <Editor workflow={workflow} templates={templates} initialRuns={runs} />;
}
