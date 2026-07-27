'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { WIDGET_PRESETS, WIDGET_TYPES, type WidgetSummary } from '@/lib/widgets';
import { createWidgetApi, deleteWidgetApi, isUpgradeError } from '@/lib/api';
import { Modal } from '@/components/ui/modal';

export function WidgetsClient({
  initial,
  workflows,
  maxWidgets,
  used,
}: {
  initial: WidgetSummary[];
  workflows: { id: string; name: string }[];
  maxWidgets: number | null;
  used: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<WidgetSummary | null>(null);

  // create form
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('form');
  const [workflowId, setWorkflowId] = useState(workflows[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function openCreate() {
    setName(WIDGET_PRESETS.form.label);
    setType('form');
    setWorkflowId(workflows[0]?.id ?? '');
    setErr(null);
    setLimit(null);
    setOpen(true);
  }

  async function create() {
    if (!workflowId) {
      setErr('Create a workflow first, then link a widget to it.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const w = await createWidgetApi(name.trim() || WIDGET_PRESETS[type as keyof typeof WIDGET_PRESETS].label, type, workflowId);
      router.push(`/widgets/${w.id}`);
    } catch (e) {
      if (isUpgradeError(e)) {
        setOpen(false);
        setLimit((e as Error).message);
      } else setErr((e as Error).message);
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await deleteWidgetApi(toDelete.id);
    setItems((xs) => xs.filter((x) => x.id !== toDelete.id));
    setToDelete(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={openCreate}>
          + New widget
        </button>
        {maxWidgets !== null && (
          <span className="text-xs text-muted">
            {used} / {maxWidgets} used
          </span>
        )}
      </div>

      {limit && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          {limit} <Link href="/pricing" className="font-semibold underline">See plans →</Link>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">
          No widgets yet. Create one, link it to a workflow, and embed it anywhere.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((w) => (
            <div key={w.id} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">{WIDGET_PRESETS[w.type].icon}</span>
                <Link href={`/widgets/${w.id}`} className="font-medium hover:text-primary">
                  {w.name}
                </Link>
                <span className="ml-auto rounded-sm border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted">
                  {w.placement}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">
                {WIDGET_PRESETS[w.type].label} → {w.workflowName}
              </p>
              <div className="mt-3 flex gap-2">
                <Link href={`/widgets/${w.id}`} className="btn btn-sm">
                  Configure
                </Link>
                <button className="btn btn-sm" onClick={() => setToDelete(w)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="New widget" description="Pick a type and link it to a workflow.">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2">
            {WIDGET_TYPES.map((t) => {
              const p = WIDGET_PRESETS[t];
              return (
                <button
                  key={t}
                  onClick={() => {
                    setType(t);
                    setName(p.label);
                  }}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 text-left ${
                    type === t ? 'border-primary bg-surface-muted' : 'border-border'
                  }`}
                >
                  <span className="text-lg">{p.icon}</span>
                  <div>
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="text-[11px] text-muted">{p.blurb}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Widget name
            <input className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Runs this workflow
            <select className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary" value={workflowId} onChange={(e) => setWorkflowId(e.target.value)}>
              {workflows.length === 0 && <option value="">No workflows yet</option>}
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>

          {err && <p className="text-sm text-red-500">{err}</p>}

          <div className="flex justify-end gap-2">
            <button className="rounded-md border border-border px-3.5 py-2 text-sm hover:bg-surface-muted" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60" onClick={create} disabled={busy || !workflowId}>
              {busy ? 'Creating…' : 'Create widget'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Delete widget?"
        description={toDelete ? `“${toDelete.name}” will stop working on any site it’s embedded in.` : ''}
      >
        <div className="flex justify-end gap-2">
          <button className="rounded-md border border-border px-3.5 py-2 text-sm hover:bg-surface-muted" onClick={() => setToDelete(null)}>
            Cancel
          </button>
          <button className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white" onClick={confirmDelete}>
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
