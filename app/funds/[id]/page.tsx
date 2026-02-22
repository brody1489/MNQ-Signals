"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getFund, getHoldingsByFund, formatMarketCap, tickers } from "@/lib/mock-data";

export default function FundProfilePage() {
  const params = useParams();
  const id = String(params.id);
  const [quarter, setQuarter] = useState("2025-Q2");

  const fund = useMemo(() => getFund(id), [id]);
  const holdings = useMemo(() => getHoldingsByFund(id, quarter), [id, quarter]);

  if (!fund) {
    return (
      <div className="py-8 text-center text-foreground/70">
        <p>Fund not found</p>
        <Link href="/funds" className="mt-2 inline-block text-sm text-accent hover:underline">
          Back to Funds
        </Link>
      </div>
    );
  }

  const availableQuarters = ["2025-Q2", "2025-Q1"];
  const getTickerName = (sym: string) => tickers.find((t) => t.symbol === sym)?.name ?? sym;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-foreground/60">
        <Link href="/" className="hover:text-accent hover:underline">Dashboard</Link>
        <span>/</span>
        <Link href="/funds" className="hover:text-accent hover:underline">Funds</Link>
        <span>/</span>
        <span className="text-foreground">{fund.name}</span>
      </div>

      <div className="border border-border bg-card p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{fund.name}</h1>
            <p className="mt-0.5 text-sm text-foreground/80">{fund.type}</p>
          </div>
          {fund.tickerSymbol && (
            <Link
              href={`/ticker/${fund.tickerSymbol}`}
              className="rounded border border-accent/50 bg-accent-muted/30 px-3 py-1.5 text-sm font-mono text-accent hover:bg-accent-muted/50"
            >
              View as stock ({fund.tickerSymbol}) →
            </Link>
          )}
        </div>
        <div className="mt-4 flex items-center gap-6 text-sm">
          <div>
            <span className="text-foreground/60">AUM</span>
            <span className="ml-2 font-medium tabular-nums">{formatMarketCap(fund.aum)}</span>
          </div>
          <div>
            <span className="text-foreground/60">Quarter</span>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="ml-2 rounded border border-border bg-background px-2 py-1 text-foreground"
            >
              {availableQuarters.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="border border-border bg-card">
        <div className="border-b border-border px-4 py-2.5 text-sm font-medium text-foreground/80">
          Holdings — {quarter}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-foreground/60">
                <th className="px-4 py-2 font-medium">Ticker</th>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 text-right font-medium">Value</th>
                <th className="px-4 py-2 text-right font-medium">% of Portfolio</th>
                <th className="px-4 py-2 text-right font-medium">Change from Prior Q</th>
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
                  <td className="px-4 py-2.5 text-foreground/80">{getTickerName(h.tickerSymbol)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatMarketCap(h.valueUsd)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{h.percentOfPortfolio.toFixed(2)}%</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${h.changeFromPriorQ >= 0 ? "text-positive" : "text-negative"}`}>
                    {h.changeFromPriorQ >= 0 ? "+" : ""}{h.changeFromPriorQ.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
