// The serialized graph — mirrors React Flow's `{ nodes, edges }` shape so the
// canvas can round-trip straight to/from the workflows.graph jsonb column.

import type { NodeType } from './enums';

export interface XYPosition {
  x: number;
  y: number;
}

/**
 * Per-node data: the node's configured type + its config field values.
 * Extends `Record<string, unknown>` so it satisfies React Flow v12's `Node<T>`
 * data constraint while keeping the known fields strongly typed.
 */
export interface FlowNodeData extends Record<string, unknown> {
  type: NodeType;
  /** Human label shown on the node (defaults to the template label). */
  label: string;
  /** Values for the node type's config schema fields, keyed by field key. */
  config: Record<string, unknown>;
}

export interface FlowNode {
  id: string;
  /** React Flow node component key — we use one custom type: "flowNode". */
  type: 'flowNode';
  position: XYPosition;
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  /** For condition nodes: 'true' | 'false' — which branch this edge represents. */
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** Exactly what we persist to workflows.graph. */
export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export const emptyGraph = (): FlowGraph => ({ nodes: [], edges: [] });
