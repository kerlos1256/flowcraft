import type { WorkflowSummaryDto } from '@flowcraft/shared-types';
import { listWorkflows } from '@/lib/api';
import { WorkflowList } from '@/components/workflow-list';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let workflows: WorkflowSummaryDto[] = [];
  let error: string | null = null;
  try {
    workflows = await listWorkflows();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Workflows</h1>
        <p className="mt-1 text-sm text-muted">
          Build a flow on the canvas, then run it durably — retries, delays, and branching included.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-sm">
          <p className="font-medium">Can’t reach the Flowcraft API.</p>
          <p className="mt-1 text-muted">{error}</p>
          <p className="mt-2 text-muted">
            Start it with <code className="font-mono">pnpm --filter @flowcraft/api dev</code> (and Postgres via{' '}
            <code className="font-mono">pnpm infra:up</code>).
          </p>
        </div>
      ) : (
        <WorkflowList initial={workflows} />
      )}
    </div>
  );
}
