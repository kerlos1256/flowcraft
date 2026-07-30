import { NextResponse } from 'next/server';
import { getWorkflow } from '@/lib/data';
import { listWidgets } from '@/lib/widget-data';
import { prisma } from '@/lib/prisma';
import { assertCanUseAi, getAiUsage } from '@/lib/billing';
import { limitErrorResponse } from '@/lib/api-errors';
import { resolveTenant, requirePermission, assertWritable, createStamp } from '@/lib/workspace/tenant';
import { consumeWorkspaceAiOverflow } from '@/lib/workspace/usage';
import { workspaceErrorResponse } from '@/lib/workspace/http';
import { aiConfigured } from '@/lib/ai/client';
import { aiTokenCost, isAiModelId } from '@/lib/ai/models';
import { runAiEdit, checkRateLimit, RateLimitError, MAX_INPUT_CHARS } from '@/lib/ai';
import { AiOpError } from '@/lib/ai/ops';
import type { AiChatTurn, AiEditResult } from '@/lib/ai/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const t = await resolveTenant();
  if (!t) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!aiConfigured()) {
    return NextResponse.json({ error: 'The AI assistant is not configured on this server.' }, { status: 503 });
  }

  const wf = await getWorkflow(params.id, t);
  if (!wf) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
    model?: string;
    history?: AiChatTurn[];
  };
  const message = (body.message ?? '').trim();
  if (!message) return NextResponse.json({ error: 'Describe what you want to change.' }, { status: 400 });
  if (message.length > MAX_INPUT_CHARS) {
    return NextResponse.json({ error: `Keep your request under ${MAX_INPUT_CHARS} characters.` }, { status: 400 });
  }
  const model = isAiModelId(body.model) ? body.model : 'sonnet';

  try {
    requirePermission(t, 'ai.use');
    assertWritable(t);
    checkRateLimit(t.userId);
    await assertCanUseAi(t, params.id, model); // → 402 on limit

    const widgets = await listWidgets(t);
    const result = await runAiEdit({
      graph: wf.graph,
      message,
      model,
      history: body.history,
      widgets: widgets.map((w) => ({ id: w.id, name: w.name, type: w.type })),
    });

    // Consume quota only on a real edit; stamp the tenant (userId + workspaceId).
    if (!result.refused) {
      // Deduct any overflow beyond the monthly allotment from the workspace's top-up
      // balance BEFORE recording (so the month's `used` excludes this edit).
      if (t.kind === 'workspace') await consumeWorkspaceAiOverflow(t.workspaceId, aiTokenCost(model));
      await prisma.aiEdit.create({
        data: {
          ...createStamp(t),
          workflowId: params.id,
          model,
          tokenCost: aiTokenCost(model),
          promptChars: message.length,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        },
      });
    }

    const usage = await getAiUsage(t, params.id);
    const payload: AiEditResult = {
      reply: result.reply,
      refused: result.refused,
      graph: result.graph,
      changedNodeIds: result.changedNodeIds,
      usage: { ...usage, configured: true },
    };
    return NextResponse.json(payload);
  } catch (e) {
    const limit = limitErrorResponse(e);
    if (limit) return limit;
    const wsErr = workspaceErrorResponse(e);
    if (wsErr) return wsErr;
    if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429 });
    if (e instanceof AiOpError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error('AI edit failed', e);
    return NextResponse.json({ error: 'The assistant hit an error. Please try again.' }, { status: 500 });
  }
}
