"use client";

interface PersonAvatarProps {
  name: string;
  role?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = { sm: 28, md: 40, lg: 56 };

export default function PersonAvatar({ name, role = "", size = "md", className = "" }: PersonAvatarProps) {
  const px = SIZE_MAP[size];
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const bgColor = `hsl(${hue}, 55%, 42%)`;

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-medium text-white ${className}`}
      style={{
        width: px,
        height: px,
        backgroundColor: bgColor,
        fontSize: px * 0.4,
      }}
      title={name}
    >
      {initials}
    </div>
  );
}
