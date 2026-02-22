"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";
import { useLayout, type LayoutItem, type WidgetId, WIDGET_LABELS, LAYOUT_PRESETS } from "@/lib/LayoutContext";
import WidgetShell from "@/components/WidgetShell";
import WhaleWidget from "@/components/widgets/WhaleWidget";
import NewsWidget from "@/components/widgets/NewsWidget";
import TopTickersWidget from "@/components/widgets/TopTickersWidget";
import LargestEventsWidget from "@/components/widgets/LargestEventsWidget";
import CalendarWidget from "@/components/widgets/CalendarWidget";
import ScannerWidget from "@/components/widgets/ScannerWidget";

const WIDGET_CONTENT: Record<WidgetId, React.ReactNode> = {
  whale: <WhaleWidget />,
  news: <NewsWidget />,
  "top-tickers": <TopTickersWidget />,
  "largest-events": <LargestEventsWidget />,
  calendar: <CalendarWidget />,
  scanner: <ScannerWidget />,
};

const MIN_WIDTH = 280;
const MIN_HEIGHT = 160;

export default function TerminalDashboard() {
  const { layout, updateItem, removeWidget, addWidget, availableWidgets, applyPreset } = useLayout();
  const [frontId, setFrontId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDragStop = useCallback(
    (id: string) => (_e: unknown, d: { x: number; y: number }) => {
      const item = layout.find((l) => l.i === id);
      if (!item) return;
      updateItem(id, { ...item, x: d.x, y: d.y, width: item.width, height: item.height });
    },
    [layout, updateItem]
  );

  const handleResizeStop = useCallback(
    (id: string) => (
      _e: unknown,
      _dir: unknown,
      ref: HTMLElement,
      _delta: { width: number; height: number },
      pos: { x: number; y: number }
    ) => {
      const item = layout.find((l) => l.i === id);
      if (!item) return;
      const width = Math.max(MIN_WIDTH, ref.offsetWidth);
      const height = Math.max(MIN_HEIGHT, ref.offsetHeight);
      updateItem(id, { ...item, x: pos.x, y: pos.y, width, height });
    },
    [layout, updateItem]
  );

  const bringToFront = useCallback((id: string) => setFrontId(id), []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="relative" ref={addMenuRef}>
            <button
              type="button"
              onClick={() => setAddMenuOpen(!addMenuOpen)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground/90 hover:bg-border/50 hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add widget
            </button>
            {addMenuOpen && (
              <div className="absolute left-0 top-full z-[100] mt-1 min-w-[200px] rounded-md border border-border bg-card py-1 shadow-xl">
                {availableWidgets.length === 0 ? (
                  <div className="px-4 py-3 text-center text-sm text-foreground/50">All widgets added</div>
                ) : (
                  availableWidgets.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        addWidget(id);
                        setAddMenuOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-accent-muted/50 hover:text-accent"
                    >
                      {WIDGET_LABELS[id]}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <select
            onChange={(e) => applyPreset(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground/90 focus:border-accent/50 focus:outline-none"
            defaultValue=""
          >
            <option value="" disabled>Layout presets</option>
            {LAYOUT_PRESETS.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-foreground/50">
          Drag header to move · Resize from edges or corners · Click widget to bring to front
        </p>
      </div>

      <div className="flex-1 min-h-[420px] overflow-auto rounded-lg border border-border bg-background/50">
        <div
          ref={containerRef}
          className="relative h-full min-h-[600px] min-w-[1100px]"
          style={{ width: "max(100%, 1100px)", minHeight: "max(600px, 100%)" }}
        >
        {layout.map((item) => {
          const content = WIDGET_CONTENT[item.i as WidgetId];
          const title = WIDGET_LABELS[item.i as WidgetId];
          if (!content || !title) return null;
          const isFront = frontId === item.i;
          return (
            <Rnd
              key={item.i}
              position={{ x: item.x, y: item.y }}
              size={{ width: item.width, height: item.height }}
              minWidth={MIN_WIDTH}
              minHeight={MIN_HEIGHT}
              bounds="parent"
              dragHandleClassName="widget-drag-handle"
              enableResizing={{ bottom: true, bottomRight: true, right: true, bottomLeft: true, left: true, top: true, topRight: true, topLeft: true }}
              onDragStop={handleDragStop(item.i)}
              onResizeStop={handleResizeStop(item.i)}
              onMouseDown={() => bringToFront(item.i)}
              style={{ zIndex: isFront ? 50 : 10 }}
              className="!rounded-lg"
            >
              <WidgetShell
                id={item.i}
                title={title}
                onRemove={() => removeWidget(item.i as WidgetId)}
                dragHandleClassName="widget-drag-handle"
              >
                {content}
              </WidgetShell>
            </Rnd>
          );
        })}
        </div>
      </div>
    </div>
  );
}
