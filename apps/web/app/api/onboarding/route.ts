import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createWorkflowFromTemplate } from '@/lib/data';
import { USE_CASE_BY_ID } from '@/lib/templates';
import { limitErrorResponse } from '@/lib/api-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Onboarding: seed a tailored starter workflow for the chosen use case. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { useCase?: string };
  const useCase = body.useCase ? USE_CASE_BY_ID[body.useCase] : undefined;

  // "Just exploring" (or unknown) → no starter, straight to an empty dashboard.
  if (!useCase || !useCase.templateSlug) return NextResponse.json({ workflowId: null });

  try {
    const wf = await createWorkflowFromTemplate(s.sub, useCase.templateSlug);
    return NextResponse.json({ workflowId: wf?.id ?? null });
  } catch (e) {
    return limitErrorResponse(e) ?? NextResponse.json({ workflowId: null });
  }
}
