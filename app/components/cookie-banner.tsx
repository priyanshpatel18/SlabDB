"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CONSENT_OPEN_EVENT,
  writeConsent,
} from "@/lib/consent";
import { useConsent } from "@/hooks/use-consent";

export function CookieBanner() {
  const { choice, ready } = useConsent();
  const [forced, setForced] = useState(false);

  useEffect(() => {
    const open = () => setForced(true);
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  const visible = ready && (forced || !choice);
  if (!visible) {
    return null;
  }

  function save(analytics: boolean) {
    writeConsent({ analytics });
    setForced(false);
  }

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      aria-labelledby="slab-cookie-title"
      aria-describedby="slab-cookie-copy"
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-border bg-card/95 p-4 pt-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_oklch(0.08_0.03_48/0.45)] backdrop-blur-sm"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 id="slab-cookie-title" className="text-sm font-medium text-foreground">
            Cookies
          </h2>
          <p id="slab-cookie-copy" className="mt-1 text-sm leading-relaxed text-foreground">
            Necessary cookies run Privy sign-in. Analytics stay off unless you
            allow them.{" "}
            <Link href="/cookies" className="text-kiln underline underline-offset-4 hover:text-foreground">
              Cookie Policy
            </Link>
            {" · "}
            <Link href="/privacy" className="text-kiln underline underline-offset-4 hover:text-foreground">
              Privacy
            </Link>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-w-40"
            onClick={() => save(false)}
          >
            Necessary only
          </Button>
          <Button
            type="button"
            className="h-11 min-w-40"
            onClick={() => save(true)}
          >
            Allow analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
