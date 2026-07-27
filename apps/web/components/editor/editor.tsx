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
import { updateWorkflow, runWorkflow, listRuns, createWidgetApi } from '@/lib/api';
import { WIDGET_PRESETS, WIDGET_TYPES, type WidgetType } from '@/lib/widgets';
import { Modal } from '@/components/ui/modal';
import { FlowNodeView, type FcNode } from './flow-node';
import { Palette, type PaletteWidget } from './palette';
import { ConfigPanel } from './config-panel';

interface EditorProps {
  workflow: WorkflowDto;
  templates: NodeTemplateDto[];
  initialRuns: WorkflowRunDto[];
  widgets: PaletteWidget[];
}

export function Editor(props: EditorProps) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}

function EditorInner({ workflow, templates, initialRuns, widgets: widgetsProp }: EditorProps) {
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

  // Widgets available to drop as trigger nodes (kept in local state so creating
  // one from the canvas doesn't require a page refresh that would drop edits).
  const [widgets, setWidgets] = useState<PaletteWidget[]>(widgetsProp);
  const [newWidgetOpen, setNewWidgetOpen] = useState(false);
  const [nwName, setNwName] = useState('Contact form');
  const [nwType, setNwType] = useState<WidgetType>('form');
  const [nwBusy, setNwBusy] = useState(false);
  const [nwErr, setNwErr] = useState<string | null>(null);

  const { screenToFlowPosition } = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const nodeTypes = useMemo(() => ({ flowNode: FlowNodeView }), []);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges],
  );

  const addWidgetTriggerNode = useCallback(
    (widget: { id: string; name: string }, pos?: { x: number; y: number }) => {
      const position = pos ?? { x: 120, y: 60 };
      const node: FcNode = {
        id: crypto.randomUUID(),
        type: 'flowNode',
        position,
        data: {
          type: 'widget_trigger',
          label: widget.name,
          config: { widgetId: widget.id, widgetName: widget.name },
        },
      };
      setNodes((nds) => [...nds, node]);
    },
    [setNodes],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      // A widget dragged from the "Your widgets" palette section → widget_trigger.
      const widgetRaw = event.dataTransfer.getData('application/flowcraft-widget');
      if (widgetRaw) {
        try {
          const w = JSON.parse(widgetRaw) as { id: string; name: string };
          addWidgetTriggerNode(w, position);
        } catch {
          /* ignore */
        }
        return;
      }

      const type = event.dataTransfer.getData('application/flowcraft-node') as NodeType;
      if (!type || !NODE_TEMPLATE_BY_TYPE[type]) return;
      const tpl = NODE_TEMPLATE_BY_TYPE[type];
      const newNode: FcNode = {
        id: crypto.randomUUID(),
        type: 'flowNode',
        position,
        data: { type, label: tpl.label, config: defaultConfigFor(type) },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes, addWidgetTriggerNode],
  );

  async function createWidgetFromCanvas() {
    setNwBusy(true);
    setNwErr(null);
    try {
      // Link the new widget to THIS workflow, then drop its trigger onto the canvas.
      const w = await createWidgetApi(nwName.trim() || WIDGET_PRESETS[nwType].label, nwType, workflow.id);
      setWidgets((xs) => [{ id: w.id, name: w.name, type: w.type }, ...xs]);
      addWidgetTriggerNode({ id: w.id, name: w.name });
      setNewWidgetOpen(false);
    } catch (e) {
      setNwErr((e as Error).message);
    } finally {
      setNwBusy(false);
    }
  }

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
        <Link href="/app" className="text-sm text-muted hover:text-foreground">
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
        <Palette templates={templates} widgets={widgets} onNewWidget={() => setNewWidgetOpen(true)} />

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

      {/* Create a widget from the canvas — linked to this workflow. */}
      <Modal
        open={newWidgetOpen}
        onClose={() => !nwBusy && setNewWidgetOpen(false)}
        title="New widget"
        description="It’ll be linked to this workflow and added as a trigger."
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            {WIDGET_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setNwType(t);
                  setNwName(WIDGET_PRESETS[t].label);
                }}
                className={`flex items-center gap-3 rounded-lg border p-2.5 text-left ${
                  nwType === t ? 'border-primary bg-surface-muted' : 'border-border'
                }`}
              >
                <span className="text-lg">{WIDGET_PRESETS[t].icon}</span>
                <div>
                  <div className="text-sm font-medium">{WIDGET_PRESETS[t].label}</div>
                  <div className="text-[11px] text-muted">{WIDGET_PRESETS[t].blurb}</div>
                </div>
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Widget name
            <input
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              value={nwName}
              onChange={(e) => setNwName(e.target.value)}
            />
          </label>
          {nwErr && <p className="text-sm text-red-500">{nwErr}</p>}
          <div className="flex justify-end gap-2">
            <button
              className="rounded-md border border-border px-3.5 py-2 text-sm hover:bg-surface-muted"
              onClick={() => setNewWidgetOpen(false)}
              disabled={nwBusy}
            >
              Cancel
            </button>
            <button
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              onClick={createWidgetFromCanvas}
              disabled={nwBusy}
            >
              {nwBusy ? 'Creating…' : 'Create & add'}
            </button>
          </div>
        </div>
      </Modal>
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
