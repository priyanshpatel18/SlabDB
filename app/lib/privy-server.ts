import { PrivyClient } from "@privy-io/node";

let hold: PrivyClient | null = null;

export function privyServerConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_PRIVY_APP_ID &&
      process.env.PRIVY_APP_SECRET &&
      process.env.PRIVY_AUTHORIZATION_KEY
  );
}

export function privyServer(): PrivyClient {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Privy server env is missing");
  }
  if (!hold) {
    hold = new PrivyClient({ appId, appSecret });
  }
  return hold;
}

export function authorizationKey(): string {
  const key = process.env.PRIVY_AUTHORIZATION_KEY;
  if (!key) {
    throw new Error("PRIVY_AUTHORIZATION_KEY is missing");
  }
  return key.replace(/\\n/g, "\n");
}
