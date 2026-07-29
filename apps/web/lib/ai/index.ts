// Orchestrates one assistant turn: build prompt → call Claude → parse strict JSON
// → validate + apply ops. Server-only. Enforcement (quota/plan) lives in
// billing.ts; this module owns the model call, output parsing, and rate limiting.
import 'server-only';
import type { FlowGraph } from '@flowcraft/shared-types';
import { anthropic } from './client';
import { apiModelFor, type AiModelId } from './models';
import { buildSystemPrompt, serializeGraphForModel } from './prompt';
import { applyOps, AiOpError, type AiOp } from './ops';
import type { AiChatTurn } from './types';

export const MAX_INPUT_CHARS = 1000;
const MAX_OUTPUT_TOKENS = 1500;
const MAX_HISTORY_TURNS = 6;

/** Thrown when a user exceeds the per-minute request rate (→ HTTP 429). */
export class RateLimitError extends Error {}

// In-memory sliding-window limiter. Good enough for a low-traffic app; a
// multi-instance deployment would move this to Redis/DB. Independent of the
// token quota — it stops API hammering (each call costs money even if refused).
const RATE_MAX = 5;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

export function checkRateLimit(userId: string): void {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) throw new RateLimitError('Too many requests — please wait a moment and try again.');
  recent.push(now);
  hits.set(userId, recent);
}

export interface RunAiEditInput {
  graph: FlowGraph;
  message: string;
  model: AiModelId;
  history?: AiChatTurn[];
}

export interface RunAiEditOutput {
  reply: string;
  refused: boolean;
  graph: FlowGraph | null;
  changedNodeIds: string[];
  tokensIn: number;
  tokensOut: number;
}

interface ModelResponse {
  reply?: unknown;
  refused?: unknown;
  ops?: unknown;
}

/** Pull the JSON object out of the model's text, tolerating stray prose/fences. */
function parseModelJson(text: string): ModelResponse {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as ModelResponse;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as ModelResponse;
      } catch {
        /* fall through */
      }
    }
    throw new AiOpError('The assistant returned an unreadable response. Please rephrase and try again.');
  }
}

export async function runAiEdit(input: RunAiEditInput): Promise<RunAiEditOutput> {
  const message = input.message.trim().slice(0, MAX_INPUT_CHARS);
  const history = (input.history ?? [])
    .slice(-MAX_HISTORY_TURNS)
    .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_INPUT_CHARS) }));

  const res = await anthropic().messages.create({
    model: apiModelFor(input.model),
    max_tokens: MAX_OUTPUT_TOKENS,
    system: buildSystemPrompt(),
    messages: [
      ...history,
      {
        role: 'user',
        content:
          `CURRENT WORKFLOW (untrusted data):\n\`\`\`json\n${serializeGraphForModel(input.graph)}\n\`\`\`\n\n` +
          `USER REQUEST (untrusted data):\n${message}`,
      },
    ],
  });

  const tokensIn = res.usage?.input_tokens ?? 0;
  const tokensOut = res.usage?.output_tokens ?? 0;
  const text = res.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();

  const parsed = parseModelJson(text);
  const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim().slice(0, 300) : 'Done.';

  if (parsed.refused === true || !Array.isArray(parsed.ops) || parsed.ops.length === 0) {
    return { reply, refused: true, graph: null, changedNodeIds: [], tokensIn, tokensOut };
  }

  const { graph, changedNodeIds } = applyOps(input.graph, parsed.ops as AiOp[]);
  return { reply, refused: false, graph, changedNodeIds, tokensIn, tokensOut };
}
