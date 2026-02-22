"use client";

import Link from "next/link";
import { funds, formatMarketCap } from "@/lib/mock-data";

export default function FundsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-foreground/60">
        <Link href="/" className="hover:text-accent hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="text-foreground">Funds</span>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Funds</h1>
        <p className="mt-0.5 text-sm text-foreground/60">13F holdings, quarter-over-quarter</p>
      </div>
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/50 text-left text-foreground/70">
              <th className="px-4 py-2.5 font-medium">Fund</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 text-right font-medium">AUM</th>
            </tr>
          </thead>
          <tbody>
            {funds.map((f) => (
              <tr key={f.id} className="border-b border-border/70 last:border-0 hover:bg-border/30">
                <td className="px-4 py-2.5">
                  <Link href={`/funds/${f.id}`} className="font-medium text-accent hover:underline">
                    {f.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-foreground/70">{f.type}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMarketCap(f.aum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
