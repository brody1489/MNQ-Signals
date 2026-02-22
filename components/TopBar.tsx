"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import GlobalSearch from "@/components/GlobalSearch";
import AlertsDropdown from "@/components/AlertsDropdown";
import NavDropdown from "@/components/NavDropdown";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/flow", label: "Flow" },
  { href: "/news", label: "News" },
  { href: "/people", label: "People" },
  { href: "/funds", label: "Funds" },
];

const calendarItems = [
  { href: "/calendar", label: "Earnings & Dividends" },
  { href: "/calendar/economic", label: "Economic Calendar" },
];

export default function TopBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90">
      <div className="flex h-14 items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="shrink-0 font-mono text-base font-semibold tracking-tight text-foreground"
          >
            FLOW
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-accent/15 text-accent"
                      : "text-foreground/70 hover:bg-border/50 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <NavDropdown label="Calendar" items={calendarItems} />
            <Link
              href="/scanners"
              className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                pathname.startsWith("/scanners")
                  ? "bg-accent/15 text-accent"
                  : "text-foreground/70 hover:bg-border/50 hover:text-foreground"
              }`}
            >
              Scanners
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-80">
            <GlobalSearch />
          </div>
          <AlertsDropdown />
          <Link
            href="/settings"
            className="rounded p-2 text-foreground/60 hover:bg-border/50 hover:text-foreground transition-colors"
            aria-label="Settings"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
