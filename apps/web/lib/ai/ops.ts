// Deterministic, server-side apply of the model's proposed edits. The model only
// ever emits a small list of typed operations against the CURRENT graph; this
// module validates every one against the node-template registry, assigns real
// UUIDs, auto-positions new nodes, and produces a valid FlowGraph. The model
// never sees or sets pixel positions, and can never inject arbitrary node types
// or config keys — everything is checked here.

import {
  NODE_TEMPLATE_BY_TYPE,
  NODE_TYPE_CATEGORY,
  defaultConfigFor,
  isTriggerType,
  type FlowGraph,
  type FlowNode,
  type FlowEdge,
  type NodeType,
} from '@flowcraft/shared-types';

export const MAX_NODES = 40;

/** Raised for a malformed / invalid op set; surfaced to the user as a soft error. */
export class AiOpError extends Error {}

// ── Operation shapes (must mirror the schema described in prompt.ts) ───────────

export interface AddNodeOp {
  op: 'add_node';
  tempId: string;
  type: string;
  label?: string;
  config?: Record<string, unknown>;
  /** Existing node id or a prior tempId to auto-connect from + position below. */
  after?: string;
}
export interface UpdateNodeOp {
  op: 'update_node';
  nodeId: string;
  label?: string;
  config?: Record<string, unknown>;
}
export interface DeleteNodeOp {
  op: 'delete_node';
  nodeId: string;
}
export interface ConnectOp {
  op: 'connect';
  source: string;
  target: string;
  /** For condition sources: 'true' | 'false'. */
  sourceHandle?: string;
}
export interface DisconnectOp {
  op: 'disconnect';
  source: string;
  target: string;
}
export type AiOp = AddNodeOp | UpdateNodeOp | DeleteNodeOp | ConnectOp | DisconnectOp;

export interface ApplyResult {
  graph: FlowGraph;
  changedNodeIds: string[];
}

/** The user's own widgets the AI may attach as widget_trigger nodes. */
export interface AiWidgetRef {
  id: string;
  name: string;
}
export interface ApplyOptions {
  widgets?: AiWidgetRef[];
}

const uuid = () => globalThis.crypto.randomUUID();

/** Keep only known config keys for a node type; coerce number fields. */
function sanitizeConfig(type: NodeType, raw: Record<string, unknown> | undefined): Record<string, unknown> {
  const schema = NODE_TEMPLATE_BY_TYPE[type].configSchema;
  const out: Record<string, unknown> = {};
  for (const field of schema) {
    if (raw && field.key in raw) {
      const v = raw[field.key];
      out[field.key] = field.type === 'number' ? Number(v) || 0 : v;
    }
  }
  return out;
}

/**
 * widget_trigger has no config schema — its config is {widgetId, widgetName}
 * referencing one of the USER'S OWN widgets. Validate the id against that set
 * (tenant isolation — the AI can never attach a widget the user doesn't own)
 * and take the authoritative name from the server-side record.
 */
function widgetTriggerConfig(
  raw: Record<string, unknown> | undefined,
  widgetById: Map<string, AiWidgetRef>,
): Record<string, unknown> {
  const id = raw && raw.widgetId != null ? String(raw.widgetId) : '';
  const w = id ? widgetById.get(id) : undefined;
  if (!w) {
    throw new AiOpError(
      id
        ? `Widget "${id}" isn't one of your widgets — pick one from your available widgets.`
        : 'A widget trigger needs one of your widgets, and none was available or specified.',
    );
  }
  return { widgetId: w.id, widgetName: w.name };
}

/**
 * Apply the model's ops to a copy of `graph`. Throws AiOpError on any invalid
 * reference or unknown type — the route turns that into a soft chat error
 * (no quota spent), never a corrupted graph.
 */
