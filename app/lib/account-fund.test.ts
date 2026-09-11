import { describe, expect, test } from "bun:test";
import {
  MIN_ACCOUNT_LAMPORTS,
  MIN_ACCOUNT_SOL,
  MIN_KEEP_LAMPORTS,
  MIN_KEEP_SOL,
  isAccountFunded,
  isKeepFunded,
  needsCreateFund,
  remainingAccountSol,
} from "@/lib/account-fund";

describe("isAccountFunded", () => {
  test("is false until the wallet holds 2 SOL", () => {
    expect(isAccountFunded(null)).toBe(false);
    expect(isAccountFunded(0)).toBe(false);
    expect(isAccountFunded(1_000_000_000)).toBe(false);
    expect(isAccountFunded(MIN_ACCOUNT_LAMPORTS - 1)).toBe(false);
    expect(isAccountFunded(MIN_ACCOUNT_LAMPORTS)).toBe(true);
  });
});

describe("isKeepFunded", () => {
  test("is false until the wallet holds 1 SOL", () => {
    expect(isKeepFunded(null)).toBe(false);
    expect(isKeepFunded(0)).toBe(false);
    expect(isKeepFunded(MIN_KEEP_LAMPORTS - 1)).toBe(false);
    expect(isKeepFunded(MIN_KEEP_LAMPORTS)).toBe(true);
    expect(isKeepFunded(1_117_900_000)).toBe(true);
  });
});

describe("remainingAccountSol", () => {
  test("returns SOL still required for create or keep", () => {
    expect(remainingAccountSol(null)).toBe(MIN_ACCOUNT_SOL);
    expect(remainingAccountSol(0)).toBe(MIN_ACCOUNT_SOL);
    expect(remainingAccountSol(1_000_000_000)).toBe(1);
    expect(remainingAccountSol(MIN_ACCOUNT_LAMPORTS)).toBe(0);
    expect(remainingAccountSol(null, true)).toBe(MIN_KEEP_SOL);
    expect(remainingAccountSol(500_000_000, true)).toBe(0.5);
    expect(remainingAccountSol(1_117_900_000, true)).toBe(0);
  });
});

describe("needsCreateFund", () => {
  test("after account exists, only requires 1 SOL", () => {
    expect(needsCreateFund(1_117_900_000, true)).toBe(false);
    expect(needsCreateFund(MIN_KEEP_LAMPORTS, true)).toBe(false);
    expect(needsCreateFund(MIN_KEEP_LAMPORTS - 1, true)).toBe(true);
    expect(needsCreateFund(0, true)).toBe(true);
  });

  test("before account, requires 2 SOL unless rent already left 1+ SOL", () => {
    expect(needsCreateFund(null, false)).toBe(false);
    expect(needsCreateFund(500_000_000, false)).toBe(true);
    expect(needsCreateFund(1_117_900_000, false)).toBe(false);
    expect(needsCreateFund(MIN_ACCOUNT_LAMPORTS, false)).toBe(false);
  });
});
