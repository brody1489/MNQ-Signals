"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}
interface NavDropdownProps {
  label: string;
  items: NavItem[];
}

export default function NavDropdown({ label, items }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isActive = items.some((i) => pathname.startsWith(i.href));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      className="relative"
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-0.5 rounded px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? "bg-accent/15 text-accent" : "text-foreground/70 hover:bg-border/50 hover:text-foreground"
        }`}
      >
        {label}
        <svg className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 pt-0.5 min-w-[180px]">
          <div className="rounded border border-border bg-card py-1 shadow-xl">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2 text-sm hover:bg-accent-muted/50 hover:text-accent ${
                  pathname.startsWith(item.href) ? "bg-accent-muted/30 text-accent" : "text-foreground/90"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
