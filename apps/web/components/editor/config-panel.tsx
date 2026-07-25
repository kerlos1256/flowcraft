'use client';

import { NODE_TEMPLATE_BY_TYPE, type ConfigField, type FlowNodeData } from '@flowcraft/shared-types';
import type { FcNode } from './flow-node';

interface Props {
  node: FcNode;
  onChange: (patch: Partial<FlowNodeData>) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Right side panel: a form generated from the node type's config schema (spec §4 Phase 1.4). */
export function ConfigPanel({ node, onChange, onDelete, onClose }: Props) {
  const tpl = NODE_TEMPLATE_BY_TYPE[node.data.type];

  const setField = (key: string, value: unknown) =>
    onChange({ config: { ...node.data.config, [key]: value } });

  return (
    <div className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{tpl.icon}</span>
          <span className="font-semibold">{tpl.label}</span>
        </div>
        <button className="btn btn-sm" onClick={onClose}>
          ✕
        </button>
      </div>
      <p className="text-xs text-muted">{tpl.description}</p>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted">Label</span>
        <input
          className="input"
          value={node.data.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </label>

      {tpl.configSchema.length === 0 ? (
        <p className="text-xs text-muted">This node has no configuration.</p>
      ) : (
        tpl.configSchema.map((field) => (
          <Field
            key={field.key}
            field={field}
            value={node.data.config[field.key]}
            onChange={(v) => setField(field.key, v)}
          />
        ))
      )}

      <button className="btn btn-sm mt-2" onClick={onDelete}>
        🗑 Delete node
      </button>
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const v = value ?? '';
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </span>
      {field.type === 'textarea' ? (
        <textarea
          className="textarea"
          value={String(v)}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === 'select' ? (
        <select className="select" value={String(v)} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === 'number' ? (
        <input
          className="input"
          type="number"
          value={v === '' ? '' : Number(v)}
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      ) : (
        <input
          className="input"
          value={String(v)}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.help && <span className="text-[11px] text-muted">{field.help}</span>}
    </label>
  );
}
