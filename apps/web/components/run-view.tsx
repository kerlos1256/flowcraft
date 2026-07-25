'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react';
import {
  NODE_TEMPLATE_BY_TYPE,
  type RunDetailDto,
  type RunStepDto,
  type StepStatus,
} from '@flowcraft/shared-types';
import { runStatusColor, stepStatusColor } from '@/config/app.config';
import { FlowNodeView, type FcNode } from '@/components/editor/flow-node';

export function RunView({ run }: { run: RunDetailDto }) {
  const [highlight, setHighlight] = useState<string | null>(null);
  const stepByNode = useMemo(
    () => new Map(run.steps.map((s) => [s.nodeId, s])),
    [run.steps],
  );

  const nodeTypes = useMemo(() => ({ flowNode: FlowNodeView }), []);

  const nodes = useMemo<Node[]>(
    () =>
      run.graph.nodes.map((n) => {
        const status = stepByNode.get(n.id)?.status;
        const color = status ? stepStatusColor[status] : 'var(--border)';
        const isHi = highlight === n.id;
        return {
          ...(n as unknown as FcNode),
          draggable: false,
          selectable: true,
          style: {
            outline: `${isHi ? 3 : 2}px solid ${color}`,
            outlineOffset: 2,
            borderRadius: 8,
            boxShadow: isHi ? `0 0 0 4px color-mix(in srgb, ${color} 30%, transparent)` : undefined,
          },
        };
      }),
    [run.graph.nodes, stepByNode, highlight],
  );
  const edges = run.graph.edges as Edge[];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/workflows/${run.workflowId}`} className="text-sm text-muted hover:text-foreground">
          ← {run.workflowName}
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-xl font-semibold">Run</h1>
          <span
            className="rounded-sm px-2 py-0.5 text-xs font-semibold"
            style={{ color: runStatusColor[run.status], border: `1px solid ${runStatusColor[run.status]}` }}
          >
            {run.status}
          </span>
          <span className="text-xs text-muted">
            {run.triggeredBy} · started {new Date(run.startedAt).toLocaleTimeString()}
            {run.completedAt && ` · finished ${new Date(run.completedAt).toLocaleTimeString()}`}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="h-[60vh] overflow-hidden rounded-lg border border-border bg-surface">
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, n) => setHighlight(n.id)}
              nodesConnectable={false}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Step timeline</p>
          {run.steps.length === 0 ? (
            <p className="text-xs text-muted">No steps recorded yet — refresh in a moment.</p>
          ) : (
            run.steps.map((s) => (
              <StepRow
                key={s.id}
                step={s}
                label={labelFor(run, s.nodeId)}
                active={highlight === s.nodeId}
                onClick={() => setHighlight(s.nodeId)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StepRow({
  step,
  label,
  active,
  onClick,
}: {
  step: RunStepDto;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const color = stepStatusColor[step.status as StepStatus];
  return (
    <button
      onClick={onClick}
      className="rounded-md border bg-surface p-2.5 text-left text-xs transition-colors"
      style={{ borderColor: active ? color : 'var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className="font-semibold" style={{ color }}>
          {step.status}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-muted">
        <span className="font-mono">{step.stepType}</span>
        {step.attempts > 1 && (
          <span className="rounded-sm bg-surface-muted px-1.5 py-0.5" style={{ color }}>
            {step.attempts} attempts (retried)
          </span>
        )}
      </div>
      {step.error && <div className="mt-1 text-red-500">⚠ {step.error}</div>}
      {step.output && (
        <pre className="mt-1 overflow-x-auto rounded bg-surface-muted p-1.5 font-mono text-[11px] text-muted">
          {JSON.stringify(step.output)}
        </pre>
      )}
    </button>
  );
}

function labelFor(run: RunDetailDto, nodeId: string): string {
  const node = run.graph.nodes.find((n) => n.id === nodeId);
  if (!node) return nodeId;
  return `${NODE_TEMPLATE_BY_TYPE[node.data.type].icon} ${node.data.label}`;
}
