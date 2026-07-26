import { SignJWT, jwtVerify } from 'jose';

// Edge-safe JWT (jose only — no Node APIs) so middleware can verify sessions.
export const SESSION_COOKIE = 'fc_session';

export interface SessionPayload {
  sub: string; // user id
  email: string;
  name: string;
}

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'dev-insecure-flowcraft-secret-change-me',
);

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ email: p.email, name: p.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: String(payload.sub),
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
    };
  } catch {
    return null;
  }
}
