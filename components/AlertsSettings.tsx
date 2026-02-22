"use client";

import { useState } from "react";
import Link from "next/link";
import type { AlertRule, AlertRuleType } from "@/lib/alerts-context";
import { useAlerts } from "@/lib/alerts-context";
import { tickers } from "@/lib/mock-data";

const ALERT_TYPES: { value: AlertRuleType; label: string }[] = [
  { value: "price_above", label: "Price above" },
  { value: "price_below", label: "Price below" },
  { value: "whale_flow", label: "Whale flow over $" },
  { value: "congress_trade", label: "Congress trade on ticker" },
  { value: "insider_trade", label: "Insider/CEO trade on ticker" },
  { value: "news_ticker", label: "News mentioning ticker (min importance)" },
  { value: "earnings_soon", label: "Earnings in next N days" },
];

export default function AlertsSettings() {
  const { rules, addRule, removeRule, toggleRule } = useAlerts();
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<AlertRuleType>("price_above");
  const [newTicker, setNewTicker] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newImportance, setNewImportance] = useState(3);
  const [newDays, setNewDays] = useState(7);

  const handleAdd = () => {
    if (newType === "price_above" || newType === "price_below") {
      const v = parseFloat(newValue);
      if (!newTicker || isNaN(v)) return;
      addRule({ type: newType, ticker: newTicker.toUpperCase(), value: v });
    } else if (newType === "whale_flow") {
      const v = parseFloat(newValue);
      if (isNaN(v) || v <= 0) return;
      addRule({ type: newType, value: v });
    } else if (newType === "congress_trade" || newType === "insider_trade") {
      if (!newTicker.trim()) return;
      addRule({ type: newType, ticker: newTicker.toUpperCase() });
    } else if (newType === "news_ticker") {
      if (!newTicker.trim()) return;
      addRule({ type: newType, ticker: newTicker.toUpperCase(), importance: newImportance });
    } else if (newType === "earnings_soon") {
      addRule({ type: newType, daysAhead: newDays });
    }
    setAdding(false);
    setNewTicker("");
    setNewValue("");
    setNewImportance(3);
    setNewDays(7);
  };

  return (
    <div id="alerts" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">Notifications</h2>
          <p className="mt-0.5 text-xs text-foreground/60">
            Set alerts for price, flow, Congress, insiders, news, earnings
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          className="rounded border border-accent bg-accent-muted/30 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-muted/50"
        >
          {adding ? "Cancel" : "+ Add alert"}
        </button>
      </div>

      {adding && (
        <div className="rounded border border-border bg-card/50 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground/60 mb-1">Alert type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as AlertRuleType)}
              className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground"
            >
              {ALERT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {(newType === "price_above" || newType === "price_below" || newType === "congress_trade" || newType === "insider_trade" || newType === "news_ticker") && (
            <div>
              <label className="block text-xs font-medium text-foreground/60 mb-1">Ticker</label>
              <select
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="">Select…</option>
                {tickers.map((t) => (
                  <option key={t.symbol} value={t.symbol}>{t.symbol} — {t.name}</option>
                ))}
              </select>
            </div>
          )}
          {(newType === "price_above" || newType === "price_below") && (
            <div>
              <label className="block text-xs font-medium text-foreground/60 mb-1">Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="e.g. 150"
                className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
          )}
          {newType === "whale_flow" && (
            <div>
              <label className="block text-xs font-medium text-foreground/60 mb-1">Min size ($)</label>
              <input
                type="number"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="e.g. 1000000"
                className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
          )}
          {newType === "news_ticker" && (
            <div>
              <label className="block text-xs font-medium text-foreground/60 mb-1">Min importance (1–5)</label>
              <select
                value={newImportance}
                onChange={(e) => setNewImportance(Number(e.target.value))}
                className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
          {newType === "earnings_soon" && (
            <div>
              <label className="block text-xs font-medium text-foreground/60 mb-1">Days ahead</label>
              <select
                value={newDays}
                onChange={(e) => setNewDays(Number(e.target.value))}
                className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                {[1, 3, 5, 7, 14].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={handleAdd}
            className="rounded border border-accent bg-accent-muted px-4 py-2 text-sm font-medium text-accent hover:bg-accent-muted/70"
          >
            Add alert
          </button>
        </div>
      )}

      <div className="space-y-2">
        {rules.length === 0 ? (
          <p className="text-sm text-foreground/50">No alerts set. Add one above.</p>
        ) : (
          rules.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded border border-border bg-card px-4 py-2"
            >
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => toggleRule(r.id, e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground/90">
                    {ALERT_TYPES.find((t) => t.value === r.type)?.label}
                    {r.ticker && ` · ${r.ticker}`}
                    {r.value != null && ` · $${r.value >= 1_000_000 ? `${(r.value / 1_000_000).toFixed(0)}M` : r.value}`}
                    {r.importance != null && ` · importance ≥${r.importance}`}
                    {r.daysAhead != null && ` · ${r.daysAhead} days`}
                  </span>
                </label>
              </div>
              <button
                type="button"
                onClick={() => removeRule(r.id)}
                className="text-foreground/50 hover:text-negative text-sm"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
