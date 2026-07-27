'use client';

import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import {
  NODE_TEMPLATE_BY_TYPE,
  NODE_TYPE_CATEGORY,
  type FlowNodeData,
} from '@flowcraft/shared-types';
import { categoryColor } from '@/config/app.config';

export type FcNode = Node<FlowNodeData, 'flowNode'>;

/**
 * The one custom React Flow node type. Header color encodes the node category;
 * condition nodes expose two source handles (true / false) for branching.
 */
export function FlowNodeView({ data, selected }: NodeProps<FcNode>) {
  const tpl = NODE_TEMPLATE_BY_TYPE[data.type];
  const category = NODE_TYPE_CATEGORY[data.type];
  const color = categoryColor[category];
  const isTrigger = category === 'trigger';
  const isCondition = category === 'condition';

  return (
    <div className={`fc-node ${selected ? 'selected' : ''}`}>
      {!isTrigger && <Handle type="target" position={Position.Top} />}

      <div className="fc-node__head" style={{ background: color }}>
        <span>{tpl.icon}</span>
        <span className="truncate">{data.label || tpl.label}</span>
      </div>
      <div className="fc-node__body">{summarize(data)}</div>

      {isCondition ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Bottom}
            style={{ left: '30%', background: '#10b981' }}
          />
          <Handle
            id="false"
            type="source"
            position={Position.Bottom}
            style={{ left: '70%', background: '#ef4444' }}
          />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} />
      )}
    </div>
  );
}

function summarize(data: FlowNodeData): string {
  const c = data.config;
  switch (data.type) {
    case 'delay':
      return `wait ${c.amount ?? '?'}${c.unit ?? 'm'}`;
    case 'send_slack':
      return `→ ${str(c.channel) || '#channel'}`;
    case 'send_email':
      return `→ ${str(c.to) || 'recipient'}`;
    case 'http_request':
      return `${str(c.method) || 'GET'} ${truncate(str(c.url) || 'url…')}`;
    case 'condition':
      return `${str(c.left) || '?'} ${op(str(c.operator))} ${str(c.right) || '?'}`;
    case 'widget_trigger':
      return `on submit · ${str(c.widgetName) || 'widget'}`;
    default:
      return NODE_TEMPLATE_BY_TYPE[data.type].description;
  }
}

const op = (o: string) =>
  ({ eq: '=', neq: '≠', gt: '>', lt: '<', contains: '⊃' })[o] ?? o;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const truncate = (s: string) => (s.length > 22 ? s.slice(0, 22) + '…' : s);
