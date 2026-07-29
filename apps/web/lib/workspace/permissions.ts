// The workspace permission catalog + preset bundles. Client-SAFE (pure data) so the
// management UI and the server both import the same source of truth. Enforcement is
// permission-based (not roles); presets are just convenience bundles of permissions.

export const PERMISSIONS = [
  'workflow.create',
  'workflow.edit',
  'workflow.delete',
  'workflow.run',
  'workflow.activate',
  'widget.create',
  'widget.edit',
  'widget.delete',
  'ai.use',
  'member.invite',
  'member.remove',
  'member.manage_permissions',
  'workspace.manage',
  'workspace.billing',
  'workspace.delete',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(v: unknown): v is Permission {
  return typeof v === 'string' && (PERMISSIONS as readonly string[]).includes(v);
}

/** UI grouping + labels. Every active member can always VIEW (read) — no perm needed. */
export const PERMISSION_GROUPS: { group: string; items: { key: Permission; label: string }[] }[] = [
  {
    group: 'Workflows',
    items: [
      { key: 'workflow.create', label: 'Create workflows' },
      { key: 'workflow.edit', label: 'Edit workflows' },
      { key: 'workflow.delete', label: 'Delete workflows' },
      { key: 'workflow.run', label: 'Run workflows' },
      { key: 'workflow.activate', label: 'Activate / schedule workflows' },
    ],
  },
  {
    group: 'Widgets',
    items: [
      { key: 'widget.create', label: 'Create widgets' },
      { key: 'widget.edit', label: 'Edit widgets' },
      { key: 'widget.delete', label: 'Delete widgets' },
    ],
  },
  {
    group: 'AI',
    items: [{ key: 'ai.use', label: 'Use the AI assistant' }],
  },
  {
    group: 'Members',
    items: [
      { key: 'member.invite', label: 'Invite members' },
      { key: 'member.remove', label: 'Remove members' },
      { key: 'member.manage_permissions', label: 'Manage member permissions' },
    ],
  },
  {
    group: 'Workspace',
    items: [
      { key: 'workspace.manage', label: 'Manage workspace settings' },
      { key: 'workspace.billing', label: 'Manage billing & seats' },
      { key: 'workspace.delete', label: 'Delete the workspace' },
    ],
  },
];

export type PresetId = 'viewer' | 'editor' | 'admin';

const EDITOR: Permission[] = [
  'workflow.create',
  'workflow.edit',
  'workflow.run',
  'widget.create',
  'widget.edit',
  'ai.use',
];

const ADMIN: Permission[] = [
  ...EDITOR,
  'workflow.delete',
  'workflow.activate',
  'widget.delete',
  'member.invite',
  'member.remove',
  'member.manage_permissions',
  'workspace.manage',
];

export const PRESETS: Record<PresetId, { label: string; blurb: string; permissions: Permission[] }> = {
  viewer: { label: 'Viewer', blurb: 'Read-only access to everything.', permissions: [] },
  editor: { label: 'Editor', blurb: 'Build & run workflows, manage widgets, use AI.', permissions: EDITOR },
  admin: {
    label: 'Admin',
    blurb: 'Everything except billing & deleting the workspace.',
    permissions: ADMIN,
  },
};

export const PRESET_IDS: PresetId[] = ['viewer', 'editor', 'admin'];

/** Owner-only permissions — never grantable to non-owners via presets/toggles. */
export const OWNER_ONLY: Permission[] = ['workspace.billing', 'workspace.delete'];

/** Does a membership grant a permission? Owner holds everything implicitly. */
export function membershipCan(
  m: { isOwner: boolean; permissions: Permission[] },
  perm: Permission,
): boolean {
  return m.isOwner || m.permissions.includes(perm);
}

/** Sanitize an arbitrary permissions array to the known set (drops unknown/owner-only). */
export function cleanPermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<Permission>();
  for (const p of input) {
    if (isPermission(p) && !OWNER_ONLY.includes(p)) set.add(p);
  }
  return [...set];
}
