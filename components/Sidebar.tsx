"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
  { href: "/flow", label: "Whale Tracker", icon: "M13 7h8m0 0v8m0-8l-3 3m-6-3a3 3 0 11-6 0 3 3 0 016 0zm10 0a7 7 0 11-14 0 7 7 0 0114 0z" },
  { href: "/people", label: "People", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/funds", label: "Funds", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { href: "/news", label: "News", icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6m4-4h-1v4m-1-4h4m-4-4h1v4" },
  { href: "/calendar", label: "Calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isPeopleSection = pathname.startsWith("/people");
  const isFundsSection = pathname.startsWith("/funds");

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-56 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center border-b border-border px-5">
        <span className="text-lg font-semibold tracking-tight text-foreground">
          Flow Terminal
        </span>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : item.href === "/people" ? isPeopleSection : item.href === "/funds" ? isFundsSection : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active ? "true" : undefined}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent-muted/40 hover:text-foreground data-[active]:bg-accent-muted data-[active]:text-accent"
            >
              <svg
                className="h-5 w-5 shrink-0 text-foreground/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={item.icon}
                />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <div className="rounded border border-border/70 px-3 py-2 text-xs text-foreground/50">
          Prototype · Mock data
        </div>
      </div>
    </aside>
  );
}
