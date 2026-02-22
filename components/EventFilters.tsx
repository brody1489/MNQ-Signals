"use client";

import type { EventType } from "@/lib/mock-data";

export interface EventFiltersState {
  types: EventType[];
  minSize: number;
  minSizeCustom: string; // for typable input, e.g. "450500"
  timeRange: "today" | "week" | "all";
}

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "options", label: "Options" },
  { value: "dark_pool", label: "Dark Pool" },
  { value: "ceo", label: "CEO" },
  { value: "congress", label: "Congress" },
];

const MIN_SIZE_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 100_000, label: "$100K+" },
  { value: 500_000, label: "$500K+" },
  { value: 1_000_000, label: "$1M+" },
  { value: 5_000_000, label: "$5M+" },
  { value: 10_000_000, label: "$10M+" },
];

const CUSTOM_VALUE = -1;

interface EventFiltersProps {
  filters: EventFiltersState;
  onChange: (f: EventFiltersState) => void;
}

export function getDefaultFilters(): EventFiltersState {
  return {
    types: ["options", "dark_pool", "ceo", "congress"],
    minSize: 0,
    minSizeCustom: "",
    timeRange: "all",
  };
}

export function filterEvents<T extends { type: EventType; sizeUsd: number; timestamp: string }>(
  events: T[],
  filters: EventFiltersState
): T[] {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const minSize = filters.minSizeCustom.trim()
    ? parseFloat(filters.minSizeCustom.replace(/[^0-9.]/g, "")) || 0
    : filters.minSize;

  return events.filter((e) => {
    if (filters.types.length > 0 && !filters.types.includes(e.type)) return false;
    if (e.sizeUsd < minSize) return false;
    if (filters.timeRange === "today" && new Date(e.timestamp) < todayStart) return false;
    if (filters.timeRange === "week" && new Date(e.timestamp) < weekStart) return false;
    return true;
  });
}

export default function EventFilters({ filters, onChange }: EventFiltersProps) {
  const toggleType = (t: EventType) => {
    const next = filters.types.includes(t)
      ? filters.types.filter((x) => x !== t)
      : [...filters.types, t];
    onChange({ ...filters, types: next });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card/80 px-4 py-2.5 text-sm">
      <span className="text-foreground/60">Type:</span>
      <div className="flex gap-1">
        {EVENT_TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => toggleType(value)}
            className={`rounded border px-2.5 py-1 ${
              filters.types.includes(value)
                ? "border-accent bg-accent-muted text-accent"
                : "border-border bg-card/50 text-foreground/80 hover:border-foreground/30"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <span className="text-foreground/60">Min size:</span>
      <div className="flex items-center gap-1">
        <select
          value={filters.minSizeCustom ? CUSTOM_VALUE : filters.minSize}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v === CUSTOM_VALUE) {
              onChange({ ...filters, minSize: 0, minSizeCustom: filters.minSizeCustom || "100000" });
            } else {
              onChange({ ...filters, minSize: v, minSizeCustom: "" });
            }
          }}
          className="rounded border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus:border-accent/50 focus:outline-none min-w-[100px]"
        >
          {MIN_SIZE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value={CUSTOM_VALUE}>Custom…</option>
        </select>
        {filters.minSizeCustom && (
          <input
            type="text"
            placeholder="Amount"
            value={filters.minSizeCustom}
            onChange={(e) => onChange({ ...filters, minSizeCustom: e.target.value })}
            className="w-20 rounded border border-border bg-card px-2 py-1.5 font-mono text-sm text-foreground placeholder:text-foreground/40 focus:border-accent/50 focus:outline-none"
          />
        )}
      </div>
      <span className="text-foreground/60">Range:</span>
      <div className="flex gap-1">
        {(["today", "week", "all"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange({ ...filters, timeRange: r })}
            className={`rounded border px-2.5 py-1 capitalize ${
              filters.timeRange === r
                ? "border-accent bg-accent-muted text-accent"
                : "border-border bg-card/50 text-foreground/80 hover:border-foreground/30"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
