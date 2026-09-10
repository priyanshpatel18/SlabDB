"use client";

import type { CSSProperties } from "react";
import { cn } from "cn";
import { pfpSrc } from "@/lib/profile";

export function Pfp({
  id,
  alt = "",
  size = 32,
  className,
  style,
}: {
  id?: string;
  alt?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const src = id ? pfpSrc(id) : "";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 overflow-hidden rounded-full bg-muted",
        className
      )}
      style={{ width: size, height: size, ...style }}
      aria-hidden={!alt}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={alt}
          className="size-full object-cover"
        />
      ) : null}
    </span>
  );
}
