// Minimum SOL in the embedded wallet before Slab will create an account.
export const MIN_ACCOUNT_SOL = 2;

// 2 SOL in lamports.
export const MIN_ACCOUNT_LAMPORTS = 2_000_000_000;

export function isAccountFunded(lamports: number | null | undefined): boolean {
  if (lamports == null) {
    return false;
  }
  return lamports >= MIN_ACCOUNT_LAMPORTS;
}

export function remainingAccountSol(lamports: number | null | undefined): number {
  if (lamports == null) {
    return MIN_ACCOUNT_SOL;
  }
  const have = lamports / 1_000_000_000;
  return Math.max(0, MIN_ACCOUNT_SOL - have);
}

// Rent for init is taken once. After home exists, do not keep the 2 SOL gate.
export function needsCreateFund(
  lamports: number | null | undefined,
  hasHome: boolean
): boolean {
  if (hasHome) {
    return false;
  }
  if (lamports == null) {
    return false;
  }
  return !isAccountFunded(lamports);
}
