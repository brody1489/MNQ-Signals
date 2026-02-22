"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { newsArticles, tickers } from "@/lib/mock-data";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function NewsPage() {
  const [keyword, setKeyword] = useState("");
  const [tickerFilter, setTickerFilter] = useState("");
  const [minImportance, setMinImportance] = useState(0);

  const filtered = useMemo(() => {
    return newsArticles.filter((a) => {
      // Full-text search: headline, summary, ticker, or company name (Apple → AAPL)
      if (keyword.trim()) {
        const k = keyword.toLowerCase();
        const matchedSymbols = tickers
          .filter((t) => t.name.toLowerCase().includes(k) || t.symbol.toLowerCase().includes(k))
          .map((t) => t.symbol);
        const searchable = `${a.headline} ${a.summary} ${a.tickers.join(" ")}`.toLowerCase();
        const matchesText = searchable.includes(k);
        const matchesCompany = a.tickers.some((t) => matchedSymbols.includes(t));
        if (!matchesText && !matchesCompany) return false;
      }
      if (tickerFilter && !a.tickers.some((t) => t.toUpperCase().includes(tickerFilter.toUpperCase()))) return false;
      if (a.importance < minImportance) return false;
      return true;
    });
  }, [keyword, tickerFilter, minImportance]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-foreground/60">
        <Link href="/" className="hover:text-accent hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="text-foreground">News</span>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">News Stream</h1>
          <p className="mt-0.5 text-sm text-foreground/60">Filter by ticker and importance</p>
        </div>
        <Link href="/calendar" className="shrink-0 text-sm text-accent hover:underline">Economic Calendar →</Link>
      </div>
      <div className="flex flex-wrap gap-3 border-b border-border pb-4">
        <input
          type="text"
          placeholder='Search: "Apple", "NVDA earnings", keywords...'
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="min-w-[200px] rounded border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-foreground/50 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
        />
        <input
          type="text"
          placeholder="Ticker (e.g. AAPL)"
          value={tickerFilter}
          onChange={(e) => setTickerFilter(e.target.value)}
          className="w-28 rounded border border-border bg-card px-3 py-2 font-mono text-sm text-foreground placeholder:text-foreground/50 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
        />
        <select
          value={minImportance}
          onChange={(e) => setMinImportance(Number(e.target.value))}
          className="rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none"
        >
          <option value={0}>Any importance</option>
          <option value={3}>3+ stars</option>
          <option value={4}>4+ stars</option>
          <option value={5}>5 stars only</option>
        </select>
      </div>
      <div className="space-y-3">
        {filtered.map((a) => (
          <div key={a.id} className="rounded border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-medium text-foreground">{a.headline}</h2>
              <span className="shrink-0 text-xs text-foreground/50">{formatTime(a.timestamp)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {a.tickers.map((t) => (
                <Link key={t} href={`/ticker/${t}`} className="rounded bg-accent-muted/50 px-2 py-0.5 text-xs font-mono text-accent hover:underline">
                  {t}
                </Link>
              ))}
            </div>
            <p className="mt-2 text-sm text-foreground/80">{a.summary}</p>
            <div className="mt-2 flex gap-4 text-xs text-foreground/50">
              <span>{a.source}</span>
              <span>Importance: {a.importance}/5</span>
              <span>Impact: {a.impact}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
