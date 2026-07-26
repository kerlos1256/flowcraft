import { cookies } from 'next/headers';
import * as bcrypt from 'bcryptjs';
import { SESSION_COOKIE, signSession, verifySession, type SessionPayload } from './jwt';

// Node-side auth helpers (route handlers + server components). Password hashing
// uses bcryptjs; sessions are httpOnly JWT cookies verified via jose.

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: { id: string; email: string; name: string }): Promise<void> {
  const token = await signSession({ sub: user.id, email: user.email, name: user.name });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function destroySession(): void {
  cookies().set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
}

/** Current session (or null) from the request cookie. */
export async function getSession(): Promise<SessionPayload | null> {
  return verifySession(cookies().get(SESSION_COOKIE)?.value);
}

/** Session or throw — for route handlers that require auth. */
export async function requireSession(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) throw new UnauthorizedError();
  return s;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
    this.name = 'UnauthorizedError';
  }
}
