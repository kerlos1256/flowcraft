'use client';

import { useState } from 'react';
import {
  createWorkspaceApi,
  getWorkspace,
  renameWorkspaceApi,
  deleteWorkspaceApi,
  inviteMemberApi,
  revokeInviteApi,
  updateMemberPermissionsApi,
  removeMemberApi,
  leaveWorkspaceApi,
  switchWorkspaceApi,
  buySeatApi,
  releaseSeatApi,
  buyTopupApi,
  transferOwnershipApi,
  resendInviteApi,
  startCheckout,
  type WorkspaceDetail,
  type WorkspaceListItem,
  type WorkspaceMember,
} from '@/lib/api';
import { PLANS } from '@/lib/plans';
import { TOPUP_PACKS, TOPUP_PACK_IDS, dollars } from '@/lib/workspace/limits';
import {
  PRESETS,
  PRESET_IDS,
  PERMISSION_GROUPS,
  membershipCan,
  type Permission,
  type PresetId,
} from '@/lib/workspace/permissions';

interface Props {
  plan: string;
  userName: string;
  owned: WorkspaceDetail | null;
  memberships: WorkspaceListItem[];
  deactivated: { workspaceId: string; workspaceName: string }[];
  activeId: string | null;
}

export function WorkspaceManager({ plan, userName, owned, memberships, deactivated, activeId }: Props) {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Workspace</h1>
      {deactivated.map((d) => (
        <div
          key={d.workspaceId}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400"
        >
          ⚠ Your seat in <b>{d.workspaceName}</b> is unpaid, so your access is paused. Ask the workspace owner to fix the
          seat’s billing to restore it.
        </div>
      ))}
      {owned ? (
        <Manage initial={owned} />
      ) : plan === 'team' ? (
        <CreateWorkspace defaultName={`${userName}'s Workspace`} />
      ) : (
        <TeamUpsell />
      )}
      <OtherWorkspaces memberships={memberships} ownedId={owned?.workspace.id ?? null} activeId={activeId} />
    </div>
  );
}

// ── Non-Team: benefits + upgrade ────────────────────────────────────────────────
function TeamUpsell() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold">Collaborate with your team</h2>
      <p className="mt-1 text-sm text-muted">
        Workspaces are a <strong>Team plan</strong> feature — invite teammates, share workflows and widgets, and control
        exactly what each person can do.
      </p>
      <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        {PLANS.team.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <button
        className="btn btn-primary mt-5"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await startCheckout('team');
          } catch {
            setBusy(false);
          }
        }}
      >
        Upgrade to Team
      </button>
    </div>
  );
}

