import { notFound } from 'next/navigation';
import type { WorkflowDto, NodeTemplateDto, WorkflowRunDto } from '@flowcraft/shared-types';
import { getWorkflow, listNodeTemplates, listRuns, ApiError } from '@/lib/api';
import { Editor } from '@/components/editor/editor';

export const dynamic = 'force-dynamic';

export default async function WorkflowEditorPage({ params }: { params: { id: string } }) {
  let workflow: WorkflowDto;
  let templates: NodeTemplateDto[];
  let runs: WorkflowRunDto[];
  try {
    [workflow, templates, runs] = await Promise.all([
      getWorkflow(params.id),
      listNodeTemplates(),
      listRuns(params.id),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return <Editor workflow={workflow} templates={templates} initialRuns={runs} />;
}
