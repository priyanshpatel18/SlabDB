import { describe, expect, test } from "bun:test";
import {
  MIN_ACCOUNT_LAMPORTS,
  MIN_ACCOUNT_SOL,
  isAccountFunded,
  remainingAccountSol,
} from "@/lib/account-fund";

describe("isAccountFunded", () => {
  test("is false until the wallet holds 1.5 SOL", () => {
    expect(isAccountFunded(null)).toBe(false);
    expect(isAccountFunded(0)).toBe(false);
    expect(isAccountFunded(1_000_000_000)).toBe(false);
    expect(isAccountFunded(MIN_ACCOUNT_LAMPORTS - 1)).toBe(false);
    expect(isAccountFunded(MIN_ACCOUNT_LAMPORTS)).toBe(true);
    expect(isAccountFunded(2_000_000_000)).toBe(true);
  });
});

describe("remainingAccountSol", () => {
  test("returns the SOL still required", () => {
    expect(remainingAccountSol(null)).toBe(MIN_ACCOUNT_SOL);
    expect(remainingAccountSol(0)).toBe(MIN_ACCOUNT_SOL);
    expect(remainingAccountSol(1_000_000_000)).toBe(0.5);
    expect(remainingAccountSol(MIN_ACCOUNT_LAMPORTS)).toBe(0);
  });
});
