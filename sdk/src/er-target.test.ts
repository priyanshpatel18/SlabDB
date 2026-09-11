import { describe, expect, test } from "bun:test";
import { PublicKey } from "@solana/web3.js";
import { normalizeErUrl, pickErUrl, remainingForValidator } from "./er-target";

describe("normalizeErUrl", () => {
  test("adds a trailing slash", () => {
    expect(normalizeErUrl("https://devnet-as.magicblock.app")).toBe(
      "https://devnet-as.magicblock.app/"
    );
    expect(normalizeErUrl("https://devnet-as.magicblock.app/")).toBe(
      "https://devnet-as.magicblock.app/"
    );
  });
});

describe("pickErUrl", () => {
  test("returns the FQDN for the delegated validator", () => {
    expect(
      pickErUrl("ValAs111111111111111111111111111111111111111", [
        {
          url: "https://devnet-eu.magicblock.app/",
          identity: "ValEu111111111111111111111111111111111111111",
        },
        {
          url: "https://devnet-as.magicblock.app/",
          identity: "ValAs111111111111111111111111111111111111111",
          fqdn: "https://devnet-as.magicblock.app",
        },
      ])
    ).toBe("https://devnet-as.magicblock.app/");
  });

  test("returns null when no endpoint matches", () => {
    expect(
      pickErUrl("missing", [
        {
          url: "https://devnet-as.magicblock.app/",
          identity: "ValAs111111111111111111111111111111111111111",
        },
      ])
    ).toBeNull();
  });
});

describe("remainingForValidator", () => {
  test("marks the validator identity read-only", () => {
    const identity = new PublicKey("11111111111111111111111111111111");
    expect(remainingForValidator(identity)).toEqual([
      { pubkey: identity, isSigner: false, isWritable: false },
    ]);
  });
});
