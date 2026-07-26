'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { WorkflowSummaryDto } from '@flowcraft/shared-types';
import { createWorkflow, deleteWorkflow, isUpgradeError } from '@/lib/api';

const statusColor: Record<string, string> = {
  draft: 'var(--muted)',
  active: '#10b981',
  paused: '#f59e0b',
};

export function WorkflowList({ initial }: { initial: WorkflowSummaryDto[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState<string | null>(null);

  async function create() {
    const name = prompt('Workflow name?', 'My workflow');
    if (!name) return;
    setBusy(true);
    setLimit(null);
    try {
      const wf = await createWorkflow(name);
      router.push(`/workflows/${wf.id}`);
    } catch (e) {
      if (isUpgradeError(e)) setLimit(e.message);
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this workflow and its run history?')) return;
    await deleteWorkflow(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <button className="btn btn-primary self-start" onClick={create} disabled={busy}>
          + New workflow
        </button>
        {limit && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            {limit}{' '}
            <Link href="/pricing" className="font-semibold underline">
              See plans →
            </Link>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">
          No workflows yet. Create one to open the canvas editor.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((w) => (
            <div key={w.id} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/workflows/${w.id}`} className="font-medium hover:text-primary">
                  {w.name}
                </Link>
                <span
                  className="rounded-sm px-1.5 py-0.5 text-[11px] font-semibold"
                  style={{ color: statusColor[w.status], border: `1px solid ${statusColor[w.status]}` }}
                >
                  {w.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">
                {w.nodeCount} node{w.nodeCount === 1 ? '' : 's'} · updated{' '}
                {new Date(w.updatedAt).toLocaleString()}
              </p>
              <div className="mt-3 flex gap-2">
                <Link href={`/workflows/${w.id}`} className="btn btn-sm">
                  Open editor
                </Link>
                <button className="btn btn-sm" onClick={() => remove(w.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
