// Append-only workspace activity log. Server-only. logAudit never throws — an
// audit failure must never break the action it's recording.
import 'server-only';
import { prisma } from '@/lib/prisma';

export type AuditAction =
  | 'invite.sent'
  | 'invite.revoked'
  | 'invite.resent'
  | 'member.joined'
  | 'member.removed'
  | 'member.left'
  | 'permissions.changed'
  | 'ownership.transferred'
  | 'workspace.renamed'
  | 'seat.added'
  | 'seat.removed'
  | 'member.deactivated'
  | 'member.reactivated'
  | 'topup.purchased';

export async function logAudit(
  workspaceId: string,
  actorName: string,
  action: AuditAction,
  detail = '',
): Promise<void> {
  try {
    await prisma.workspaceAuditLog.create({
      data: { workspaceId, actorName: actorName.slice(0, 80), action, detail: detail.slice(0, 160) },
    });
  } catch {
    /* audit is best-effort — never break the caller */
  }
}

export interface AuditEntry {
  id: string;
  actorName: string;
  action: string;
  detail: string;
  createdAt: string;
}

export async function listAudit(workspaceId: string, limit = 40): Promise<AuditEntry[]> {
  const rows = await prisma.workspaceAuditLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    actorName: r.actorName,
    action: r.action,
    detail: r.detail,
    createdAt: r.createdAt.toISOString(),
  }));
}
