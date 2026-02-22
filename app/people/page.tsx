"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { people, type PersonRole } from "@/lib/mock-data";
import PersonAvatar from "@/components/PersonAvatar";

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

export default function PeopleListPage() {
  const [roleFilter, setRoleFilter] = useState<PersonRole | "all">("all");
  const [sortBy, setSortBy] = useState<"name" | "performance" | "capital">("performance");

  const filtered = useMemo(() => {
    let list = roleFilter === "all" ? [...people] : people.filter((p) => p.role === roleFilter);
    if (sortBy === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "performance") list.sort((a, b) => b.estimatedPerformancePercent - a.estimatedPerformancePercent);
    if (sortBy === "capital") list.sort((a, b) => b.totalCapitalDeployed - a.totalCapitalDeployed);
    return list;
  }, [roleFilter, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-foreground/60">
        <Link href="/" className="hover:text-accent hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="text-foreground">People</span>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-foreground">People</h1>
        <p className="mt-0.5 text-sm text-foreground/60">
          Tracked insiders, Congress, and large flow participants
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-b border-border pb-3 text-sm">
        <span className="text-foreground/60">Role:</span>
        <div className="flex gap-1">
          {(["all", "CEO", "Congress", "Whale"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded border px-2.5 py-1 capitalize ${
                roleFilter === r
                  ? "border-accent bg-accent-muted/50 text-accent"
                  : "border-border bg-card text-foreground/80 hover:border-foreground/30"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <span className="text-foreground/60">Sort:</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "name" | "performance" | "capital")}
          className="rounded border border-border bg-card px-2.5 py-1 text-foreground"
        >
          <option value="performance">Performance</option>
          <option value="capital">Capital deployed</option>
          <option value="name">Name</option>
        </select>
      </div>

      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card/80 text-left text-xs font-medium uppercase tracking-wide text-foreground/60">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium text-right">Capital deployed</th>
              <th className="px-4 py-2.5 font-medium text-right">Est. performance</th>
              <th className="px-4 py-2.5 font-medium text-right">Best year</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-accent-muted/20 transition-colors">
                <td className="px-4 py-2.5">
                  <Link href={`/people/${p.id}`} className="flex items-center gap-3 group">
                    <PersonAvatar name={p.name} role={p.role} size="sm" />
                    <span className="font-medium text-foreground group-hover:text-accent group-hover:underline">
                      {p.name}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5">{p.role}</td>
                <td className="px-4 py-2.5 text-foreground/80">{p.company ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(p.totalCapitalDeployed)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${p.estimatedPerformancePercent >= 0 ? "text-positive" : "text-negative"}`}>
                  {p.estimatedPerformancePercent >= 0 ? "+" : ""}{p.estimatedPerformancePercent}%
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.bestYear}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
