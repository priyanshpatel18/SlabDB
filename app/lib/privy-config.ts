export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
export const PRIVY_CLIENT_ID = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? "";
// Key quorum id for the agent signer.
export const PRIVY_SIGNER_ID = process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID ?? "";
export const PRIVY_POLICY_ID = process.env.NEXT_PUBLIC_PRIVY_POLICY_ID ?? "";

export const PRIVY_ACCENT = "#e89058";

export function privyConfigured(): boolean {
  return PRIVY_APP_ID.length > 0;
}

export function agentSignerConfigured(): boolean {
  return PRIVY_SIGNER_ID.length > 0;
}
