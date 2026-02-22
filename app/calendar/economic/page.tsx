"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

// Mock economic events + market holidays
const ECONOMIC_EVENTS = [
  { id: "e1", date: "2025-02-12", time: "8:30 AM ET", event: "CPI (Consumer Price Index)", impact: "high" as const },
  { id: "e2", date: "2025-02-13", time: "2:00 PM ET", event: "FOMC Rate Decision", impact: "high" as const },
  { id: "e3", date: "2025-02-14", time: "8:30 AM ET", event: "Retail Sales", impact: "medium" as const },
  { id: "e4", date: "2025-02-18", time: "", event: "Presidents Day — Market Closed", impact: null as string | null },
  { id: "e5", date: "2025-02-20", time: "10:00 AM ET", event: "Existing Home Sales", impact: "medium" as const },
  { id: "e6", date: "2025-02-27", time: "8:30 AM ET", event: "GDP (Q4 2024)", impact: "high" as const },
  { id: "e7", date: "2025-02-28", time: "8:30 AM ET", event: "PCE Inflation", impact: "high" as const },
  { id: "e8", date: "2025-03-07", time: "8:30 AM ET", event: "Employment Report", impact: "high" as const },
  { id: "e9", date: "2025-03-12", time: "2:00 PM ET", event: "FOMC Rate Decision", impact: "high" as const },
  { id: "e10", date: "2025-03-14", time: "10:00 AM ET", event: "Consumer Sentiment", impact: "medium" as const },
];

export default function EconomicCalendarPage() {
  const [impactFilter, setImpactFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [month, setMonth] = useState("2025-02");

  const filtered = useMemo(() => {
    return ECONOMIC_EVENTS.filter((e) => {
      if (impactFilter !== "all" && e.impact !== impactFilter) return false;
      if (!e.date.startsWith(month)) return false;
      return true;
    });
  }, [impactFilter, month]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-foreground/60">
        <Link href="/" className="hover:text-accent hover:underline">Dashboard</Link>
        <span>/</span>
        <Link href="/calendar" className="hover:text-accent hover:underline">Calendar</Link>
        <span>/</span>
        <span className="text-foreground">Economic</span>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Economic Calendar</h1>
          <p className="mt-0.5 text-xs text-foreground/60">FOMC, CPI, market holidays, and key releases</p>
        </div>
        <Link href="/calendar" className="shrink-0 text-sm text-accent hover:underline">Earnings & Dividends →</Link>
      </div>
      <div className="flex flex-wrap gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="2025-02">February 2025</option>
          <option value="2025-03">March 2025</option>
        </select>
        <div className="flex gap-1">
          {(["all", "high", "medium", "low"] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setImpactFilter(i)}
              className={`rounded border px-3 py-1.5 text-sm capitalize ${
                impactFilter === i
                  ? "border-accent bg-accent-muted text-accent"
                  : "border-border bg-card text-foreground/80 hover:border-foreground/30"
              }`}
            >
              {i} impact
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card/80 text-left text-xs font-medium uppercase tracking-wide text-foreground/60">
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">Event</th>
              <th className="px-4 py-2.5 font-medium">Impact</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-border/50 last:border-0 hover:bg-accent-muted/30">
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-foreground/90">
                  {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-4 py-2.5 text-foreground/80">{e.time || "—"}</td>
                <td className="px-4 py-2.5 font-medium text-foreground">{e.event}</td>
                <td className="px-4 py-2.5">
                  {e.impact ? (
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        e.impact === "high"
                          ? "bg-negative/20 text-negative"
                          : e.impact === "medium"
                          ? "bg-accent/20 text-accent"
                          : "bg-foreground/10 text-foreground/70"
                      }`}
                    >
                      {e.impact}
                    </span>
                  ) : (
                    <span className="text-foreground/40">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
