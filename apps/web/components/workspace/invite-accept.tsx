'use client';

import { useState } from 'react';
import { acceptInviteApi } from '@/lib/api';

export function InviteAccept({
  token,
  defaultName,
  workspaceName,
}: {
  token: string;
  defaultName: string;
  workspaceName: string;
}) {
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setErr(null);
    try {
      await acceptInviteApi(token, name.trim());
      window.location.href = '/app';
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Your display name in {workspaceName}
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
      </label>
      <button className="btn btn-primary mt-4 w-full justify-center" onClick={accept} disabled={busy || !name.trim()}>
        {busy ? 'Joining…' : `Join ${workspaceName}`}
      </button>
      {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
    </div>
  );
}
