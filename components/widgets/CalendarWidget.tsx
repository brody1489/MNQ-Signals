"use client";

import Link from "next/link";
import { tickers, dividendRecords } from "@/lib/mock-data";

const now = new Date();
const next7Days = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(now);
  d.setDate(d.getDate() + i);
  return d.toISOString().slice(0, 10);
});

export default function CalendarWidget() {
  const upcomingEarnings = tickers
    .filter((t) => t.earningsDate && next7Days.includes(t.earningsDate))
    .slice(0, 5);
  const upcomingDivs = dividendRecords
    .filter((d) => next7Days.includes(d.exDate))
    .slice(0, 3);

  return (
    <div className="space-y-3 text-sm">
      {upcomingEarnings.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-foreground/60">Earnings</div>
          <ul className="space-y-1">
            {upcomingEarnings.map((t) => (
              <li key={t.symbol}>
                <Link href={`/ticker/${t.symbol}`} className="text-accent hover:underline">
                  {t.symbol}
                </Link>{" "}
                <span className="text-foreground/60">
                  {t.earningsDate && new Date(t.earningsDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {upcomingDivs.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-foreground/60">Dividends (ex-date)</div>
          <ul className="space-y-1">
            {upcomingDivs.map((d) => (
              <li key={d.tickerSymbol + d.exDate}>
                <Link href={`/ticker/${d.tickerSymbol}`} className="text-accent hover:underline">
                  {d.tickerSymbol}
                </Link>{" "}
                <span className="text-foreground/60">${d.amount} — {new Date(d.exDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(upcomingEarnings.length === 0 && upcomingDivs.length === 0) && (
        <p className="text-foreground/50">No events in next 7 days</p>
      )}
      <div className="flex gap-3 pt-1">
        <Link href="/calendar" className="text-xs text-accent hover:underline">
          Earnings & Dividends →
        </Link>
        <Link href="/calendar/economic" className="text-xs text-accent hover:underline">
          Economic →
        </Link>
      </div>
    </div>
  );
}
