"use client";

import type { CSSProperties } from "react";
import { cn } from "cn";
import { pfpSrc } from "@/lib/profile";

export function Pfp({
  id,
  alt = "",
  size,
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
        size == null && !className && "size-8",
        className
      )}
      style={
        size != null ? { width: size, height: size, ...style } : style
      }
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
