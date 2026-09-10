import { describe, expect, test } from "bun:test";
import { extractOptions } from "./args";

describe("extractOptions", () => {
  test("keeps commands and flags apart", () => {
    const opts = extractOptions([
      "commit",
      "-m",
      "hello",
      "--api",
      "http://localhost:3000",
    ]);
    expect(opts.rest).toEqual(["commit"]);
    expect(opts.message).toBe("hello");
    expect(opts.api).toBe("http://localhost:3000");
  });

  test("reads equals flags", () => {
    const opts = extractOptions([
      "login",
      "--token=abc",
      "--api=https://slab.priyanshpatel.com",
    ]);
    expect(opts.rest).toEqual(["login"]);
    expect(opts.token).toBe("abc");
    expect(opts.api).toBe("https://slab.priyanshpatel.com");
  });

  test("rejects a flag without a value", () => {
    expect(() => extractOptions(["commit", "-m"])).toThrow("-m needs a value");
  });
});
