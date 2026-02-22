"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { tickers, getCallPutByTicker } from "@/lib/mock-data";
import RangeBar52w from "@/components/RangeBar52w";
import CallPutRatioBar from "@/components/CallPutRatioBar";
import TickerLogo from "@/components/TickerLogo";

type SortKey = "change" | "volume" | "cap";
const TOP_N_OPTIONS = [10, 25, 50, 100, 250] as const;

const mockWithVolume = tickers.map((t) => ({
  ...t,
  volume: Math.floor(Math.random() * 80_000_000) + 5_000_000,
}));

export default function ScannersPage() {
  const [sortBy, setSortBy] = useState<SortKey>("change");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [topN, setTopN] = useState<number>(25);
  const [minVolume, setMinVolume] = useState<number>(0);
  const [minCap, setMinCap] = useState<number>(0);

  const callPutMap = useMemo(() => getCallPutByTicker(), []);
  const sorted = useMemo(() => {
    let list = [...mockWithVolume];
    if (minVolume > 0) list = list.filter((t) => t.volume >= minVolume);
    if (minCap > 0) list = list.filter((t) => t.marketCap >= minCap);
    if (sortBy === "change") list.sort((a, b) => (direction === "desc" ? b.changePercent - a.changePercent : a.changePercent - b.changePercent));
    if (sortBy === "volume") list.sort((a, b) => (direction === "desc" ? b.volume - a.volume : a.volume - b.volume));
    if (sortBy === "cap") list.sort((a, b) => (direction === "desc" ? b.marketCap - a.marketCap : a.marketCap - b.marketCap));
    return list.slice(0, topN);
  }, [sortBy, direction, topN, minVolume, minCap]);

  const formatVol = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  };
  const formatCap = (n: number) => {
    if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(1)}T`;
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    return `$${n}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-foreground/60">
        <Link href="/" className="hover:text-accent hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="text-foreground">Scanners</span>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Market Scanner</h1>
          <p className="mt-0.5 text-xs text-foreground/60">Top movers by change, volume, or market cap · Like Fidelity / QuantView</p>
        </div>
        <Link href="/flow" className="shrink-0 text-sm text-accent hover:underline">Whale Flow →</Link>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground/60">Top:</span>
          <select
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            className="rounded border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus:border-accent/50 focus:outline-none"
          >
            {TOP_N_OPTIONS.map((n) => (
              <option key={n} value={n}>Top {n}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground/60">Sort by:</span>
          {(["change", "volume", "cap"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSortBy(k)}
              className={`rounded border px-3 py-1.5 text-sm capitalize ${
                sortBy === k ? "border-accent bg-accent-muted text-accent" : "border-border bg-card text-foreground/80 hover:border-foreground/30"
              }`}
            >
              {k === "change" ? "% Change" : k === "cap" ? "Market Cap" : k}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDirection((d) => (d === "desc" ? "asc" : "desc"))}
            className="rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground/80 hover:border-foreground/30"
          >
            {direction === "desc" ? "↓ Desc" : "↑ Asc"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground/60">Min volume:</span>
          <select
            value={minVolume}
            onChange={(e) => setMinVolume(Number(e.target.value))}
            className="rounded border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus:border-accent/50 focus:outline-none"
          >
            <option value={0}>Any</option>
            <option value={1_000_000}>1M+</option>
            <option value={5_000_000}>5M+</option>
            <option value={10_000_000}>10M+</option>
            <option value={50_000_000}>50M+</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground/60">Min market cap:</span>
          <select
            value={minCap}
            onChange={(e) => setMinCap(Number(e.target.value))}
            className="rounded border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus:border-accent/50 focus:outline-none"
          >
            <option value={0}>Any</option>
            <option value={1_000_000_000}>$1B+</option>
            <option value={10_000_000_000}>$10B+</option>
            <option value={100_000_000_000}>$100B+</option>
            <option value={500_000_000_000}>$500B+</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto border border-border rounded-lg bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card/80 text-left text-xs font-medium uppercase tracking-wide text-foreground/60">
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 text-right font-medium">Price</th>
              <th className="px-4 py-2.5 text-right font-medium">Change</th>
              <th className="px-4 py-2.5 text-right font-medium">Volume</th>
              <th className="px-4 py-2.5 text-right font-medium">Market Cap</th>
              <th className="px-4 py-2.5 font-medium">P/C</th>
              <th className="px-4 py-2.5 font-medium">52w Range</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => {
              const cp = callPutMap.get(t.symbol) ?? { call: 0, put: 0 };
              return (
              <tr key={t.symbol} className="border-b border-border/50 last:border-0 hover:bg-accent-muted/20 transition-colors">
                <td className="px-4 py-2.5 text-foreground/50 tabular-nums">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/ticker/${t.symbol}`} className="flex items-center gap-2 group">
                    <TickerLogo symbol={t.symbol} name={t.name} size="sm" />
                    <div>
                      <span className="font-medium text-foreground group-hover:text-accent">{t.name}</span>
                      <span className="block text-xs font-mono text-foreground/60">{t.symbol}</span>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">${t.price.toFixed(2)}</td>
                <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${t.changePercent >= 0 ? "text-positive" : "text-negative"}`}>
                  {t.changePercent >= 0 ? "+" : ""}{t.changePercent.toFixed(2)}%
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground/80">{formatVol(t.volume)}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground/80">{formatCap(t.marketCap)}</td>
                <td className="px-4 py-2.5 min-w-[100px]">
                  {(cp.call > 0 || cp.put > 0) ? (
                    <CallPutRatioBar callVolume={cp.call} putVolume={cp.put} variant="quantview" compact />
                  ) : (
                    <span className="text-foreground/40">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 min-w-[140px]">
                  <RangeBar52w low={t.low52w} high={t.high52w} current={t.price} showLabels={false} />
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
