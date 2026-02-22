"use client";

import Link from "next/link";
import { newsArticles } from "@/lib/mock-data";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60000);
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NewsWidget() {
  const articles = newsArticles.slice(0, 6);

  return (
    <div className="space-y-2">
      {articles.map((a) => (
        <div
          key={a.id}
          className="rounded border border-border/60 bg-background/40 p-2.5 hover:border-accent/30"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground line-clamp-2">{a.headline}</p>
            <span className="shrink-0 text-xs text-foreground/50">{formatTime(a.timestamp)}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {a.tickers.slice(0, 4).map((t) => (
              <Link
                key={t}
                href={`/ticker/${t}`}
                className="rounded bg-accent-muted/50 px-1.5 py-0.5 text-xs font-mono text-accent hover:underline"
              >
                {t}
              </Link>
            ))}
          </div>
          <p className="mt-1 text-xs text-foreground/60 line-clamp-1">{a.summary}</p>
        </div>
      ))}
      <div className="text-center">
        <Link href="/news" className="text-xs text-accent hover:underline">
          View all news →
        </Link>
      </div>
    </div>
  );
}
