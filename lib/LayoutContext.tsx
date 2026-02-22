"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type WidgetId = "whale" | "news" | "top-tickers" | "largest-events" | "calendar" | "scanner";

export const ALL_WIDGET_IDS: WidgetId[] = ["top-tickers", "largest-events", "whale", "news", "calendar", "scanner"];
export const WIDGET_LABELS: Record<WidgetId, string> = {
  whale: "Whale Tracker",
  news: "News Stream",
  "top-tickers": "Top Tickers by Flow",
  "largest-events": "Largest Events Today",
  calendar: "Calendar",
  scanner: "Market Scanner",
};

/** Pixel-based layout for Fidelity-style free-form dashboard */
export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const STORAGE_KEY = "flow-terminal-layout";
const NOMINAL_WIDTH = 1200;
const NOMINAL_HEIGHT = 800;
const GRID_COL = 100;
const GRID_ROW = 80;

function gridToPx(w: number, h: number): { width: number; height: number } {
  return { width: w * GRID_COL, height: h * GRID_ROW };
}

const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: "top-tickers", x: 12, y: 12, ...gridToPx(5, 2) },
  { i: "largest-events", x: 12 + 5 * GRID_COL + 12, y: 12, ...gridToPx(5, 2) },
  { i: "whale", x: 12, y: 12 + 2 * GRID_ROW + 12, ...gridToPx(12, 4) },
  { i: "news", x: 12, y: 12 + 6 * GRID_ROW + 12, ...gridToPx(12, 4) },
  { i: "calendar", x: 12, y: 12 + 10 * GRID_ROW + 12, ...gridToPx(6, 2) },
];

export const LAYOUT_PRESETS: { name: string; layout: LayoutItem[] }[] = [
  { name: "Default", layout: [...DEFAULT_LAYOUT] },
  {
    name: "Flow-focused",
    layout: [
      { i: "whale", x: 12, y: 12, width: 780, height: 380 },
      { i: "largest-events", x: 804, y: 12, width: 384, height: 380 },
      { i: "news", x: 12, y: 404, width: 576, height: 280 },
      { i: "calendar", x: 600, y: 404, width: 588, height: 280 },
    ],
  },
  {
    name: "Research",
    layout: [
      { i: "top-tickers", x: 12, y: 12, width: 384, height: 160 },
      { i: "news", x: 408, y: 12, width: 780, height: 160 },
      { i: "whale", x: 12, y: 184, width: 1176, height: 380 },
      { i: "scanner", x: 12, y: 576, width: 576, height: 200 },
      { i: "calendar", x: 600, y: 576, width: 588, height: 200 },
    ],
  },
  {
    name: "Compact",
    layout: [
      { i: "top-tickers", x: 12, y: 12, width: 384, height: 160 },
      { i: "largest-events", x: 408, y: 12, width: 384, height: 160 },
      { i: "scanner", x: 804, y: 12, width: 384, height: 160 },
      { i: "whale", x: 12, y: 184, width: 780, height: 320 },
      { i: "news", x: 804, y: 184, width: 384, height: 320 },
      { i: "calendar", x: 12, y: 516, width: 1176, height: 160 },
    ],
  },
];

interface LayoutContextType {
  layout: LayoutItem[];
  setLayout: (layout: LayoutItem[]) => void;
  updateItem: (id: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  addWidget: (id: WidgetId) => void;
  removeWidget: (id: WidgetId) => void;
  hasWidget: (id: WidgetId) => boolean;
  availableWidgets: WidgetId[];
  applyPreset: (name: string) => void;
}

const LayoutContext = createContext<LayoutContextType | null>(null);

/** Migrate old grid format (w, h) to pixel format (width, height) */
function migrateItem(item: Record<string, unknown>): LayoutItem {
  const i = String(item.i);
  const x = Number(item.x ?? 0);
  const y = Number(item.y ?? 0);
  const w = Number((item as { w?: number }).w);
  const h = Number((item as { h?: number }).h);
  const width = Number((item as { width?: number }).width);
  const height = Number((item as { height?: number }).height);
  if (typeof w === "number" && !Number.isNaN(w) && typeof h === "number" && !Number.isNaN(h)) {
    const px = gridToPx(w, h);
    return { i, x: x * GRID_COL, y: y * GRID_ROW, width: px.width, height: px.height };
  }
  return {
    i,
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    width: Number.isFinite(width) ? width : 320,
    height: Number.isFinite(height) ? height : 200,
  };
}

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [layout, setLayoutState] = useState<LayoutItem[]>(DEFAULT_LAYOUT);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, unknown>[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLayoutState(parsed.map(migrateItem));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const setLayout = useCallback((newLayout: LayoutItem[]) => {
    setLayoutState(newLayout);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout));
    } catch {
      // ignore
    }
  }, []);

  const updateItem = useCallback(
    (id: string, bounds: { x: number; y: number; width: number; height: number }) => {
      setLayoutState((prev) => {
        const next = prev.map((item) =>
          item.i === id ? { ...item, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : item
        );
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    []
  );

  const activeIds = layout.map((l) => l.i as WidgetId);
  const availableWidgets = ALL_WIDGET_IDS.filter((id) => !activeIds.includes(id));

  const addWidget = useCallback(
    (id: WidgetId) => {
      if (layout.some((l) => l.i === id)) return;
      const maxBottom = layout.length === 0 ? 0 : Math.max(...layout.map((l) => l.y + l.height));
      setLayout([...layout, { i: id, x: 24, y: maxBottom + 12, width: 480, height: 280 }]);
    },
    [layout, setLayout]
  );

  const removeWidget = useCallback(
    (id: WidgetId) => {
      setLayout(layout.filter((l) => l.i !== id));
    },
    [layout, setLayout]
  );

  const hasWidget = useCallback((id: WidgetId) => layout.some((l) => l.i === id), [layout]);

  const applyPreset = useCallback(
    (name: string) => {
      const preset = LAYOUT_PRESETS.find((p) => p.name === name);
      if (preset) setLayout(preset.layout.map((item) => ({ ...item })));
    },
    [setLayout]
  );

  return (
    <LayoutContext.Provider
      value={{ layout, setLayout, updateItem, addWidget, removeWidget, hasWidget, availableWidgets, applyPreset }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within LayoutProvider");
  return ctx;
}
