"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { flowEvents } from "@/lib/mock-data";
import EventTable from "@/components/EventTable";
import EventFilters, { getDefaultFilters, filterEvents } from "@/components/EventFilters";
import CallPutRatioBar from "@/components/CallPutRatioBar";

export default function FlowPage() {
  const [filters, setFilters] = useState(getDefaultFilters());
  const filtered = useMemo(
    () => filterEvents([...flowEvents], filters).sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1)),
    [filters]
  );
  const callPutTotal = useMemo(() => {
    const opts = filtered.filter((e) => e.type === "options");
    let callVol = 0;
    let putVol = 0;
    opts.forEach((e) => {
      if (e.direction === "call") callVol += e.sizeUsd;
      if (e.direction === "put") putVol += e.sizeUsd;
    });
    return { callVol, putVol };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-foreground/60">
        <Link href="/" className="hover:text-accent hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="text-foreground">Whale Tracker</span>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Whale Tracker</h1>
        <p className="mt-0.5 text-sm text-foreground/60">Options, dark pool, CEO & Congress flow</p>
      </div>
      <div className="border border-border bg-card">
        <EventFilters filters={filters} onChange={setFilters} />
        {(callPutTotal.callVol > 0 || callPutTotal.putVol > 0) && (
          <div className="flex items-center gap-4 border-t border-border px-4 py-2">
            <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Call / Put ratio</span>
            <CallPutRatioBar callVolume={callPutTotal.callVol} putVolume={callPutTotal.putVol} variant="quantview" />
          </div>
        )}
        <div className="px-4 py-2 text-xs text-foreground/50">Event feed (newest first)</div>
        <EventTable events={filtered} />
      </div>
    </div>
  );
}
