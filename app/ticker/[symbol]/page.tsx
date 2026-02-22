"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  getTicker,
  getEventsByTicker,
  getNewsByTicker,
  getEarningsByTicker,
  getDividendsByTicker,
  getFilingsByTicker,
  getTranscriptByTicker,
  getFundByTicker,
  getPriceHistory,
  formatMarketCap,
  formatSize,
} from "@/lib/mock-data";
import EventTable from "@/components/EventTable";
import EventFilters, { getDefaultFilters, filterEvents } from "@/components/EventFilters";
import RangeBar52w from "@/components/RangeBar52w";
import CallPutRatioBar from "@/components/CallPutRatioBar";
import TickerLogo from "@/components/TickerLogo";
import Sparkline from "@/components/Sparkline";
import Link from "next/link";

const TABS = ["overview", "news", "earnings", "dividends", "filings", "transcripts", "flow"] as const;

export default function TickerPage() {
  const params = useParams();
  const symbol = String(params.symbol).toUpperCase();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("overview");
  const [filters, setFilters] = useState(getDefaultFilters());

  const ticker = useMemo(() => getTicker(symbol), [symbol]);
  const events = useMemo(() => getEventsByTicker(symbol), [symbol]);
  const filteredEvents = useMemo(() => filterEvents(events, filters), [events, filters]);
  const optionsCallPut = useMemo(() => {
    const opts = events.filter((e) => e.type === "options");
    let callVol = 0;
    let putVol = 0;
    opts.forEach((e) => {
      if (e.direction === "call") callVol += e.sizeUsd;
      if (e.direction === "put") putVol += e.sizeUsd;
    });
    return { callVol, putVol };
  }, [events]);
  const news = useMemo(() => getNewsByTicker(symbol), [symbol]);
  const earnings = useMemo(() => getEarningsByTicker(symbol), [symbol]);
  const dividends = useMemo(() => getDividendsByTicker(symbol), [symbol]);
  const filings = useMemo(() => getFilingsByTicker(symbol), [symbol]);
  const transcripts = useMemo(() => getTranscriptByTicker(symbol), [symbol]);
  const linkedFund = useMemo(() => getFundByTicker(symbol), [symbol]);
  const priceHistory = useMemo(() => getPriceHistory(symbol), [symbol]);

  if (!ticker) {
    return (
      <div className="py-8 text-center text-foreground/70">
        <p>Ticker not found: {symbol}</p>
        <Link href="/" className="mt-2 inline-block text-sm text-accent hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-foreground/60">
        <Link href="/" className="hover:text-accent hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="text-foreground">{symbol}</span>
      </div>

      {/* Header: QuantView-style profile */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex items-start gap-4">
              <TickerLogo symbol={ticker.symbol} name={ticker.name} size="lg" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-mono text-2xl font-semibold text-accent">{ticker.symbol}</h1>
                  {linkedFund && (
                    <Link
                      href={`/funds/${linkedFund.id}`}
                      className="rounded border border-accent/50 bg-accent-muted/30 px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent-muted/50"
                    >
                      13F Holdings →
                    </Link>
                  )}
                </div>
                <p className="text-foreground/90 font-medium">{ticker.name}</p>
                <p className="text-xs text-foreground/60">{ticker.sector}</p>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              {priceHistory.length > 1 && (
                <Sparkline data={priceHistory} width={160} height={48} positive={ticker.changePercent >= 0} />
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-6 text-sm">
            <span className="font-mono text-lg font-semibold">${ticker.price.toFixed(2)}</span>
            <span className={ticker.changePercent >= 0 ? "text-positive font-medium" : "text-negative font-medium"}>
              {ticker.changePercent >= 0 ? "+" : ""}{ticker.changePercent.toFixed(2)}%
            </span>
            <span className="text-foreground/70">{formatMarketCap(ticker.marketCap)}</span>
            {ticker.pe != null && <span className="text-foreground/70">P/E {ticker.pe}</span>}
            {ticker.dividendYield > 0 && (
              <span className="text-foreground/70">Div {ticker.dividendYield}%</span>
            )}
          </div>

          <div className="mt-5 grid sm:grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/50 mb-1.5">52-week range</div>
              <RangeBar52w low={ticker.low52w} high={ticker.high52w} current={ticker.price} />
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/50 mb-1.5">Options flow (C/P)</div>
              {(optionsCallPut.callVol > 0 || optionsCallPut.putVol > 0) ? (
                <CallPutRatioBar callVolume={optionsCallPut.callVol} putVolume={optionsCallPut.putVol} variant="quantview" />
              ) : (
                <p className="text-xs text-foreground/50">No options flow data</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-t px-4 py-2 text-sm capitalize ${
              activeTab === tab
                ? "border border-border border-b-0 bg-card text-accent"
                : "text-foreground/70 hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="border border-border rounded-lg bg-card p-4">
            <h3 className="text-sm font-medium text-foreground/80">Next Earnings</h3>
            <p className="mt-1 text-foreground font-medium">
              {ticker.earningsDate
                ? new Date(ticker.earningsDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "—"}
            </p>
            <Link href="/calendar" className="mt-2 inline-block text-xs text-accent hover:underline">View calendar →</Link>
          </div>
          <div className="border border-border rounded-lg bg-card p-4">
            <h3 className="text-sm font-medium text-foreground/80">Recent Flow</h3>
            <p className="mt-1 text-foreground font-medium">{events.length} events</p>
            {events.length > 0 && (
              <ul className="mt-2 space-y-1.5 text-xs">
                {events.slice(0, 5).map((e) => (
                  <li key={e.id} className="flex justify-between items-center">
                    <span className="text-foreground/80 capitalize">{e.type.replace("_", " ")}</span>
                    <span className="font-mono font-medium">{formatSize(e.sizeUsd)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/flow`} className="mt-2 inline-block text-xs text-accent hover:underline">View all flow →</Link>
          </div>
          <div className="border border-border rounded-lg bg-card p-4">
            <h3 className="text-sm font-medium text-foreground/80">Key Stats</h3>
            <div className="mt-2 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-foreground/60">Sector</span><span>{ticker.sector}</span></div>
              <div className="flex justify-between"><span className="text-foreground/60">P/E</span><span>{ticker.pe ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-foreground/60">Beta</span><span>{ticker.beta ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-foreground/60">Div yield</span><span>{ticker.dividendYield}%</span></div>
            </div>
          </div>
          {linkedFund && (
            <div className="sm:col-span-2 lg:col-span-3 border border-border rounded-lg bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground/80">13F Holdings (as {ticker.name})</h3>
                <Link href={`/funds/${linkedFund.id}`} className="text-sm text-accent hover:underline">
                  View full fund →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "news" && (
        <div className="space-y-3">
          {news.length === 0 ? (
            <p className="py-8 text-center text-foreground/60">No news for {symbol}</p>
          ) : (
            news.map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-medium text-foreground">{a.headline}</h3>
                <p className="mt-1 text-sm text-foreground/70">{a.summary}</p>
                <p className="mt-2 text-xs text-foreground/50">{a.source} · {new Date(a.timestamp).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "earnings" && (
        <div className="overflow-x-auto border border-border rounded-lg bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card/80 text-left text-foreground/70">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">EPS Est</th>
                <th className="px-4 py-2 font-medium">EPS Act</th>
                <th className="px-4 py-2 font-medium">Beat/Miss</th>
              </tr>
            </thead>
            <tbody>
              {earnings.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-foreground/60">No earnings data</td></tr>
              ) : (
                earnings.map((e) => (
                  <tr key={e.date} className="border-b border-border/70 last:border-0 hover:bg-accent-muted/20">
                    <td className="px-4 py-2">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2">{e.epsEstimate.toFixed(2)}</td>
                    <td className="px-4 py-2">{e.epsActual.toFixed(2)}</td>
                    <td className={`px-4 py-2 font-medium ${e.beatMiss === "beat" ? "text-positive" : e.beatMiss === "miss" ? "text-negative" : ""}`}>
                      {e.beatMiss}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "dividends" && (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-border rounded-lg bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card/80 text-left text-foreground/70">
                  <th className="px-4 py-2 font-medium">Ex-Date</th>
                  <th className="px-4 py-2 font-medium">Payment Date</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {dividends.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-foreground/60">No dividend data</td></tr>
                ) : (
                  dividends.map((d) => {
                    const isFuture = new Date(d.exDate) > new Date();
                    return (
                      <tr key={d.exDate + d.paymentDate} className="border-b border-border/70 last:border-0 hover:bg-accent-muted/20">
                        <td className="px-4 py-2">
                          <span className={isFuture ? "text-accent font-medium" : ""}>
                            {new Date(d.exDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </td>
                        <td className="px-4 py-2">{new Date(d.paymentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                        <td className="px-4 py-2 font-mono font-medium">${d.amount.toFixed(2)}</td>
                        <td className="px-4 py-2 capitalize text-foreground/70">{d.type}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {ticker.dividendYield > 0 && (
            <div className="border border-border rounded-lg bg-card p-4">
              <h3 className="text-sm font-medium text-foreground/80">Dividend yield</h3>
              <p className="mt-1 text-2xl font-semibold text-accent">{ticker.dividendYield}%</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "filings" && (
        <div className="space-y-2">
          {filings.length === 0 ? (
            <p className="py-8 text-center text-foreground/60">No filings</p>
          ) : (
            filings.map((f) => (
              <div key={f.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium text-accent">{f.type}</span>
                  <span className="text-sm text-foreground/60">{new Date(f.date).toLocaleDateString()}</span>
                </div>
                <p className="mt-2 text-sm text-foreground/80">{f.summary}</p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "transcripts" && (
        <div className="space-y-2">
          {transcripts.length === 0 ? (
            <p className="py-8 text-center text-foreground/60">No transcript summaries</p>
          ) : (
            transcripts.map((t) => (
              <div key={t.date} className="rounded-lg border border-border bg-card p-4">
                <span className="text-sm text-foreground/60">{new Date(t.date).toLocaleDateString()}</span>
                <p className="mt-2 text-sm text-foreground/80">{t.summary}</p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "flow" && (
        <div className="border border-border rounded-lg bg-card">
          <EventFilters filters={filters} onChange={setFilters} />
          <div className="px-4 py-2 text-xs text-foreground/50">Flow events for {symbol}</div>
          <EventTable events={filteredEvents} showTicker={false} />
        </div>
      )}
    </div>
  );
}