export function applyOps(graph: FlowGraph, ops: AiOp[], options: ApplyOptions = {}): ApplyResult {
  if (!Array.isArray(ops)) throw new AiOpError('The assistant returned no valid operations.');

  const nodes: FlowNode[] = (graph.nodes ?? []).map((n) => ({ ...n, data: { ...n.data, config: { ...n.data.config } } }));
  let edges: FlowEdge[] = [...(graph.edges ?? [])];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const widgetById = new Map((options.widgets ?? []).map((w) => [w.id, w]));
  const temp = new Map<string, string>(); // tempId → real id
  const changed = new Set<string>();

  // Resolve a node reference that may be an existing id or a tempId from this batch.
  const resolve = (ref: string): string => {
    if (temp.has(ref)) return temp.get(ref)!;
    if (byId.has(ref)) return ref;
    throw new AiOpError(`The assistant referenced an unknown node "${ref}".`);
  };

  for (const op of ops) {
    switch (op?.op) {
      case 'add_node': {
        const type = op.type as NodeType;
        if (!NODE_TEMPLATE_BY_TYPE[type]) throw new AiOpError(`Unknown node type "${op.type}".`);
        if (nodes.length >= MAX_NODES) throw new AiOpError(`Workflows are limited to ${MAX_NODES} nodes.`);
        const tpl = NODE_TEMPLATE_BY_TYPE[type];
        const id = uuid();
        const position = positionFor(op.after, temp, byId, nodes.length);
        const config =
          type === 'widget_trigger'
            ? widgetTriggerConfig(op.config, widgetById)
            : { ...defaultConfigFor(type), ...sanitizeConfig(type, op.config) };
        const node: FlowNode = {
          id,
          type: 'flowNode',
          position,
          data: {
            type,
            label: (op.label ?? tpl.label).toString().slice(0, 80),
            config,
          },
        };
        nodes.push(node);
        byId.set(id, node);
        if (op.tempId) temp.set(op.tempId, id);
        changed.add(id);
        // Auto-wire from `after` when it resolves to an existing/earlier node.
        if (op.after && (temp.has(op.after) || byId.has(op.after))) {
          const src = resolve(op.after);
          addEdge(edges, src, id, undefined);
        }
        break;
      }
      case 'update_node': {
        const id = resolve(op.nodeId);
        const node = byId.get(id)!;
        if (typeof op.label === 'string') node.data.label = op.label.slice(0, 80);
        if (op.config) {
          if (node.data.type === 'widget_trigger') {
            // Only re-point the widget if a widgetId was given; otherwise leave it.
            if (op.config.widgetId != null) node.data.config = widgetTriggerConfig(op.config, widgetById);
          } else {
            node.data.config = { ...node.data.config, ...sanitizeConfig(node.data.type, op.config) };
          }
        }
        changed.add(id);
        break;
      }
      case 'delete_node': {
        const id = resolve(op.nodeId);
        const idx = nodes.findIndex((n) => n.id === id);
        if (idx >= 0) nodes.splice(idx, 1);
        byId.delete(id);
        edges = edges.filter((e) => e.source !== id && e.target !== id);
        changed.delete(id);
        break;
      }
      case 'connect': {
        const source = resolve(op.source);
        const target = resolve(op.target);
        const handle = validHandle(byId.get(source)!, op.sourceHandle);
        addEdge(edges, source, target, handle);
        changed.add(target);
        break;
      }
      case 'disconnect': {
        const source = resolve(op.source);
        const target = resolve(op.target);
        edges = edges.filter((e) => !(e.source === source && e.target === target));
        break;
      }
      default:
        throw new AiOpError(`Unsupported operation "${(op as { op?: string })?.op ?? '?'}".`);
    }
  }

  if (nodes.length > MAX_NODES) throw new AiOpError(`Workflows are limited to ${MAX_NODES} nodes.`);

  return {
    graph: { nodes, edges },
    changedNodeIds: [...changed].filter((id) => byId.has(id)),
  };
}

/** Only condition nodes carry named handles; everything else uses the default. */
function validHandle(source: FlowNode, handle: string | undefined): string | null {
  const isCondition = NODE_TYPE_CATEGORY[source.data.type] === 'condition';
  if (!isCondition) return null;
  return handle === 'false' ? 'false' : 'true';
}

function addEdge(edges: FlowEdge[], source: string, target: string, sourceHandle: string | null | undefined): void {
  const exists = edges.some(
    (e) => e.source === source && e.target === target && (e.sourceHandle ?? null) === (sourceHandle ?? null),
  );
  if (exists) return;
  edges.push({ id: uuid(), source, target, sourceHandle: sourceHandle ?? null, targetHandle: null });
}

/** Place a new node below its `after` anchor, else lay out in a tidy column. */
function positionFor(
  after: string | undefined,
  temp: Map<string, string>,
  byId: Map<string, FlowNode>,
  count: number,
): { x: number; y: number } {
  const anchorId = after ? (temp.get(after) ?? (byId.has(after) ? after : undefined)) : undefined;
  const anchor = anchorId ? byId.get(anchorId) : undefined;
  if (anchor) return { x: anchor.position.x, y: anchor.position.y + 140 };
  return { x: 140, y: 60 + count * 140 };
}

export { isTriggerType };
