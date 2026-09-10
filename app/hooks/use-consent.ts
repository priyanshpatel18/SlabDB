"use client";

import { useSyncExternalStore } from "react";
import {
  CONSENT_EVENT,
  CONSENT_KEY,
  CONSENT_OPEN_EVENT,
  parseConsent,
  type ConsentChoice,
} from "@/lib/consent";

function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getConsentSnapshot(): string {
  try {
    return window.localStorage.getItem(CONSENT_KEY) ?? "";
  } catch {
    return "";
  }
}

function getHydratedSnapshot() {
  return true;
}

function getServerHydratedSnapshot() {
  return false;
}

export function useConsent(): {
  choice: ConsentChoice | null;
  ready: boolean;
} {
  const raw = useSyncExternalStore(subscribeConsent, getConsentSnapshot, () => "");
  const ready = useSyncExternalStore(
    () => () => {},
    getHydratedSnapshot,
    getServerHydratedSnapshot
  );
  let choice: ConsentChoice | null = null;
  if (raw) {
    try {
      choice = parseConsent(JSON.parse(raw) as unknown);
    } catch {
      choice = null;
    }
  }
  return { choice, ready };
}

export function openConsentBanner() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
