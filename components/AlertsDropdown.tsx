"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAlerts } from "@/lib/alerts-context";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 60000;
  if (diff < 60) return `${Math.round(diff)}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return `${Math.round(diff / 1440)}d ago`;
}

export default function AlertsDropdown() {
  const { triggered, unreadCount, markRead, markAllRead } = useAlerts();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded p-2 text-foreground/60 hover:bg-border/50 hover:text-foreground transition-colors"
        aria-label="Alerts"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded border border-border bg-card py-1 shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-sm font-semibold text-foreground">Alerts</span>
            <div className="flex items-center gap-2">
              {triggered.some((a) => !a.read) && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-foreground/60 hover:text-accent"
                >
                  Mark all read
                </button>
              )}
              <Link
                href="/settings#alerts"
                className="text-xs text-accent hover:underline"
                onClick={() => setOpen(false)}
              >
                Manage
              </Link>
            </div>
          </div>
          <div className="max-h-72 overflow-auto">
            {triggered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-foreground/50">
                No alerts yet. <Link href="/settings#alerts" className="text-accent hover:underline" onClick={() => setOpen(false)}>Set up alerts</Link> for price, flow, Congress, news, and more.
              </div>
            ) : (
              triggered.map((a) => (
                <div
                  key={a.id}
                  className={`border-b border-border/50 px-4 py-2.5 hover:bg-border/30 cursor-pointer ${
                    !a.read ? "bg-accent/5" : ""
                  }`}
                  onClick={() => a.ticker && markRead(a.id)}
                >
                  <Link
                    href={a.ticker ? `/ticker/${a.ticker}` : "/settings#alerts"}
                    className="block"
                    onClick={() => setOpen(false)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {a.ticker && (
                          <span className="font-mono text-sm font-medium text-accent hover:underline">
                            {a.ticker}
                          </span>
                        )}
                        <p className="text-sm text-foreground/80">{a.message}</p>
                      </div>
                      <span className="shrink-0 text-xs text-foreground/50">{formatTime(a.timestamp)}</span>
                    </div>
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
