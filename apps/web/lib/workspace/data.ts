// Workspace control-plane data layer: create/manage workspaces, members, and invites.
// Server-only. Phase 1 operates within the 2 base seats (extra-seat purchasing is
// Phase 2). Coarse permission checks live in the routes (via tenant); this layer
// enforces structural rules: Team-gate, one owned workspace, seat availability, the
// last-owner rule, and the privilege-escalation guard.
import 'server-only';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { cleanPermissions, PRESETS, type Permission } from './permissions';
import { provisionBaseSeats, assignFreeSeat, availableSeats } from './seats';

// Seat accounting lives in ./seats; re-exported so existing importers keep working.
export { BASE_SEATS, availableSeats } from './seats';

export class WorkspaceError extends Error {
  constructor(
    message: string,
    public code: 'not_team' | 'already_owns' | 'seat_limit' | 'last_owner' | 'invalid' | 'forbidden',
  ) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

function appBaseUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.WEB_ORIGIN ||
    'http://localhost:3003'
  ).replace(/\/$/, '');
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return `${base || 'workspace'}-${randomBytes(3).toString('hex')}`;
}

const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

// ── Workspaces ────────────────────────────────────────────────────────────────

/** Team-plan owners only, one workspace each (MVP). Creates the owner membership. */
export async function createWorkspace(userId: string, name: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, name: true } });
  if (user?.plan !== 'team') {
    throw new WorkspaceError('Workspaces are a Team plan feature. Upgrade to create one.', 'not_team');
  }
  const existing = await prisma.workspace.findFirst({ where: { ownerUserId: userId }, select: { id: true } });
  if (existing) throw new WorkspaceError('You already own a workspace.', 'already_owns');

  const clean = name.trim().slice(0, 60) || 'My Workspace';
  const ws = await prisma.workspace.create({
    data: {
      name: clean,
      slug: slugify(clean),
      ownerUserId: userId,
      memberships: {
        create: { userId, displayName: user?.name || 'Owner', isOwner: true, permissions: [], status: 'active' },
      },
    },
    include: { memberships: true },
  });
  await provisionBaseSeats(ws.id, ws.memberships[0].id); // 2 base seats; owner takes one
  return ws;
}

/** Workspaces the user belongs to (for the switcher). */
export async function listMyWorkspaces(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId, status: 'active' },
    include: { workspace: { select: { id: true, name: true, status: true, ownerUserId: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    status: m.workspace.status,
    isOwner: m.isOwner,
  }));
}

export async function getOwnedWorkspace(userId: string) {
  return prisma.workspace.findFirst({ where: { ownerUserId: userId } });
}

/** Workspaces where the user's seat is unpaid/suspended (deactivated membership). */
export async function listDeactivatedMemberships(userId: string) {
  const rows = await prisma.membership.findMany({
    where: { userId, status: 'deactivated' },
    include: { workspace: { select: { name: true } } },
  });
  return rows.map((m) => ({ workspaceId: m.workspaceId, workspaceName: m.workspace.name }));
}

export async function renameWorkspace(workspaceId: string, name: string) {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new WorkspaceError('Name is required.', 'invalid');
  return prisma.workspace.update({ where: { id: workspaceId }, data: { name: clean } });
}

export async function deleteWorkspace(workspaceId: string) {
  await prisma.workspace.delete({ where: { id: workspaceId } }); // cascades members/invites; resources' workspaceId cascade-deletes too
}

// ── Members ───────────────────────────────────────────────────────────────────

export async function listMembers(workspaceId: string) {
  const rows = await prisma.membership.findMany({
    where: { workspaceId },
    include: { user: { select: { email: true } } },
    orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
  });
  return rows.map((m) => ({
    id: m.id,
    userId: m.userId,
    email: m.user.email,
    displayName: m.displayName,
    isOwner: m.isOwner,
    status: m.status,
    permissions: cleanPermissions(m.permissions),
  }));
}

export async function countActiveMembers(workspaceId: string): Promise<number> {
  return prisma.membership.count({ where: { workspaceId, status: 'active' } });
}

