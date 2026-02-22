"use client";

import Link from "next/link";
import { useTheme } from "@/lib/ThemeContext";
import { useLayout } from "@/lib/LayoutContext";
import { LAYOUT_PRESETS } from "@/lib/LayoutContext";
import AlertsSettings from "@/components/AlertsSettings";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { applyPreset } = useLayout();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-foreground/60">
        <Link href="/" className="hover:text-accent hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="text-foreground">Settings</span>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="mt-0.5 text-sm text-foreground/60">Theme, layout, and display preferences</p>
      </div>

      <div className="max-w-xl space-y-6 border border-border bg-card p-6">
        <div>
          <h2 className="text-sm font-medium text-foreground">Theme</h2>
          <p className="mt-0.5 text-xs text-foreground/60">Choose light, dark, or follow system</p>
          <div className="mt-3 flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`rounded border px-4 py-2 text-sm capitalize ${
                  theme === t
                    ? "border-accent bg-accent-muted text-accent"
                    : "border-border bg-background/50 text-foreground/80 hover:border-foreground/30"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-foreground">Layout</h2>
          <p className="mt-0.5 text-xs text-foreground/60">Your widget layout is saved automatically. Apply a preset:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LAYOUT_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p.name)}
                className="rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground/80 hover:border-accent/50 hover:text-accent"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <AlertsSettings />

        <div>
          <h2 className="text-sm font-medium text-foreground">Prototype</h2>
          <p className="mt-0.5 text-xs text-foreground/60">Mock data · No real API connections</p>
        </div>
      </div>
    </div>
  );
}
