import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import {
  NODE_TYPE_CATEGORY,
  type FlowGraph,
  type FlowNode,
  type FlowEdge,
  type NodeCategory,
  type TriggerKind,
} from '@flowcraft/shared-types';

/** Prisma's JSON input type wants JsonValue leaves; our records are plain objects. */
const asJson = (v: Record<string, unknown>): Prisma.InputJsonValue => v as Prisma.InputJsonValue;
const asJsonOrUndef = (v: Record<string, unknown> | null): Prisma.InputJsonValue | undefined =>
  v ? (v as Prisma.InputJsonValue) : undefined;

/**
 * The minimal slice of Inngest's step tools the interpreter needs. Kept narrow so
 * the interpreter is easy to reason about and unit-test with a fake.
 */
export interface StepTools {
  // Return is `unknown` (not `T`) so Inngest's real step — which returns the
  // JSON-serialized form of the step result — is assignable to this shape.
  run<T>(id: string, fn: () => Promise<T>): Promise<unknown>;
  sleep(id: string, duration: string): Promise<void>;
}

export interface RunGraphDeps {
  step: StepTools;
  prisma: PrismaClient;
  graph: FlowGraph;
  runId: string;
  triggeredBy: TriggerKind;
  payload: Record<string, unknown>;
}

/**
 * Walk the saved React Flow graph and execute it as durable Inngest steps
 * (spec §4 Phase 2). Starting at the trigger node we BFS forward along edges:
 *
 *   • trigger   → one step logging the trigger fired
 *   • action    → step.run(); the body records the run_step, and on error records
 *                 the failed attempt and rethrows so Inngest retries the step
 *   • delay     → step.sleep() for durable, worker-free waiting
 *   • condition → step.run() evaluates the comparison; only the matching-handle
 *                 branch is enqueued, so the untaken branch's nodes are never
 *                 reached and get marked `skipped` at the end
 *
 * All DB writes happen inside step bodies so Inngest's replay never double-writes.
 */
export async function runWorkflowGraph(deps: RunGraphDeps): Promise<void> {
  const { step, prisma, graph, runId, triggeredBy, payload } = deps;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, FlowEdge[]>();
  for (const e of graph.edges) {
    (outgoing.get(e.source) ?? outgoing.set(e.source, []).get(e.source)!).push(e);
  }

  const trigger = graph.nodes.find((n) => NODE_TYPE_CATEGORY[n.data.type] === 'trigger');
  if (!trigger) throw new Error('Workflow has no trigger node');

  const executed = new Set<string>();
  const queue: string[] = [trigger.id];

  const enqueue = (edges: FlowEdge[] | undefined) => {
    for (const e of edges ?? []) queue.push(e.target);
  };

  while (queue.length) {
    const id = queue.shift()!;
    if (executed.has(id)) continue;
    const node = byId.get(id);
    if (!node) continue;
    executed.add(id);

    const category = NODE_TYPE_CATEGORY[node.data.type];

    if (category === 'trigger') {
      await step.run(`node-${id}`, async () => {
        await recordStep(prisma, runId, node, 'trigger', 'succeeded', { triggeredBy, payload }, null);
        return { triggeredBy };
      });
      enqueue(outgoing.get(id));
    } else if (category === 'delay') {
      const duration = durationString(node.data.config);
      await step.run(`node-${id}`, async () => {
        await recordStep(prisma, runId, node, 'delay', 'succeeded', { duration }, null);
        return { duration };
      });
      await step.sleep(`sleep-${id}`, duration);
      enqueue(outgoing.get(id));
    } else if (category === 'condition') {
      const result = await step.run(`node-${id}`, async () => {
        const evaluated = evaluateCondition(node, payload);
        await recordStep(
          prisma,
          runId,
          node,
          'condition',
          'succeeded',
          { ...describeCondition(node), result: evaluated },
          null,
        );
        return evaluated;
      });
      const branch = result ? 'true' : 'false';
      for (const e of outgoing.get(id) ?? []) {
        if ((e.sourceHandle ?? 'true') === branch) queue.push(e.target);
      }
    } else {
      // action: retry-aware, records each attempt
      await step.run(`node-${id}`, async () => {
        const attempts = await beginStep(prisma, runId, node, category);
        try {
          const output = await executeAction(node, payload);
          await finishStep(prisma, runId, node.id, 'succeeded', output, null);
          return output;
        } catch (err) {
          await finishStep(prisma, runId, node.id, 'failed', null, errorMessage(err), attempts);
          throw err; // rethrow → Inngest retries this step
        }
      });
      enqueue(outgoing.get(id));
    }
  }

  // Anything never reached (e.g. the untaken condition branch) is skipped.
  await step.run('mark-skipped', async () => {
    const skipped = graph.nodes.filter((n) => !executed.has(n.id));
    for (const n of skipped) {
      await prisma.runStep.upsert({
        where: { runId_nodeId: { runId, nodeId: n.id } },
        create: {
          runId,
          nodeId: n.id,
          stepType: NODE_TYPE_CATEGORY[n.data.type],
          status: 'skipped',
          input: asJson(n.data.config),
          completedAt: new Date(),
        },
        update: {},
      });
    }
    return { skipped: skipped.length };
  });
}