/** The acting user's membership in a specific workspace (for management routes). */
export async function getMembership(workspaceId: string, userId: string) {
  const m = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!m) return null;
  return {
    id: m.id,
    userId: m.userId,
    displayName: m.displayName,
    isOwner: m.isOwner,
    status: m.status,
    permissions: cleanPermissions(m.permissions),
  };
}

/**
 * Update a member's permissions. Escalation guard: a non-owner actor can't grant a
 * permission they don't themselves hold, and the owner's permissions are untouchable.
 */
export async function updateMemberPermissions(
  workspaceId: string,
  membershipId: string,
  requested: unknown,
  acting: { isOwner: boolean; permissions: Permission[] },
) {
  const target = await prisma.membership.findFirst({ where: { id: membershipId, workspaceId } });
  if (!target) throw new WorkspaceError('Member not found.', 'invalid');
  if (target.isOwner) throw new WorkspaceError("The owner's permissions can't be changed.", 'forbidden');

  let next = cleanPermissions(requested);
  if (!acting.isOwner) {
    const held = new Set(acting.permissions);
    next = next.filter((p) => held.has(p)); // can't grant what you don't have
  }
  return prisma.membership.update({ where: { id: membershipId }, data: { permissions: next } });
}

export async function removeMember(workspaceId: string, membershipId: string) {
  const target = await prisma.membership.findFirst({ where: { id: membershipId, workspaceId } });
  if (!target) throw new WorkspaceError('Member not found.', 'invalid');
  if (target.isOwner) throw new WorkspaceError("The owner can't be removed.", 'last_owner');
  await prisma.membership.delete({ where: { id: membershipId } });
}

/** Hand the workspace to another active member. The old owner becomes an Admin. */
export async function transferOwnership(workspaceId: string, targetMembershipId: string) {
  const target = await prisma.membership.findFirst({
    where: { id: targetMembershipId, workspaceId, status: 'active' },
  });
  if (!target) throw new WorkspaceError('Choose an active member to transfer ownership to.', 'invalid');
  if (target.isOwner) return;
  const currentOwner = await prisma.membership.findFirst({ where: { workspaceId, isOwner: true } });
  await prisma.$transaction([
    prisma.workspace.update({ where: { id: workspaceId }, data: { ownerUserId: target.userId } }),
    prisma.membership.update({ where: { id: target.id }, data: { isOwner: true, permissions: [] } }),
    ...(currentOwner
      ? [prisma.membership.update({ where: { id: currentOwner.id }, data: { isOwner: false, permissions: PRESETS.admin.permissions } })]
      : []),
  ]);
}

export async function leaveWorkspace(workspaceId: string, userId: string) {
  const m = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true, isOwner: true },
  });
  if (!m) throw new WorkspaceError('You are not a member.', 'invalid');
  if (m.isOwner) throw new WorkspaceError('The owner must transfer ownership or delete the workspace.', 'last_owner');
  await prisma.membership.delete({ where: { id: m.id } });
}

// ── Invites ───────────────────────────────────────────────────────────────────

export interface CreatedInvite {
  id: string;
  email: string;
  link: string;
  rawToken: string;
}

