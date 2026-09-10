"use client";

import Link from "next/link";
import { openConsentBanner } from "@/hooks/use-consent";

const LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refunds", label: "Refunds" },
  { href: "/cookies", label: "Cookies" },
] as const;

const itemClass =
  "inline-flex h-14 items-center text-sm text-foreground/85 underline-offset-4 hover:text-kiln hover:underline focus-visible:underline";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border pt-[env(safe-area-inset-bottom)]">
      <nav
        aria-label="Legal"
        className="flex h-14 w-full min-w-0 flex-wrap items-center justify-center gap-x-4 px-4"
      >
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={itemClass}>
            {link.label}
          </Link>
        ))}
        <button
          type="button"
          className={`${itemClass} border-0 bg-transparent p-0`}
          onClick={() => openConsentBanner()}
        >
          Cookie settings
        </button>
      </nav>
    </footer>
  );
}
