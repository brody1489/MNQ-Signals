"use client";

import Link from "next/link";
import { tickers } from "@/lib/mock-data";

// Mock scanner data - top gainers, losers, by volume
const mockScanner = tickers
  .map((t) => ({
    ...t,
    volume: Math.floor(Math.random() * 50_000_000) + 1_000_000,
  }))
  .sort((a, b) => b.changePercent - a.changePercent);

export default function ScannerWidget() {
  const topGainers = mockScanner.slice(0, 5);
  const topLosers = [...mockScanner].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 text-xs font-medium text-foreground/60">Top gainers</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 text-left text-foreground/50">
                <th className="px-2 py-1 font-medium">Ticker</th>
                <th className="px-2 py-1 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {topGainers.map((t) => (
                <tr key={t.symbol} className="border-b border-border/30 last:border-0">
                  <td className="px-2 py-1">
                    <Link href={`/ticker/${t.symbol}`} className="font-mono text-accent hover:underline">
                      {t.symbol}
                    </Link>
                  </td>
                  <td className="px-2 py-1 text-right font-medium text-positive">
                    +{t.changePercent.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-foreground/60">Top losers</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 text-left text-foreground/50">
                <th className="px-2 py-1 font-medium">Ticker</th>
                <th className="px-2 py-1 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {topLosers.map((t) => (
                <tr key={t.symbol} className="border-b border-border/30 last:border-0">
                  <td className="px-2 py-1">
                    <Link href={`/ticker/${t.symbol}`} className="font-mono text-accent hover:underline">
                      {t.symbol}
                    </Link>
                  </td>
                  <td className="px-2 py-1 text-right font-medium text-negative">
                    {t.changePercent.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Link href="/scanners" className="block text-center text-xs text-accent hover:underline">
        Full scanners →
      </Link>
    </div>
  );
}
