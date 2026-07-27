'use client';

import { WIDGET_PRESETS, type WidgetType } from '@/lib/widgets';
import type { NodeTemplateDto, NodeCategory } from '@flowcraft/shared-types';
import { categoryColor } from '@/config/app.config';

const CATEGORY_ORDER: NodeCategory[] = ['trigger', 'action', 'delay', 'condition'];
const CATEGORY_LABEL: Record<NodeCategory, string> = {
  trigger: 'Triggers',
  action: 'Actions',
  delay: 'Delay',
  condition: 'Logic',
};

export interface PaletteWidget {
  id: string;
  name: string;
  type: WidgetType;
}

/** Left sidebar. Drag a template (or a widget trigger) onto the canvas. */
export function Palette({
  templates,
  widgets,
  onNewWidget,
}: {
  templates: NodeTemplateDto[];
  widgets: PaletteWidget[];
  onNewWidget: () => void;
}) {
  return (
    <div className="flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Node palette</p>

      {CATEGORY_ORDER.map((cat) => {
        // widget_trigger is added via the dedicated "Your widgets" section below.
        const items = templates.filter((t) => t.category === cat && t.type !== 'widget_trigger');
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
                <span className="grid h-6 w-6 place-items-center rounded" style={{ background: categoryColor[cat] }}>
                  {t.icon}
                </span>
                <span className="font-medium">{t.label}</span>
              </div>
            ))}
          </div>
        );
      })}

      {/* Your widgets — drag one on to start the flow from a widget submission. */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-medium text-muted">Your widgets</p>
        {widgets.map((w) => (
          <div
            key={w.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/flowcraft-widget', JSON.stringify({ id: w.id, name: w.name }));
              e.dataTransfer.effectAllowed = 'move';
            }}
            className="flex cursor-grab items-center gap-2 rounded-md border border-dashed border-border bg-surface-muted px-2.5 py-2 text-xs active:cursor-grabbing"
            title={`Trigger this workflow when “${w.name}” is submitted`}
          >
            <span className="grid h-6 w-6 place-items-center rounded" style={{ background: categoryColor.trigger }}>
              {WIDGET_PRESETS[w.type].icon}
            </span>
            <span className="truncate font-medium">{w.name}</span>
          </div>
        ))}
        {widgets.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-2.5 py-2 text-[11px] text-muted">
            No widgets yet.
          </p>
        )}
        <button
          onClick={onNewWidget}
          className="mt-1 rounded-md border border-border px-2.5 py-2 text-xs font-medium hover:border-primary hover:text-primary"
        >
          + New widget
        </button>
      </div>

      <p className="mt-auto text-[11px] leading-relaxed text-muted">
        Drag onto the canvas, connect nodes, then <b>Save</b> and <b>Run</b>.
      </p>
    </div>
  );
}
