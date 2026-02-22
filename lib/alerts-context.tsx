"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type AlertRuleType =
  | "price_above"
  | "price_below"
  | "whale_flow"
  | "congress_trade"
  | "insider_trade"
  | "news_ticker"
  | "earnings_soon";

export interface AlertRule {
  id: string;
  type: AlertRuleType;
  ticker?: string;
  value?: number; // price or min size
  personId?: string;
  importance?: number;
  daysAhead?: number;
  enabled: boolean;
}

export interface TriggeredAlert {
  id: string;
  ruleId: string;
  type: AlertRuleType;
  ticker?: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const STORAGE_RULES = "flow-terminal-alert-rules";
const STORAGE_TRIGGERED = "flow-terminal-triggered-alerts";

function loadRules(): AlertRule[] {
  try {
    const s = localStorage.getItem(STORAGE_RULES);
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}

function saveRules(rules: AlertRule[]) {
  try {
    localStorage.setItem(STORAGE_RULES, JSON.stringify(rules));
  } catch {}
}

function loadTriggered(): TriggeredAlert[] {
  try {
    const s = localStorage.getItem(STORAGE_TRIGGERED);
    if (s) return JSON.parse(s);
  } catch {}
  return [
    { id: "a1", ruleId: "r1", type: "whale_flow", ticker: "NVDA", message: "$5.2M call flow", timestamp: new Date().toISOString(), read: false },
    { id: "a2", ruleId: "r2", type: "price_above", ticker: "AAPL", message: "Above $178", timestamp: new Date().toISOString(), read: false },
    { id: "a3", ruleId: "r3", type: "congress_trade", ticker: "MSFT", message: "Congress trade", timestamp: new Date().toISOString(), read: true },
  ];
}

function saveTriggered(alerts: TriggeredAlert[]) {
  try {
    localStorage.setItem(STORAGE_TRIGGERED, JSON.stringify(alerts));
  } catch {}
}

interface AlertsContextType {
  rules: AlertRule[];
  triggered: TriggeredAlert[];
  addRule: (rule: Omit<AlertRule, "id" | "enabled">) => void;
  removeRule: (id: string) => void;
  toggleRule: (id: string, enabled: boolean) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  unreadCount: number;
}

const AlertsContext = createContext<AlertsContextType | null>(null);

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [triggered, setTriggered] = useState<TriggeredAlert[]>([]);

  useEffect(() => {
    setRules(loadRules());
    setTriggered(loadTriggered());
  }, []);

  const addRule = useCallback((rule: Omit<AlertRule, "id" | "enabled">) => {
    const newRule: AlertRule = { ...rule, id: `r${Date.now()}`, enabled: true };
    setRules((prev) => {
      const next = [...prev, newRule];
      saveRules(next);
      return next;
    });
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveRules(next);
      return next;
    });
  }, []);

  const toggleRule = useCallback((id: string, enabled: boolean) => {
    setRules((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, enabled } : r));
      saveRules(next);
      return next;
    });
  }, []);

  const markRead = useCallback((id: string) => {
    setTriggered((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, read: true } : a));
      saveTriggered(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setTriggered((prev) => {
      const next = prev.map((a) => ({ ...a, read: true }));
      saveTriggered(next);
      return next;
    });
  }, []);

  const unreadCount = triggered.filter((a) => !a.read).length;

  return (
    <AlertsContext.Provider
      value={{ rules, triggered, addRule, removeRule, toggleRule, markRead, markAllRead, unreadCount }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used within AlertsProvider");
  return ctx;
}
