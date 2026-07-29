// Tenant resolution: is the current request acting in the user's PERSONAL space or
// inside a WORKSPACE? The active workspace lives in its own cookie (not the JWT, which
// is a stable 7-day session), validated against a live membership on every request.
// Server-only (uses next/headers cookies + prisma).
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cleanPermissions, type Permission } from './permissions';

export const ACTIVE_WS_COOKIE = 'fc_active_workspace';

export interface MembershipInfo {
  id: string;
  displayName: string;
  isOwner: boolean;
  permissions: Permission[];
  status: string;
}

export type Tenant =
  | { kind: 'personal'; userId: string }
  | {
      kind: 'workspace';
      userId: string;
      workspaceId: string;
      workspaceName: string;
      workspaceStatus: string; // active | read_only | suspended
      membership: MembershipInfo;
    };

/** Set (or clear, with null) the active workspace cookie. */
export function setActiveWorkspaceCookie(workspaceId: string | null): void {
  if (workspaceId) {
    cookies().set(ACTIVE_WS_COOKIE, workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    cookies().set(ACTIVE_WS_COOKIE, '', { path: '/', maxAge: 0 });
  }
}

/**
 * Resolve the active tenant for the signed-in user. Returns null if unauthenticated.
 * Falls back to personal if the active-workspace cookie points at a workspace the
 * user is no longer an active member of.
 */
export async function resolveTenant(): Promise<Tenant | null> {
  const session = await getSession();
  if (!session) return null;
  const userId = session.sub;

  const wsId = cookies().get(ACTIVE_WS_COOKIE)?.value;
  if (!wsId) return { kind: 'personal', userId };

  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: wsId, userId } },
    include: { workspace: { select: { name: true, status: true } } },
  });
  if (!membership || membership.status !== 'active') {
    return { kind: 'personal', userId };
  }

  return {
    kind: 'workspace',
    userId,
    workspaceId: wsId,
    workspaceName: membership.workspace.name,
    workspaceStatus: membership.workspace.status,
    membership: {
      id: membership.id,
      displayName: membership.displayName,
      isOwner: membership.isOwner,
      permissions: cleanPermissions(membership.permissions),
      status: membership.status,
    },
  };
}

/**
 * Prisma `where` fragment that scopes a resource query to the tenant:
 * personal → the user's own personal rows (workspaceId null); workspace → all rows
 * of the workspace (shared, regardless of which member created them).
 */
export function scopeWhere(tenant: Tenant): { userId: string; workspaceId: null } | { workspaceId: string } {
  return tenant.kind === 'workspace'
    ? { workspaceId: tenant.workspaceId }
    : { userId: tenant.userId, workspaceId: null };
}

/** The (userId, workspaceId) to stamp on a newly-created resource. */
export function createStamp(tenant: Tenant): { userId: string; workspaceId: string | null } {
  return { userId: tenant.userId, workspaceId: tenant.kind === 'workspace' ? tenant.workspaceId : null };
}

/** True when the tenant may perform an action. Personal = full control over own data. */
export function can(tenant: Tenant, perm: Permission): boolean {
  if (tenant.kind === 'personal') return true;
  if (tenant.membership.isOwner) return true;
  return tenant.membership.permissions.includes(perm);
}

/** Thrown when the tenant lacks a permission — routes map to HTTP 403. */
export class PermissionError extends Error {
  constructor(public permission: Permission) {
    super(`You don't have permission to do this (${permission}).`);
    this.name = 'PermissionError';
  }
}

export function requirePermission(tenant: Tenant, perm: Permission): void {
  if (!can(tenant, perm)) throw new PermissionError(perm);
}

/** Workspace writes are blocked when the workspace is read-only (lapsed billing). */
export class WorkspaceReadOnlyError extends Error {
  constructor() {
    super('This workspace is read-only — its subscription needs attention.');
    this.name = 'WorkspaceReadOnlyError';
  }
}

export function assertWritable(tenant: Tenant): void {
  if (tenant.kind === 'workspace' && tenant.workspaceStatus !== 'active') {
    throw new WorkspaceReadOnlyError();
  }
}
