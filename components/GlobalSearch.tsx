"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchableTickers, searchablePeople, searchableFunds, formatMarketCap, getFundByTicker } from "@/lib/mock-data";

type SearchResult =
  | { type: "ticker"; symbol: string; name: string; hasFund?: boolean }
  | { type: "person"; id: string; name: string; role: string; company: string | null }
  | { type: "fund"; id: string; name: string; aum: number; tickerSymbol?: string };

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    const q = query.toLowerCase();
    const tickerMatches = searchableTickers.filter(
      (t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
    );
    const peopleMatches = searchablePeople.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.company?.toLowerCase().includes(q)) ||
        p.role.toLowerCase().includes(q)
    );
    const fundMatches = searchableFunds.filter((f) => f.name.toLowerCase().includes(q));
    const combined: SearchResult[] = [
      ...tickerMatches.slice(0, 5).map((t) => ({
        type: "ticker" as const,
        symbol: t.symbol,
        name: t.name,
        hasFund: !!getFundByTicker(t.symbol),
      })),
      ...peopleMatches.slice(0, 4).map((p) => ({ type: "person" as const, id: p.id, name: p.name, role: p.role, company: p.company })),
      ...fundMatches.slice(0, 3).map((f) => ({ type: "fund" as const, id: f.id, name: f.name, aum: f.aum, tickerSymbol: f.tickerSymbol })),
    ];
    setResults(combined);
    setOpen(combined.length > 0);
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, open]);

  const handleSelect = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    if (r.type === "ticker") router.push(`/ticker/${r.symbol}`);
    else if (r.type === "person") router.push(`/people/${r.id}`);
    else if (r.type === "fund") router.push(`/funds/${r.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && open && results.length > 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 focus-within:ring-1 focus-within:ring-accent/50">
        <svg
          className="h-4 w-4 shrink-0 text-foreground/50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="search"
          placeholder='Search: "Apple", NVDA, person, fund...'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setOpen(results.length > 0)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/50 focus:outline-none"
          role="combobox"
          aria-expanded={open}
          aria-controls="search-results"
          aria-autocomplete="list"
          aria-haspopup="listbox"
        />
      </div>
      {open && results.length > 0 && (
        <div
          id="search-results"
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded border border-border bg-card py-0.5 shadow-xl"
        >
          {results.map((r, i) => (
            <button
              key={r.type === "ticker" ? r.symbol : r.id}
              type="button"
              data-index={i}
              role="option"
              aria-selected={i === selectedIndex}
              onClick={() => handleSelect(r)}
              className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm ${
                i === selectedIndex ? "bg-accent-muted/50 text-foreground" : "text-foreground/90 hover:bg-border/50"
              }`}
            >
              {r.type === "ticker" ? (
                <>
                  <span className="font-mono font-semibold text-accent">{r.symbol}</span>
                  <span className="text-foreground/80">{r.name}</span>
                  {r.hasFund && <span className="ml-auto text-xs text-foreground/50">Stock</span>}
                </>
              ) : r.type === "person" ? (
                <>
                  <span className="font-medium text-foreground">{r.name}</span>
                  <span className="text-xs text-foreground/60">
                    {r.role}
                    {r.company ? ` · ${r.company}` : ""}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">{r.name}</span>
                  <span className="text-xs text-foreground/60">
                    {formatMarketCap(r.aum)}
                    {r.tickerSymbol && ` · ${r.tickerSymbol}`}
                  </span>
                  <span className="text-xs text-foreground/50">Fund</span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
