"use client";

interface RangeBar52wProps {
  low: number;
  high: number;
  current: number;
  className?: string;
  showLabels?: boolean;
}

export default function RangeBar52w({ low, high, current, className = "", showLabels = true }: RangeBar52wProps) {
  const range = high - low;
  const pct = range === 0 ? 0 : Math.max(0, Math.min(100, ((current - low) / range) * 100));
  const isNearHigh = pct >= 80;
  const isNearLow = pct <= 20;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showLabels && (
        <span className="shrink-0 font-mono text-xs tabular-nums text-foreground/70">
          ${low.toFixed(2)}
        </span>
      )}
      <div className="relative h-3 flex-1 min-w-[100px] rounded-full overflow-hidden">
        {/* Gradient bar: cool (low) to warm (high) */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: "linear-gradient(90deg, hsl(220, 60%, 50%), hsl(280, 50%, 55%), hsl(140, 55%, 50%))",
          }}
        />
        {/* Filled portion to current price */}
        <div
          className="absolute inset-y-0 left-0 rounded-l-full opacity-60"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, hsl(220, 60%, 45%), hsl(140, 55%, 45%))",
          }}
        />
        {/* Circular thumb indicator */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-card shadow-md ${
            isNearHigh ? "bg-positive" : isNearLow ? "bg-negative" : "bg-foreground"
          }`}
          style={{ left: `calc(${pct}% - 5px)` }}
        />
      </div>
      {showLabels && (
        <span className="shrink-0 font-mono text-xs tabular-nums text-foreground/70">
          ${high.toFixed(2)}
        </span>
      )}
    </div>
  );
}
