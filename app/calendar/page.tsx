"use client";

import Link from "next/link";
import { tickers, dividendRecords } from "@/lib/mock-data";

const events = [
  ...tickers
    .filter((t) => t.earningsDate)
    .map((t) => ({ type: "earnings" as const, ticker: t.symbol, date: t.earningsDate!, details: "Earnings" })),
  ...dividendRecords.map((d) => ({ type: "dividend" as const, ticker: d.tickerSymbol, date: d.exDate, details: `Ex-date: $${d.amount}` })),
].sort((a, b) => a.date.localeCompare(b.date));

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-foreground/60">
        <Link href="/" className="hover:text-accent hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="text-foreground">Calendar</span>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Calendar</h1>
        <p className="mt-0.5 text-sm text-foreground/60">Earnings, dividends, splits</p>
      </div>
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/50 text-left text-foreground/70">
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Ticker</th>
              <th className="px-4 py-2.5 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i} className="border-b border-border/70 last:border-0 hover:bg-border/30">
                <td className="whitespace-nowrap px-4 py-2.5 text-foreground/90">
                  {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-4 py-2.5 capitalize">{e.type}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/ticker/${e.ticker}`} className="font-mono font-medium text-accent hover:underline">
                    {e.ticker}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-foreground/70">{e.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
