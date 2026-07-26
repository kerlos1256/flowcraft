import { NextResponse } from 'next/server';
import { createWorkflowFromTemplate } from '@/lib/data';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Fork a curated template into the signed-in user's account. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { slug?: string };
  if (!body.slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
  const wf = await createWorkflowFromTemplate(s.sub, body.slug);
  return wf ? NextResponse.json(wf, { status: 201 }) : NextResponse.json({ error: 'unknown template' }, { status: 404 });
}
