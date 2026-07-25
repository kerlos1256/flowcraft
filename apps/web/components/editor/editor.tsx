'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import {
  NODE_TEMPLATE_BY_TYPE,
  defaultConfigFor,
  type FlowGraph,
  type FlowNodeData,
  type NodeType,
  type NodeTemplateDto,
  type WorkflowDto,
  type WorkflowRunDto,
  type WorkflowStatus,
} from '@flowcraft/shared-types';
import { runStatusColor } from '@/config/app.config';
import { updateWorkflow, runWorkflow, listRuns } from '@/lib/api';
import { FlowNodeView, type FcNode } from './flow-node';
import { Palette } from './palette';
import { ConfigPanel } from './config-panel';

export function Editor({
  workflow,
  templates,
  initialRuns,
}: {
  workflow: WorkflowDto;
  templates: NodeTemplateDto[];
  initialRuns: WorkflowRunDto[];
}) {
  return (
    <ReactFlowProvider>
      <EditorInner workflow={workflow} templates={templates} initialRuns={initialRuns} />
    </ReactFlowProvider>
  );
}

function EditorInner({
  workflow,
  templates,
  initialRuns,
}: {
  workflow: WorkflowDto;
  templates: NodeTemplateDto[];
  initialRuns: WorkflowRunDto[];
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FcNode>(
    workflow.graph.nodes as FcNode[],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(workflow.graph.edges as Edge[]);
  const [name, setName] = useState(workflow.name);
  const [status, setStatus] = useState<WorkflowStatus>(workflow.status);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runs, setRuns] = useState(initialRuns);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { screenToFlowPosition } = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const nodeTypes = useMemo(() => ({ flowNode: FlowNodeView }), []);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/flowcraft-node') as NodeType;
      if (!type || !NODE_TEMPLATE_BY_TYPE[type]) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const tpl = NODE_TEMPLATE_BY_TYPE[type];
      const newNode: FcNode = {
        id: crypto.randomUUID(),
        type: 'flowNode',
        position,
        data: { type, label: tpl.label, config: defaultConfigFor(type) },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes],
  );

  const patchSelected = useCallback(
    (patch: Partial<FlowNodeData>) => {
      if (!selectedId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      );
    },
    [selectedId, setNodes],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }, [selectedId, setNodes, setEdges]);

  function serialize(): FlowGraph {
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: 'flowNode',
        position: n.position,
        data: n.data,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
      })),
    };
  }

  async function save(): Promise<void> {
    setSaving(true);
    setMessage(null);
    try {
      await updateWorkflow(workflow.id, { name, status, graph: serialize() });
      setMessage('Saved ✓');
    } catch (e) {
      setMessage(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function refreshRuns(): Promise<void> {
    setRuns(await listRuns(workflow.id));
  }

  async function runNow(): Promise<void> {
    await save();
    setMessage('Run started — executing durably via Inngest…');
    await runWorkflow(workflow.id);
    // Poll a few times so status transitions are visible without a manual refresh.
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      await refreshRuns();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Workflows
        </Link>
        <input
          className="input max-w-xs"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Workflow name"
        />
        <select
          className="select max-w-[140px]"
          value={status}
          onChange={(e) => setStatus(e.target.value as WorkflowStatus)}
          aria-label="Status"
        >
          <option value="draft">draft</option>
          <option value="active">active (cron)</option>
          <option value="paused">paused</option>
        </select>
        <button className="btn" onClick={save} disabled={saving}>
          Save
        </button>
        <button className="btn btn-primary" onClick={runNow} disabled={saving}>
          ▶ Run Now
        </button>
        {message && <span className="text-xs text-muted">{message}</span>}
      </div>

      {/* Editor surface */}
      <div
        className="flex h-[68vh] overflow-hidden rounded-lg border border-border bg-surface"
        ref={wrapper}
      >
        <Palette templates={templates} />

        <div className="relative flex-1" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        {selectedNode ? (
          <ConfigPanel
            node={selectedNode}
            onChange={patchSelected}
            onDelete={deleteSelected}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <RunsPanel runs={runs} onRefresh={refreshRuns} />
        )}
      </div>
    </div>
  );
}

function RunsPanel({
  runs,
  onRefresh,
}: {
  runs: WorkflowRunDto[];
  onRefresh: () => void;
}) {
  return (
    <div className="flex w-80 shrink-0 flex-col gap-2 overflow-y-auto border-l border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Run history</p>
        <button className="btn btn-sm" onClick={onRefresh}>
          ⟳
        </button>
      </div>
      {runs.length === 0 ? (
        <p className="text-xs text-muted">No runs yet. Hit “Run Now”.</p>
      ) : (
        runs.map((r) => (
          <Link
            key={r.id}
            href={`/runs/${r.id}`}
            className="rounded-md border border-border bg-surface-muted p-2.5 text-xs hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <span
                className="font-semibold"
                style={{ color: runStatusColor[r.status] }}
              >
                {r.status}
              </span>
              <span className="text-muted">{r.triggeredBy}</span>
            </div>
            <div className="mt-1 text-muted">{new Date(r.startedAt).toLocaleTimeString()}</div>
          </Link>
        ))
      )}
    </div>
  );
}
