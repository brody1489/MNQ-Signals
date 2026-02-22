"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getPerson, getEventsByPerson, getHoldingsByPerson, formatSize } from "@/lib/mock-data";
import PersonAvatar from "@/components/PersonAvatar";
import EventTable from "@/components/EventTable";
import EventFilters, { getDefaultFilters, filterEvents } from "@/components/EventFilters";

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

type SortOption = "largest" | "smallest" | "recent";

export default function PersonProfilePage() {
  const params = useParams();
  const id = String(params.id);
  const [filters, setFilters] = useState(getDefaultFilters());
  const [holdingsSort, setHoldingsSort] = useState<SortOption>("largest");

  const person = useMemo(() => getPerson(id), [id]);
  const events = useMemo(() => getEventsByPerson(id), [id]);
  const filteredEvents = useMemo(() => filterEvents(events, filters), [events, filters]);
  const holdings = useMemo(() => {
    const list = getHoldingsByPerson(id);
    if (holdingsSort === "largest") return [...list].sort((a, b) => b.valueUsd - a.valueUsd);
    if (holdingsSort === "smallest") return [...list].sort((a, b) => a.valueUsd - b.valueUsd);
    return [...list].sort((a, b) => (b.lastTradeDate > a.lastTradeDate ? 1 : -1));
  }, [id, holdingsSort]);

  if (!person) {
    return (
      <div className="py-8 text-center text-foreground/70">
        <p>Person not found</p>
        <Link href="/people" className="mt-2 inline-block text-sm text-accent hover:underline">
          Back to People
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-foreground/60">
        <Link href="/" className="hover:text-accent hover:underline">Dashboard</Link>
        <span>/</span>
        <Link href="/people" className="hover:text-accent hover:underline">People</Link>
        <span>/</span>
        <span className="text-foreground">{person.name}</span>
      </div>

      <div className="border border-border rounded-lg bg-card p-4">
        <div className="flex items-center gap-4">
          <PersonAvatar name={person.name} role={person.role} size="lg" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">{person.name}</h1>
            <p className="mt-0.5 text-sm text-foreground/80">
              {person.role}
              {person.company ? ` · ${person.company}` : ""}
              {person.party && ` · ${person.party} (${person.state})`}
              {person.committee && ` · ${person.committee}`}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <div className="text-foreground/60">Total capital deployed</div>
            <div className="mt-0.5 font-medium tabular-nums">{formatCurrency(person.totalCapitalDeployed)}</div>
          </div>
          <div>
            <div className="text-foreground/60">Estimated performance</div>
            <div className={`mt-0.5 font-medium tabular-nums ${person.estimatedPerformancePercent >= 0 ? "text-positive" : "text-negative"}`}>
              {person.estimatedPerformancePercent >= 0 ? "+" : ""}{person.estimatedPerformancePercent}%
            </div>
          </div>
          <div>
            <div className="text-foreground/60">Best performing year</div>
            <div className="mt-0.5 font-medium tabular-nums">{person.bestYear}</div>
          </div>
        </div>
      </div>

      {holdings.length > 0 && (
        <div className="border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <span className="text-sm font-medium text-foreground/80">Holdings</span>
            <div className="flex gap-1">
              {(["largest", "smallest", "recent"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setHoldingsSort(s)}
                  className={`rounded border px-2 py-1 text-xs capitalize ${
                    holdingsSort === s
                      ? "border-accent bg-accent-muted/50 text-accent"
                      : "border-border bg-background/50 text-foreground/80 hover:border-foreground/30"
                  }`}
                >
                  {s === "largest" ? "Largest first" : s === "smallest" ? "Smallest first" : "Recent"}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-foreground/60">
                  <th className="px-4 py-2 font-medium">Ticker</th>
                  <th className="px-4 py-2 text-right font-medium">Value</th>
                  <th className="px-4 py-2 font-medium">Last trade</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.tickerSymbol} className="border-b border-border/70 last:border-0 hover:bg-border/30">
                    <td className="px-4 py-2.5">
                      <Link href={`/ticker/${h.tickerSymbol}`} className="font-mono font-medium text-accent hover:underline">
                        {h.tickerSymbol}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatSize(h.valueUsd)}</td>
                    <td className="px-4 py-2.5 text-foreground/70">{new Date(h.lastTradeDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="border border-border bg-card">
        <EventFilters filters={filters} onChange={setFilters} />
        <div className="px-4 py-2 text-xs text-foreground/50">Transaction history for {person.name}</div>
        <EventTable events={filteredEvents} showPerson={false} />
      </div>
    </div>
  );
}
