import { NextResponse } from 'next/server';
import { createUser, findUserByEmail } from '@/lib/data';
import { hashPassword, createSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    password?: string;
  };
  const email = (body.email ?? '').trim().toLowerCase();
  const name = (body.name ?? '').trim();
  const password = body.password ?? '';

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 });
  }
  if (name.length < 1) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  if (await findUserByEmail(email)) {
    return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
  }

  const user = await createUser({ email, name, passwordHash: await hashPassword(password) });
  await createSession(user);
  return NextResponse.json({ user }, { status: 201 });
}
