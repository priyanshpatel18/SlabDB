// Minimum SOL before Slab creates the on-chain account.
export const MIN_ACCOUNT_SOL = 2;

// After the account exists, keep at least 1 SOL for fees.
export const MIN_KEEP_SOL = 1;

export const MIN_ACCOUNT_LAMPORTS = 2_000_000_000;
export const MIN_KEEP_LAMPORTS = 1_000_000_000;

const HOME_READY_KEY = "slab-home-ready:";

export function isAccountFunded(lamports: number | null | undefined): boolean {
  if (lamports == null) {
    return false;
  }
  return lamports >= MIN_ACCOUNT_LAMPORTS;
}

export function isKeepFunded(lamports: number | null | undefined): boolean {
  if (lamports == null) {
    return false;
  }
  return lamports >= MIN_KEEP_LAMPORTS;
}

export function remainingAccountSol(
  lamports: number | null | undefined,
  hasAccount = false
): number {
  const need = hasAccount ? MIN_KEEP_SOL : MIN_ACCOUNT_SOL;
  if (lamports == null) {
    return need;
  }
  const have = lamports / 1_000_000_000;
  return Math.max(0, need - have);
}

export function readHomeReady(wallet: string): boolean {
  if (!wallet || typeof localStorage === "undefined") {
    return false;
  }
  try {
    return localStorage.getItem(HOME_READY_KEY + wallet) === "1";
  } catch {
    return false;
  }
}

export function writeHomeReady(wallet: string) {
  if (!wallet || typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(HOME_READY_KEY + wallet, "1");
  } catch {
    return;
  }
}

// Create needs 2 SOL. After the account exists, only keep 1 SOL.
// A balance between 1 and 2 after rent means the account already exists.
export function needsCreateFund(
  lamports: number | null | undefined,
  hasAccount: boolean
): boolean {
  if (lamports == null) {
    return false;
  }
  if (hasAccount || (lamports >= MIN_KEEP_LAMPORTS && !isAccountFunded(lamports))) {
    return !isKeepFunded(lamports);
  }
  return !isAccountFunded(lamports);
}
