'use client';

import type { NodeTemplateDto, NodeCategory } from '@flowcraft/shared-types';
import { categoryColor } from '@/config/app.config';

const CATEGORY_ORDER: NodeCategory[] = ['trigger', 'action', 'delay', 'condition'];
const CATEGORY_LABEL: Record<NodeCategory, string> = {
  trigger: 'Triggers',
  action: 'Actions',
  delay: 'Delay',
  condition: 'Logic',
};

/** Left sidebar. Drag a template onto the canvas to add a node (HTML5 DnD). */
export function Palette({ templates }: { templates: NodeTemplateDto[] }) {
  return (
    <div className="flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Node palette</p>
      {CATEGORY_ORDER.map((cat) => {
        const items = templates.filter((t) => t.category === cat);
        if (!items.length) return null;
        return (
          <div key={cat} className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium text-muted">{CATEGORY_LABEL[cat]}</p>
            {items.map((t) => (
              <div
                key={t.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/flowcraft-node', t.type);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className="flex cursor-grab items-center gap-2 rounded-md border border-border bg-surface-muted px-2.5 py-2 text-xs active:cursor-grabbing"
                title={t.description}
              >
                <span
                  className="grid h-6 w-6 place-items-center rounded"
                  style={{ background: categoryColor[cat] }}
                >
                  {t.icon}
                </span>
                <span className="font-medium">{t.label}</span>
              </div>
            ))}
          </div>
        );
      })}
      <p className="mt-auto text-[11px] leading-relaxed text-muted">
        Drag onto the canvas, connect nodes, then <b>Save</b> and <b>Run</b>.
      </p>
    </div>
  );
}
