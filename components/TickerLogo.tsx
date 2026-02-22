"use client";

import { useState } from "react";
import { getTickerLogoUrl } from "@/lib/ticker-domains";

interface TickerLogoProps {
  symbol: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = { sm: 24, md: 36, lg: 48 };

export default function TickerLogo({ symbol, name = "", size = "md", className = "" }: TickerLogoProps) {
  const [errored, setErrored] = useState(false);
  const px = SIZE_MAP[size];
  const url = getTickerLogoUrl(symbol, px);

  if (errored || !url) {
    const initials = symbol.slice(0, 2).toUpperCase();
    const hue = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-md font-mono font-semibold text-white ${className}`}
        style={{
          width: px,
          height: px,
          backgroundColor: `hsl(${hue}, 55%, 45%)`,
          fontSize: px * 0.4,
        }}
        title={name}
      >
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={px}
      height={px}
      className={`shrink-0 rounded-md object-contain ${className}`}
      onError={() => setErrored(true)}
      style={{ minWidth: px, minHeight: px }}
    />
  );
}
