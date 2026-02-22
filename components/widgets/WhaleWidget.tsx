"use client";

import Link from "next/link";
import { flowEvents, formatSize, getPerson } from "@/lib/mock-data";
import EventTable from "@/components/EventTable";
import EventFilters, { getDefaultFilters, filterEvents } from "@/components/EventFilters";
import { useState, useMemo } from "react";

function eventTypeLabel(t: string): string {
  if (t === "dark_pool") return "Dark Pool";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function WhaleWidget() {
  const [filters, setFilters] = useState(getDefaultFilters());
  const filtered = useMemo(
    () => filterEvents([...flowEvents], filters).sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1)).slice(0, 8),
    [filters]
  );

  return (
    <div className="space-y-2">
      <EventFilters filters={filters} onChange={setFilters} />
      <EventTable events={filtered} />
      <div className="text-center">
        <Link href="/flow" className="text-xs text-accent hover:underline">
          View all →
        </Link>
      </div>
    </div>
  );
}
