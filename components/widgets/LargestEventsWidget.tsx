"use client";

import Link from "next/link";
import { getLargestEventsToday, formatSize, getPerson } from "@/lib/mock-data";

function eventTypeLabel(t: string): string {
  if (t === "dark_pool") return "Dark Pool";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function LargestEventsWidget() {
  const events = getLargestEventsToday(5);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/70 text-left text-foreground/60">
            <th className="px-2 py-1.5 font-medium">Time</th>
            <th className="px-2 py-1.5 font-medium">Ticker</th>
            <th className="px-2 py-1.5 font-medium">Type</th>
            <th className="px-2 py-1.5 text-right font-medium">Size</th>
            <th className="px-2 py-1.5 font-medium">Person</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const person = e.personId ? getPerson(e.personId) : null;
            return (
              <tr key={e.id} className="border-b border-border/50 last:border-0 hover:bg-accent-muted/20">
                <td className="whitespace-nowrap px-2 py-1.5 text-foreground/90">
                  {new Date(e.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </td>
                <td className="px-2 py-1.5">
                  <Link href={`/ticker/${e.tickerSymbol}`} className="font-mono text-accent hover:underline">
                    {e.tickerSymbol}
                  </Link>
                </td>
                <td className="px-2 py-1.5">{eventTypeLabel(e.type)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">{formatSize(e.sizeUsd)}</td>
                <td className="px-2 py-1.5">
                  {person ? (
                    <Link href={`/people/${person.id}`} className="text-xs text-foreground/70 hover:text-accent hover:underline">
                      {person.name}
                    </Link>
                  ) : (
                    <span className="text-foreground/40">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