// ── run_steps writers ────────────────────────────────────────────────────────

/** Upsert-and-increment: returns the attempt count for this execution. */
async function beginStep(
  prisma: PrismaClient,
  runId: string,
  node: FlowNode,
  category: NodeCategory,
): Promise<number> {
  const row = await prisma.runStep.upsert({
    where: { runId_nodeId: { runId, nodeId: node.id } },
    create: {
      runId,
      nodeId: node.id,
      stepType: category,
      status: 'pending',
      input: asJson(node.data.config),
      attempts: 1,
    },
    update: { attempts: { increment: 1 }, status: 'pending', error: null },
  });
  return row.attempts;
}

async function finishStep(
  prisma: PrismaClient,
  runId: string,
  nodeId: string,
  status: 'succeeded' | 'failed',
  output: Record<string, unknown> | null,
  error: string | null,
  attempts?: number,
): Promise<void> {
  await prisma.runStep.update({
    where: { runId_nodeId: { runId, nodeId } },
    data: {
      status,
      output: asJsonOrUndef(output),
      error,
      completedAt: status === 'succeeded' ? new Date() : undefined,
      ...(attempts !== undefined ? { attempts } : {}),
    },
  });
}

/** One-shot record for steps that don't have attempt semantics (trigger/delay/condition). */
async function recordStep(
  prisma: PrismaClient,
  runId: string,
  node: FlowNode,
  category: NodeCategory,
  status: 'succeeded' | 'failed',
  output: Record<string, unknown> | null,
  error: string | null,
): Promise<void> {
  await prisma.runStep.upsert({
    where: { runId_nodeId: { runId, nodeId: node.id } },
    create: {
      runId,
      nodeId: node.id,
      stepType: category,
      status,
      input: asJson(node.data.config),
      output: asJsonOrUndef(output),
      error,
      attempts: 1,
      completedAt: new Date(),
    },
    update: { status, output: asJsonOrUndef(output), error, completedAt: new Date() },
  });
}

// ── Node execution (actions are mocked in dev) ───────────────────────────────

async function executeAction(
  node: FlowNode,
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const cfg = node.data.config;
  switch (node.data.type) {
    case 'send_slack':
      return { channel: str(cfg.channel), message: str(cfg.message), delivered: true, mock: true };
    case 'send_email':
      return { to: str(cfg.to), subject: str(cfg.subject), delivered: true, mock: true };
    case 'http_request': {
      const failRate = Number(cfg.failRate ?? 0);
      // The reliability demo: fail a fraction of attempts so Inngest retries show.
      if (failRate > 0 && Math.random() < failRate) {
        throw new Error(`Simulated HTTP failure (failRate ${failRate})`);
      }
      return { status: 200, method: str(cfg.method) || 'GET', url: str(cfg.url), mock: true };
    }
    default:
      return { note: `no-op for ${node.data.type}` };
  }
}

// ── Condition evaluation ─────────────────────────────────────────────────────

function evaluateCondition(node: FlowNode, payload: Record<string, unknown>): boolean {
  const cfg = node.data.config;
  const left = resolveValue(str(cfg.left), payload);
  const right = str(cfg.right);
  const op = str(cfg.operator);

  switch (op) {
    case 'eq':
      return String(left) === right;
    case 'neq':
      return String(left) !== right;
    case 'gt':
      return Number(left) > Number(right);
    case 'lt':
      return Number(left) < Number(right);
    case 'contains':
      return String(left).includes(right);
    default:
      return false;
  }
}

/** `event.data.x.y` reads from the trigger payload; anything else is a literal. */
function resolveValue(expr: string, payload: Record<string, unknown>): unknown {
  const prefix = 'event.data.';
  if (!expr.startsWith(prefix)) return expr;
  const path = expr.slice(prefix.length).split('.');
  let cur: unknown = payload;
  for (const key of path) {
    if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

function describeCondition(node: FlowNode): Record<string, unknown> {
  const cfg = node.data.config;
  return { left: str(cfg.left), operator: str(cfg.operator), right: str(cfg.right) };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function durationString(config: Record<string, unknown>): string {
  const amount = Math.max(1, Math.floor(Number(config.amount ?? 1)));
  const unit = ['s', 'm', 'h'].includes(str(config.unit)) ? str(config.unit) : 'm';
  return `${amount}${unit}`;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
