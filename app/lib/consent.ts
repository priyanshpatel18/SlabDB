export const CONSENT_KEY = "slab-consent-v1";
export const CONSENT_EVENT = "slab-consent";
export const CONSENT_OPEN_EVENT = "slab-consent-open";

export type ConsentChoice = {
  necessary: true;
  analytics: boolean;
  updatedAt: string;
};

export function defaultConsent(): ConsentChoice {
  return {
    necessary: true,
    analytics: false,
    updatedAt: "",
  };
}

export function parseConsent(raw: unknown): ConsentChoice | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as { necessary?: unknown; analytics?: unknown; updatedAt?: unknown };
  if (row.necessary !== true) {
    return null;
  }
  return {
    necessary: true,
    analytics: row.analytics === true,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  };
}

export function readConsent(): ConsentChoice | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) {
      return null;
    }
    return parseConsent(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeConsent(next: Omit<ConsentChoice, "updatedAt" | "necessary">): ConsentChoice {
  const choice: ConsentChoice = {
    necessary: true,
    analytics: Boolean(next.analytics),
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify(choice));
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
  return choice;
}

export function analyticsAllowed(choice: ConsentChoice | null): boolean {
  return Boolean(choice?.analytics);
}

export function trackEvent(name: string, props?: Record<string, string>): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!analyticsAllowed(readConsent())) {
    return;
  }
  void name;
  void props;
}
