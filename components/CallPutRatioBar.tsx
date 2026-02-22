"use client";

interface CallPutRatioBarProps {
  callVolume: number;
  putVolume: number;
  className?: string;
  compact?: boolean;
  variant?: "default" | "quantview";
}

export default function CallPutRatioBar({
  callVolume,
  putVolume,
  className = "",
  compact = false,
  variant = "quantview",
}: CallPutRatioBarProps) {
  const total = callVolume + putVolume;
  const callPct = total === 0 ? 50 : (callVolume / total) * 100;
  const putPct = total === 0 ? 50 : (putVolume / total) * 100;

  const formatVol = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };

  if (variant === "quantview") {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {/* Bar: red (put) left, green (call) right - same visual weight as 52w range */}
        <div className="flex h-3 min-w-[140px] rounded-md overflow-hidden bg-foreground/10">
          <div
            className="h-full shrink-0"
            style={{
              width: `${putPct}%`,
              minWidth: putPct > 0 ? 6 : 0,
              backgroundColor: "var(--negative)",
            }}
          />
          <div
            className="h-full shrink-0"
            style={{
              width: `${callPct}%`,
              minWidth: callPct > 0 ? 6 : 0,
              backgroundColor: "var(--positive)",
            }}
          />
        </div>
        {!compact && (
          <div className="flex justify-between text-[10px] font-mono tabular-nums text-foreground/70 gap-4">
            <span className="text-negative">{formatVol(putVolume)} put</span>
            <span className="text-positive">{formatVol(callVolume)} call</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex h-2 min-w-[100px] rounded-full overflow-hidden bg-foreground/10">
        <div className="h-full bg-positive/70" style={{ width: `${callPct}%` }} />
        <div className="h-full bg-negative/70" style={{ width: `${putPct}%` }} />
      </div>
      {!compact && (
        <div className="flex justify-between text-xs text-foreground/60">
          <span className="text-positive">Calls {callPct.toFixed(0)}%</span>
          <span className="text-negative">Puts {putPct.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
