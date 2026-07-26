import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/data';
import { verifyPassword, createSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  const user = await findUserByEmail(email);
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  await createSession({ id: user.id, email: user.email, name: user.name });
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
}
