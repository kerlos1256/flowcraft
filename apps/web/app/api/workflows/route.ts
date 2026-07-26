import { NextResponse } from 'next/server';
import { createWorkflow, listWorkflows } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await listWorkflows());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled workflow';
  return NextResponse.json(await createWorkflow(name), { status: 201 });
}
