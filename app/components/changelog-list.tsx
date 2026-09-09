"use client";

import Link from "next/link";
import { CHANGELOG } from "@/lib/changelog";

export function ChangelogList({ compact }: { compact?: boolean }) {
  if (CHANGELOG.length === 0) {
    return (
      <p
        className={
          compact
            ? "mt-2 text-sm text-muted-foreground"
            : "px-4 py-6 text-sm text-muted-foreground"
        }
      >
        There is no changelog.
      </p>
    );
  }
  return (
    <ol className={compact ? "mt-2 flex flex-col gap-1" : "flex flex-col gap-1 p-3"}>
      {CHANGELOG.map((item) => (
        <li key={item.title}>
          <Link
            href={item.href}
            className="block rounded-md px-2 py-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {item.title}
          </Link>
        </li>
      ))}
    </ol>
  );
}
