"use client";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
  className?: string;
}

export default function Sparkline({
  data,
  width = 120,
  height = 36,
  positive = true,
  className = "",
}: SparklineProps) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;
  const stepX = w / (data.length - 1);

  const points = data.map((v, i) => {
    const x = padding + i * stepX;
    const y = padding + h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const pathD = `M ${points.join(" L ")}`;
  const color = positive ? "var(--color-positive)" : "var(--color-negative)";

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
