"use client";

import Link from "next/link";
import { openConsentBanner } from "@/hooks/use-consent";

const LINKS = [
  { href: "/docs/privacy", label: "Privacy" },
  { href: "/docs/terms", label: "Terms" },
  { href: "/docs/refunds", label: "Refunds" },
  { href: "/docs/cookies", label: "Cookies" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border px-4 py-4 pt-[max(1rem,env(safe-area-inset-bottom))]">
      <nav
        aria-label="Legal"
        className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 text-sm"
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="min-h-10 text-foreground/85 underline-offset-4 hover:text-kiln hover:underline focus-visible:underline sm:min-h-7"
          >
            {link.label}
          </Link>
        ))}
        <button
          type="button"
          className="min-h-10 text-left text-foreground/85 underline-offset-4 hover:text-kiln hover:underline focus-visible:underline sm:min-h-7"
          onClick={() => openConsentBanner()}
        >
          Cookie settings
        </button>
      </nav>
    </footer>
  );
}
