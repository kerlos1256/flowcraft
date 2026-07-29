'use client';

import { useState } from 'react';
import Link from 'next/link';
import { switchWorkspaceApi, type WorkspaceListItem } from '@/lib/api';

/** Header control to switch between Personal and the workspaces you belong to. */
export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: {
  workspaces: WorkspaceListItem[];
  activeId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Nothing to switch between if the user isn't in any workspace.
  if (workspaces.length === 0) return null;

  const active = workspaces.find((w) => w.id === activeId) ?? null;
  const label = active ? active.name : 'Personal';

  async function pick(id: string | null) {
    if (busy) return;
    setBusy(true);
    try {
      await switchWorkspaceApi(id);
      window.location.href = '/app';
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-surface-muted"
      >
        <span className="text-muted">{active ? '👥' : '👤'}</span>
        <span className="max-w-[140px] truncate font-medium">{label}</span>
        <span className="text-muted">▾</span>
      </button>
      {open && (
        <div className="fc-fade absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-md)]">
          <button
            onMouseDown={() => pick(null)}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted ${
              !active ? 'font-semibold' : ''
            }`}
          >
            👤 Personal {!active && <span className="ml-auto text-primary">✓</span>}
          </button>
          <div className="border-t border-border" />
          {workspaces.map((w) => (
            <button
              key={w.id}
              onMouseDown={() => pick(w.id)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted ${
                active?.id === w.id ? 'font-semibold' : ''
              }`}
            >
              👥 <span className="truncate">{w.name}</span>
              {active?.id === w.id && <span className="ml-auto text-primary">✓</span>}
            </button>
          ))}
          <div className="border-t border-border" />
          <Link
            href="/workspace"
            className="block px-3 py-2 text-left text-xs text-muted hover:bg-surface-muted"
          >
            Manage workspace →
          </Link>
        </div>
      )}
    </div>
  );
}
