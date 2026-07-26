'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { WorkflowSummaryDto } from '@flowcraft/shared-types';
import { createWorkflow, deleteWorkflow, isUpgradeError } from '@/lib/api';
import { Modal } from '@/components/ui/modal';

const statusColor: Record<string, string> = {
  draft: 'var(--muted)',
  active: '#10b981',
  paused: '#f59e0b',
};

export function WorkflowList({ initial }: { initial: WorkflowSummaryDto[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [limit, setLimit] = useState<string | null>(null);

  // Create-workflow modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete-confirm modal state
  const [toDelete, setToDelete] = useState<WorkflowSummaryDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setName('My workflow');
    setLimit(null);
    setCreateOpen(true);
  }

  async function submitCreate() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setLimit(null);
    try {
      const wf = await createWorkflow(trimmed);
      router.push(`/workflows/${wf.id}`);
    } catch (e) {
      setCreateOpen(false);
      if (isUpgradeError(e)) setLimit(e.message);
      setCreating(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteWorkflow(toDelete.id);
      setItems((xs) => xs.filter((x) => x.id !== toDelete.id));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <button className="btn btn-primary self-start" onClick={openCreate}>
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
                <button className="btn btn-sm" onClick={() => setToDelete(w)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create-workflow modal */}
      <Modal
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title="New workflow"
        description="Give it a name — you can rename it anytime."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitCreate();
          }}
          className="flex flex-col gap-4"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="e.g. Slack digest"
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
              className="rounded-md border border-border px-3.5 py-2 text-sm hover:bg-surface-muted disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {creating ? 'Creating…' : 'Create workflow'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete-confirm modal */}
      <Modal
        open={toDelete !== null}
        onClose={() => !deleting && setToDelete(null)}
        title="Delete workflow?"
        description={
          toDelete
            ? `“${toDelete.name}” and its run history will be permanently deleted. This can’t be undone.`
            : ''
        }
      >
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setToDelete(null)}
            disabled={deleting}
            className="rounded-md border border-border px-3.5 py-2 text-sm hover:bg-surface-muted disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={confirmDelete}
            disabled={deleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
