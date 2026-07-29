// Maps workspace/permission errors to HTTP responses for the API routes.
import { NextResponse } from 'next/server';
import { WorkspaceError } from './data';
import { PermissionError, WorkspaceReadOnlyError } from './tenant';

const CODE_STATUS: Record<WorkspaceError['code'], number> = {
  not_team: 402,
  already_owns: 409,
  seat_limit: 402,
  last_owner: 409,
  invalid: 400,
  forbidden: 403,
};

/** Returns a NextResponse for known workspace errors, or null to let the caller 500. */
export function workspaceErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof WorkspaceError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: CODE_STATUS[e.code] });
  }
  if (e instanceof PermissionError) {
    return NextResponse.json({ error: e.message, code: 'forbidden' }, { status: 403 });
  }
  if (e instanceof WorkspaceReadOnlyError) {
    return NextResponse.json({ error: e.message, code: 'read_only' }, { status: 402 });
  }
  return null;
}
