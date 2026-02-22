"use client";

import Link from "next/link";
import { getTopTickersByFlowToday, formatSize } from "@/lib/mock-data";

export default function TopTickersWidget() {
  const top = getTopTickersByFlowToday(5);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/70 text-left text-foreground/60">
            <th className="px-2 py-1.5 font-medium">Ticker</th>
            <th className="px-2 py-1.5 text-right font-medium">Flow (today)</th>
            <th className="px-2 py-1.5 text-right font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {top.map(({ symbol, totalSize, count }) => (
            <tr key={symbol} className="border-b border-border/50 last:border-0">
              <td className="px-2 py-1.5">
                <Link href={`/ticker/${symbol}`} className="font-mono font-medium text-accent hover:underline">
                  {symbol}
                </Link>
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatSize(totalSize)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
