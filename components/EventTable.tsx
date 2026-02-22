"use client";

import Link from "next/link";
import type { FlowEvent } from "@/lib/mock-data";
import { formatSize, getPerson } from "@/lib/mock-data";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} ${time}`;
}

function eventTypeLabel(t: FlowEvent["type"]): string {
  switch (t) {
    case "options": return "Options";
    case "dark_pool": return "Dark Pool";
    case "ceo": return "CEO";
    case "congress": return "Congress";
    default: return t;
  }
}

function directionLabel(d: FlowEvent["direction"]): string {
  return d.charAt(0).toUpperCase() + d.slice(1);
}

interface EventTableProps {
  events: FlowEvent[];
  showTicker?: boolean;
  showPerson?: boolean;
}

export default function EventTable({ events, showTicker = true, showPerson = true }: EventTableProps) {
  if (events.length === 0) {
    return (
      <div className="border border-border bg-card px-4 py-8 text-center text-sm text-foreground/60">
        No events match filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-card/80 text-left text-xs font-medium uppercase tracking-wide text-foreground/60">
            <th className="whitespace-nowrap px-3 py-2 font-medium">Date & time</th>
            {showTicker && <th className="whitespace-nowrap px-3 py-2 font-medium">Ticker</th>}
            <th className="whitespace-nowrap px-3 py-2 font-medium">Type</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Direction</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium text-right">Size</th>
            {showPerson && <th className="whitespace-nowrap px-3 py-2 font-medium">Person</th>}
            <th className="whitespace-nowrap px-3 py-2 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const person = e.personId ? getPerson(e.personId) : null;
            return (
              <tr key={e.id} className="border-b border-border/50 last:border-0 hover:bg-accent-muted/30 transition-colors">
                <td className="whitespace-nowrap px-3 py-2 text-sm text-foreground/90">
                  {formatDateTime(e.timestamp)}
                </td>
                {showTicker && (
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link
                      href={`/ticker/${e.tickerSymbol}`}
                      className="font-mono font-medium text-accent hover:underline"
                    >
                      {e.tickerSymbol}
                    </Link>
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-2 text-sm">{eventTypeLabel(e.type)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className={`font-medium ${e.direction === "call" || e.direction === "buy" ? "text-positive" : "text-negative"}`}>
                    {directionLabel(e.direction)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm font-medium tabular-nums">
                  {formatSize(e.sizeUsd)}
                </td>
                {showPerson && (
                  <td className="whitespace-nowrap px-3 py-2 text-sm">
                    {person ? (
                      <Link
                        href={`/people/${person.id}`}
                        className="text-foreground/90 hover:text-accent hover:underline"
                      >
                        {person.name}
                      </Link>
                    ) : (
                      <span className="text-foreground/50">—</span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2 text-sm text-foreground/70 font-mono">{e.details ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
