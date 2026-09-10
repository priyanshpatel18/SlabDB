"use client";

import { useEffect } from "react";
import { analyticsAllowed, readConsent } from "@/lib/consent";
import { CONSENT_EVENT } from "@/lib/consent";

// Optional analytics. No SDK loads until consent.analytics is true.
export function AnalyticsGate() {
  useEffect(() => {
    function sync() {
      if (!analyticsAllowed(readConsent())) {
        return;
      }
    }
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);
  return null;
}