export async function createInvite(
  workspaceId: string,
  invitedByUserId: string,
  email: string,
  requestedPermissions: unknown,
  acting: { isOwner: boolean; permissions: Permission[] },
): Promise<CreatedInvite> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) throw new WorkspaceError('Enter a valid email.', 'invalid');

  // Already a member?
  const existing = await prisma.membership.findFirst({
    where: { workspaceId, user: { email: normalized } },
    select: { id: true },
  });
  if (existing) throw new WorkspaceError('That person is already a member.', 'invalid');

  const dupe = await prisma.workspaceInvite.findFirst({
    where: { workspaceId, email: normalized, status: 'pending' },
    select: { id: true },
  });
  if (dupe) throw new WorkspaceError('An invite is already pending for that email.', 'invalid');

  if ((await availableSeats(workspaceId)) <= 0) {
    throw new WorkspaceError('All seats are in use. Add more seats to invite additional members.', 'seat_limit');
  }

  let permissions = cleanPermissions(requestedPermissions);
  if (!acting.isOwner) {
    const held = new Set(acting.permissions);
    permissions = permissions.filter((p) => held.has(p));
  }

  const rawToken = randomBytes(24).toString('hex');
  const invite = await prisma.workspaceInvite.create({
    data: {
      workspaceId,
      email: normalized,
      permissions,
      tokenHash: hashToken(rawToken),
      invitedByUserId,
      status: 'pending',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14), // 14 days
    },
  });
  return { id: invite.id, email: normalized, rawToken, link: `${appBaseUrl()}/invite/${rawToken}` };
}

export async function listInvites(workspaceId: string) {
  const rows = await prisma.workspaceInvite.findMany({
    where: { workspaceId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((i) => ({
    id: i.id,
    email: i.email,
    permissions: cleanPermissions(i.permissions),
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
  }));
}

export async function revokeInvite(workspaceId: string, inviteId: string) {
  await prisma.workspaceInvite.updateMany({
    where: { id: inviteId, workspaceId, status: 'pending' },
    data: { status: 'revoked' },
  });
}

/** Re-issue a pending invite: fresh token (old link dies) + extended expiry. */
export async function resendInvite(
  workspaceId: string,
  inviteId: string,
): Promise<{ email: string; link: string } | null> {
  const invite = await prisma.workspaceInvite.findFirst({ where: { id: inviteId, workspaceId, status: 'pending' } });
  if (!invite) return null;
  const rawToken = randomBytes(24).toString('hex');
  await prisma.workspaceInvite.update({
    where: { id: invite.id },
    data: { tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14) },
  });
  return { email: invite.email, link: `${appBaseUrl()}/invite/${rawToken}` };
}

/** Public-ish lookup for the accept page (by raw token). */
export async function getInviteByToken(rawToken: string) {
  const invite = await prisma.workspaceInvite.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { workspace: { select: { name: true } } },
  });
  if (!invite) return null;
  const expired = invite.status === 'pending' && invite.expiresAt < new Date();
  return {
    id: invite.id,
    email: invite.email,
    workspaceId: invite.workspaceId,
    workspaceName: invite.workspace.name,
    status: expired ? ('expired' as const) : (invite.status as 'pending' | 'accepted' | 'revoked' | 'expired'),
    permissions: cleanPermissions(invite.permissions),
  };
}

/** Accept an invite: creates the membership + per-workspace display name. */
export async function acceptInvite(rawToken: string, userId: string, displayName: string) {
  const invite = await prisma.workspaceInvite.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!invite || invite.status !== 'pending') throw new WorkspaceError('This invite is no longer valid.', 'invalid');
  if (invite.expiresAt < new Date()) {
    await prisma.workspaceInvite.update({ where: { id: invite.id }, data: { status: 'expired' } });
    throw new WorkspaceError('This invite has expired.', 'invalid');
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!user) throw new WorkspaceError('User not found.', 'invalid');
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new WorkspaceError('This invite was sent to a different email address.', 'forbidden');
  }

  const already = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
    select: { id: true },
  });
  if (already) {
    await prisma.workspaceInvite.update({ where: { id: invite.id }, data: { status: 'accepted' } });
    return invite.workspaceId;
  }

  const name = displayName.trim().slice(0, 60) || user.name || 'Member';
  const [membership] = await prisma.$transaction([
    prisma.membership.create({
      data: {
        workspaceId: invite.workspaceId,
        userId,
        displayName: name,
        isOwner: false,
        permissions: cleanPermissions(invite.permissions),
        status: 'active',
      },
    }),
    prisma.workspaceInvite.update({ where: { id: invite.id }, data: { status: 'accepted' } }),
  ]);
  await assignFreeSeat(invite.workspaceId, membership.id); // take a free seat
  return invite.workspaceId;
}
