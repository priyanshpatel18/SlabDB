import { describe, expect, test } from "bun:test";
import {
  analyticsAllowed,
  defaultConsent,
  parseConsent,
} from "@/lib/consent";

describe("parseConsent", () => {
  test("accepts a stored choice", () => {
    expect(
      parseConsent({
        necessary: true,
        analytics: true,
        updatedAt: "2026-09-10T00:00:00.000Z",
      })
    ).toEqual({
      necessary: true,
      analytics: true,
      updatedAt: "2026-09-10T00:00:00.000Z",
    });
  });

  test("rejects a payload without necessary true", () => {
    expect(parseConsent({ analytics: true })).toBeNull();
    expect(parseConsent(null)).toBeNull();
  });
});

describe("analyticsAllowed", () => {
  test("is off until the user allows it", () => {
    expect(analyticsAllowed(null)).toBe(false);
    expect(analyticsAllowed(defaultConsent())).toBe(false);
    expect(
      analyticsAllowed({
        necessary: true,
        analytics: true,
        updatedAt: "2026-09-10T00:00:00.000Z",
      })
    ).toBe(true);
  });
});