// ── Team, no workspace yet: create ──────────────────────────────────────────────
function CreateWorkspace({ defaultName }: { defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold">Create your workspace</h2>
      <p className="mt-1 text-sm text-muted">
        Your Team plan includes {PLANS.team.name} collaboration. Name your workspace to get started — you can invite up to
        one teammate on the base plan, and add more seats later.
      </p>
      <div className="mt-4 flex max-w-md gap-2">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Automations" />
        <button
          className="btn btn-primary shrink-0"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await createWorkspaceApi(name.trim());
              window.location.href = '/workspace';
            } catch (e) {
              setErr((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? 'Creating…' : 'Create workspace'}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
    </div>
  );
}

// ── Manage an existing workspace ────────────────────────────────────────────────
type Tab = 'members' | 'invites' | 'seats' | 'activity' | 'settings';

function Manage({ initial }: { initial: WorkspaceDetail }) {
  const [data, setData] = useState<WorkspaceDetail>(initial);
  const [tab, setTab] = useState<Tab>('members');

  async function refresh() {
    try {
      setData(await getWorkspace(data.workspace.id));
    } catch {
      /* ignore */
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'members', label: `Members (${data.members.length})` },
    { id: 'invites', label: `Invites (${data.invites.length})` },
    { id: 'seats', label: `Seats (${data.seats.total})` },
    { id: 'activity', label: 'Activity' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">{data.workspace.name}</h2>
          <p className="text-xs text-muted">
            {data.members.length} member{data.members.length === 1 ? '' : 's'} · {data.seats.available} of{' '}
            {data.seats.base} seats free
          </p>
        </div>
        {data.workspace.status !== 'active' && (
          <span className="rounded-md bg-amber-500/15 px-2 py-1 text-xs text-amber-600">Read-only</span>
        )}
      </div>

      <div className="flex gap-1 border-b border-border px-3 pt-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-t-md px-3 py-2 text-sm ${
              tab === t.id ? 'border-b-2 border-primary font-semibold' : 'text-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === 'members' && <MembersTab data={data} onChange={refresh} />}
        {tab === 'invites' && <InvitesTab data={data} onChange={refresh} />}
        {tab === 'seats' && <SeatsTab data={data} onChange={refresh} />}
        {tab === 'activity' && <ActivityTab data={data} />}
        {tab === 'settings' && <SettingsTab data={data} />}
      </div>
    </div>
  );
}

function MembersTab({ data, onChange }: { data: WorkspaceDetail; onChange: () => void }) {
  const me = data.me;
  const canManage = membershipCan(me, 'member.manage_permissions');
  const canRemove = membershipCan(me, 'member.remove');
  return (
    <div className="flex flex-col gap-3">
      {data.members.map((m) => (
        <MemberRow
          key={m.id}
          member={m}
          me={me}
          canManage={canManage}
          canRemove={canRemove}
          workspaceId={data.workspace.id}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function MemberRow({
  member,
  me,
  canManage,
  canRemove,
  workspaceId,
  onChange,
}: {
  member: WorkspaceMember;
  me: WorkspaceDetail['me'];
  canManage: boolean;
  canRemove: boolean;
  workspaceId: string;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [perms, setPerms] = useState<Permission[]>(member.permissions);
  const [busy, setBusy] = useState(false);
  const isSelf = member.userId === me.userId;
  const editable = canManage && !member.isOwner && !isSelf;

  async function save() {
    setBusy(true);
    try {
      await updateMemberPermissionsApi(workspaceId, member.id, perms);
      setEditing(false);
      onChange();
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm(`Remove ${member.displayName} from the workspace?`)) return;
    setBusy(true);
    try {
      await removeMemberApi(workspaceId, member.id);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-sm">
          {member.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            {member.displayName}
            {member.isOwner && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">Owner</span>}
            {member.status === 'deactivated' && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600">Deactivated</span>
            )}
          </div>
          <div className="truncate text-xs text-muted">{member.email}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {editable && (
            <button className="btn btn-sm" onClick={() => setEditing((e) => !e)}>
              {editing ? 'Close' : 'Permissions'}
            </button>
          )}
          {canRemove && !member.isOwner && !isSelf && (
            <button className="btn btn-sm" onClick={remove} disabled={busy}>
              Remove
            </button>
          )}
        </div>
      </div>
      {!member.isOwner && !editing && (
        <p className="mt-2 text-xs text-muted">
          {member.permissions.length === 0 ? 'Viewer (read-only)' : `${member.permissions.length} permissions`}
        </p>
      )}
      {editing && (
        <div className="mt-3">
          <PermissionEditor value={perms} onChange={setPerms} />
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save permissions'}
            </button>
            <button className="btn btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InvitesTab({ data, onChange }: { data: WorkspaceDetail; onChange: () => void }) {
  const me = data.me;
  const canInvite = membershipCan(me, 'member.invite');
  const noSeats = data.seats.available <= 0;
  const [email, setEmail] = useState('');
  const [preset, setPreset] = useState<PresetId>('editor');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<{ link: string; emailed: boolean } | null>(null);
  const [resent, setResent] = useState<{ id: string; link: string; emailed: boolean } | null>(null);

  async function invite() {
    setBusy(true);
    setErr(null);
    setLastLink(null);
    try {
      const res = await inviteMemberApi(data.workspace.id, email.trim(), PRESETS[preset].permissions);
      setLastLink({ link: res.link, emailed: res.emailed });
      setEmail('');
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canInvite && (
        <div className="rounded-lg border border-border p-4">
          {noSeats ? (
            <p className="text-sm text-muted">
              All {data.seats.base} seats are in use. Buying additional seats is coming soon — for now, remove a member or
              revoke a pending invite to free a seat.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
                  Email
                  <input
                    className="input"
                    type="email"
                    placeholder="teammate@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Role
                  <select className="select max-w-[160px]" value={preset} onChange={(e) => setPreset(e.target.value as PresetId)}>
                    {PRESET_IDS.map((p) => (
                      <option key={p} value={p}>
                        {PRESETS[p].label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn btn-primary" onClick={invite} disabled={busy || !email.trim()}>
                  {busy ? 'Inviting…' : 'Send invite'}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted">{PRESETS[preset].blurb} You can fine-tune permissions after they join.</p>
              {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
              {lastLink && (
                <div className="mt-3 rounded-md bg-surface-muted p-3 text-xs">
                  <p className="mb-1 font-medium">
                    {lastLink.emailed ? 'Invitation emailed ✓' : 'Invite created (email not configured) — share this link:'}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-surface px-2 py-1">{lastLink.link}</code>
                    <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(lastLink.link)}>
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Pending invites</p>
        {data.invites.length === 0 ? (
          <p className="text-xs text-muted">No pending invites.</p>
        ) : (
          data.invites.map((inv) => (
            <div key={inv.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{inv.email}</div>
                  <div className="text-xs text-muted">
                    {inv.permissions.length === 0 ? 'Viewer' : `${inv.permissions.length} permissions`} · expires{' '}
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                {canInvite && (
                  <div className="ml-auto flex gap-2">
                    <button
                      className="btn btn-sm"
                      onClick={async () => {
                        const r = await resendInviteApi(data.workspace.id, inv.id);
                        setResent({ id: inv.id, link: r.link, emailed: r.emailed });
                      }}
                    >
                      Resend
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={async () => {
                        await revokeInviteApi(data.workspace.id, inv.id);
                        onChange();
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </div>
              {resent?.id === inv.id && (
                <div className="mt-2 rounded-md bg-surface-muted p-2 text-xs">
                  <span className="font-medium">{resent.emailed ? 'Re-sent by email ✓ ' : 'New link (email off): '}</span>
                  <code className="break-all">{resent.link}</code>
                  <button className="btn btn-sm ml-2" onClick={() => navigator.clipboard?.writeText(resent.link)}>
                    Copy
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SettingsTab({ data }: { data: WorkspaceDetail }) {
  const me = data.me;
  const canManage = membershipCan(me, 'workspace.manage');
  const [name, setName] = useState(data.workspace.name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [xferId, setXferId] = useState('');
  const others = data.members.filter((m) => !m.isOwner && m.status === 'active');

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <div>
          <p className="mb-2 text-sm font-semibold">Workspace name</p>
          <div className="flex max-w-md gap-2">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            <button
              className="btn btn-primary shrink-0"
              disabled={busy || !name.trim() || name === data.workspace.name}
              onClick={async () => {
                setBusy(true);
                setMsg(null);
                try {
                  await renameWorkspaceApi(data.workspace.id, name.trim());
                  setMsg('Saved ✓');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save
            </button>
          </div>
          {msg && <p className="mt-1 text-xs text-muted">{msg}</p>}
        </div>
      )}

      {me.isOwner && others.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Transfer ownership</p>
          <p className="mb-2 text-xs text-muted">
            Hand the workspace to another member. You’ll become an Admin; they take over billing and deletion.
          </p>
          <div className="flex max-w-md gap-2">
            <select className="select" value={xferId} onChange={(e) => setXferId(e.target.value)}>
              <option value="">Choose a member…</option>
              {others.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} ({m.email})
                </option>
              ))}
            </select>
            <button
              className="btn shrink-0"
              disabled={!xferId || busy}
              onClick={async () => {
                const target = others.find((m) => m.id === xferId);
                if (!target || !confirm(`Transfer ownership to ${target.displayName}? You can't undo this yourself.`)) return;
                setBusy(true);
                try {
                  await transferOwnershipApi(data.workspace.id, xferId);
                  window.location.reload();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Transfer
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-red-500/30 p-4">
        <p className="text-sm font-semibold text-red-500">Danger zone</p>
        {me.isOwner ? (
          <div className="mt-2">
            <p className="text-xs text-muted">Deleting the workspace removes all its members, invites, and shared resources. This can't be undone.</p>
            <button
              className="btn btn-sm mt-2 border-red-500/40 text-red-500"
              onClick={async () => {
                if (!confirm(`Delete "${data.workspace.name}" permanently?`)) return;
                await deleteWorkspaceApi(data.workspace.id);
                window.location.href = '/app';
              }}
            >
              Delete workspace
            </button>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-xs text-muted">Leaving removes your access to this workspace.</p>
            <button
              className="btn btn-sm mt-2"
              onClick={async () => {
                if (!confirm('Leave this workspace?')) return;
                await leaveWorkspaceApi(data.workspace.id);
                window.location.href = '/app';
              }}
            >
              Leave workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Seats & billing ─────────────────────────────────────────────────────────────
function SeatsTab({ data, onChange }: { data: WorkspaceDetail; onChange: () => void }) {
  const canBill = membershipCan(data.me, 'workspace.billing'); // owner-only
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setErr(null);
    try {
      const { url } = await buySeatApi(data.workspace.id);
      window.location.href = url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }
  async function release(seatId: string) {
    if (!confirm('Release this seat? Its subscription cancels at the end of the billing period.')) return;
    try {
      await releaseSeatApi(data.workspace.id, seatId);
      onChange();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function topup(packId: string) {
    setBusy(true);
    setErr(null);
    try {
      const { url } = await buyTopupApi(data.workspace.id, packId);
      window.location.href = url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const u = data.usage;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {data.seats.total} seat{data.seats.total === 1 ? '' : 's'} · {data.seats.available} free
            </p>
            <p className="text-xs text-muted">
              Your Team plan includes {data.seats.base} seats. Extra seats are <b>$12/mo</b> each (up to {data.seats.max}).
            </p>
          </div>
          {canBill && (
            <button className="btn btn-primary shrink-0" onClick={buy} disabled={busy || data.seats.total >= data.seats.max}>
              {busy ? 'Redirecting…' : '+ Buy a seat'}
            </button>
          )}
        </div>
        {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
      </div>

      {/* Usage this month + top-ups */}
      <div className="rounded-lg border border-border p-4">
        <p className="mb-3 text-sm font-semibold">Usage this month</p>
        <div className="flex flex-col gap-3">
          <UsageBar label="Runs" used={u.runs.used} limit={u.runs.limit} balance={u.balances.runs} />
          <UsageBar label="AI tokens" used={u.ai.used} limit={u.ai.limit} balance={u.balances.aiTokens} />
          <UsageBar label="Widgets" used={u.widgets.used} limit={u.widgets.limit} />
        </div>
        {canBill && (
          <div className="mt-4 flex flex-wrap gap-2">
            {TOPUP_PACK_IDS.map((id) => (
              <button key={id} className="btn btn-sm" onClick={() => topup(id)} disabled={busy}>
                + {TOPUP_PACKS[id].label} · {dollars(TOPUP_PACKS[id].priceCents)}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted">
          Top-ups never expire — they roll over month to month and are used only after your monthly allotment.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {data.seatList.map((seat) => (
          <div key={seat.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
            <span>💺</span>
            <div className="min-w-0">
              <div className="font-medium">{seat.assignedName ?? <span className="text-muted">Empty seat</span>}</div>
              <div className="text-xs text-muted">
                {seat.kind === 'base' ? 'Base seat' : 'Extra seat · $12/mo'}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {seat.status === 'past_due' && (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600">Unpaid</span>
              )}
              {canBill && seat.kind === 'extra' && !seat.assignedMembershipId && (
                <button className="btn btn-sm" onClick={() => release(seat.id)}>
                  Release
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted">
        Buying a seat opens Stripe Checkout; the seat appears here once payment completes. To free an occupied seat, remove
        that member on the Members tab. An unpaid seat deactivates its member until payment is fixed.
      </p>
    </div>
  );
}

// ── Activity log ────────────────────────────────────────────────────────────────
const AUDIT_VERB: Record<string, (d: string) => string> = {
  'invite.sent': (d) => `invited ${d}`,
  'invite.revoked': () => 'revoked an invite',
  'invite.resent': (d) => `re-sent an invite to ${d}`,
  'member.joined': () => 'joined the workspace',
  'member.removed': (d) => `removed ${d}`,
  'member.left': () => 'left the workspace',
  'permissions.changed': (d) => `updated ${d}’s permissions`,
  'ownership.transferred': (d) => `transferred ownership to ${d}`,
  'workspace.renamed': (d) => `renamed the workspace to “${d}”`,
  'seat.added': () => 'added a seat',
  'seat.removed': () => 'removed a seat',
  'member.deactivated': (d) => `deactivated ${d} (unpaid seat)`,
  'member.reactivated': (d) => `reactivated ${d}`,
  'topup.purchased': (d) => `purchased a top-up (${d})`,
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

function ActivityTab({ data }: { data: WorkspaceDetail }) {
  if (data.audit.length === 0) return <p className="text-xs text-muted">No activity yet.</p>;
  return (
    <div className="flex flex-col gap-2">
      {data.audit.map((e) => {
        const verb = AUDIT_VERB[e.action]?.(e.detail) ?? e.action;
        return (
          <div key={e.id} className="flex items-center gap-2 border-b border-border pb-2 text-sm last:border-0">
            <span className="text-muted">•</span>
            <span>
              <b>{e.actorName}</b> {verb}
            </span>
            <span className="ml-auto shrink-0 text-xs text-muted">{relTime(e.createdAt)}</span>
          </div>
        );
      })}
    </div>
  );
}

function UsageBar({ label, used, limit, balance }: { label: string; used: number; limit: number; balance?: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const over = used >= limit;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="text-muted">
          {used.toLocaleString()} / {limit.toLocaleString()}
          {balance ? ` (+${balance.toLocaleString()} top-up)` : ''}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: over ? 'var(--ai-accent)' : 'var(--primary)' }}
        />
      </div>
    </div>
  );
}

// ── Permission editor (presets + granular) ──────────────────────────────────────
function PermissionEditor({ value, onChange }: { value: Permission[]; onChange: (v: Permission[]) => void }) {
  const set = new Set(value);
  const toggle = (p: Permission) => {
    const next = new Set(set);
    next.has(p) ? next.delete(p) : next.add(p);
    onChange([...next]);
  };
  const matchesPreset = (id: PresetId) => {
    const a = new Set(PRESETS[id].permissions);
    return a.size === set.size && [...a].every((p) => set.has(p));
  };
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESET_IDS.map((id) => (
          <button
            key={id}
            onClick={() => onChange([...PRESETS[id].permissions])}
            className={`rounded-md border px-2 py-1 text-[11px] ${
              matchesPreset(id) ? 'border-primary bg-surface-muted font-medium' : 'border-border text-muted'
            }`}
            title={PRESETS[id].blurb}
          >
            {PRESETS[id].label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.group}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{group.group}</p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
                <label key={item.key} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={set.has(item.key)} onChange={() => toggle(item.key)} />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Workspaces you belong to (members, not owner) ───────────────────────────────
function OtherWorkspaces({
  memberships,
  ownedId,
  activeId,
}: {
  memberships: WorkspaceListItem[];
  ownedId: string | null;
  activeId: string | null;
}) {
  const others = memberships.filter((w) => w.id !== ownedId);
  if (others.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">Workspaces you belong to</h2>
      <div className="flex flex-col gap-2">
        {others.map((w) => (
          <div key={w.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
            <span>👥</span>
            <span className="font-medium">{w.name}</span>
            {activeId === w.id && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">Active</span>}
            <button
              className="btn btn-sm ml-auto"
              onClick={async () => {
                await switchWorkspaceApi(w.id);
                window.location.href = '/app';
              }}
            >
              {activeId === w.id ? 'Current' : 'Switch to'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
