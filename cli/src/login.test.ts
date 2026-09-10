import { describe, expect, test } from "bun:test";
import { allowedOrigins, corsOrigin } from "./login";

describe("login CORS", () => {
  test("allows localhost and 127.0.0.1 for the same port", () => {
    const allowed = allowedOrigins("http://localhost:3000");
    expect(allowed.has("http://localhost:3000")).toBe(true);
    expect(allowed.has("http://127.0.0.1:3000")).toBe(true);
  });

  test("echoes a matching Origin", () => {
    expect(corsOrigin("http://127.0.0.1:3000", "http://localhost:3000")).toBe(
      "http://127.0.0.1:3000"
    );
  });

  test("falls back to the API origin", () => {
    expect(corsOrigin("https://evil.example", "https://slab.priyanshpatel.com")).toBe(
      "https://slab.priyanshpatel.com"
    );
  });
});
