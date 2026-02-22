"use client";

import TerminalDashboard from "@/components/TerminalDashboard";

export default function DashboardPage() {
  return (
    <div className="flex h-[calc(100vh-6rem)] min-h-0 flex-col">
      <TerminalDashboard />
    </div>
  );
}
