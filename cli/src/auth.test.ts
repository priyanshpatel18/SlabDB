import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearCredentials,
  credentialsPath,
  defaultApi,
  fetchCliMe,
  loadCredentials,
  pushCommit,
  saveCredentials,
} from "./auth";

const prevConfig = process.env.SLAB_CONFIG_DIR;
const prevApi = process.env.SLAB_API;

afterEach(() => {
  if (prevConfig === undefined) {
    delete process.env.SLAB_CONFIG_DIR;
  } else {
    process.env.SLAB_CONFIG_DIR = prevConfig;
  }
  if (prevApi === undefined) {
    delete process.env.SLAB_API;
  } else {
    process.env.SLAB_API = prevApi;
  }
});

describe("defaultApi", () => {
  test("uses SLAB_API and strips a trailing slash", () => {
    process.env.SLAB_API = "http://localhost:3000/";
    expect(defaultApi()).toBe("http://localhost:3000");
  });

  test("falls back to the public site", () => {
    delete process.env.SLAB_API;
    expect(defaultApi()).toBe("https://slab.priyanshpatel.com");
  });
});

describe("credentials", () => {
  test("saves, loads, and clears a user token", () => {
    const dir = mkdtempSync(join(tmpdir(), "slab-creds-"));
    process.env.SLAB_CONFIG_DIR = dir;
    try {
      expect(loadCredentials()).toBeNull();
      saveCredentials({
        api: "https://slab.priyanshpatel.com/",
        token: "tok",
        uid: "ada",
        wallet: "Wallet11111111111111111111111111111111111111",
        walletId: "wid",
      });
      expect(credentialsPath()).toBe(join(dir, "credentials.json"));
      const row = loadCredentials();
      expect(row).toEqual({
        api: "https://slab.priyanshpatel.com",
        token: "tok",
        uid: "ada",
        wallet: "Wallet11111111111111111111111111111111111111",
        walletId: "wid",
      });
      const raw = JSON.parse(readFileSync(credentialsPath(), "utf8")) as {
        token: string;
      };
      expect(raw.token).toBe("tok");
      clearCredentials();
      expect(loadCredentials()).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("fetchCliMe", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns uid, wallet, and walletId", async () => {
    globalThis.fetch = (async (input, init) => {
      expect(String(input)).toBe("https://slab.example/api/cli/me");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer tok");
      return new Response(
        JSON.stringify({
          uid: "ada",
          wallet: "W",
          walletId: "id1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;
    const me = await fetchCliMe("https://slab.example/", "tok");
    expect(me).toEqual({
      api: "https://slab.example",
      uid: "ada",
      wallet: "W",
      walletId: "id1",
    });
  });

  test("uses the server error text", async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ error: "Missing Slab login token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    await expect(fetchCliMe("https://slab.example", "bad")).rejects.toThrow(
      "Missing Slab login token"
    );
  });
});

describe("pushCommit", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("POSTs the commit with a bearer token", async () => {
    globalThis.fetch = (async (input, init) => {
      expect(String(input)).toBe("https://slab.example/api/cli/push");
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer tok");
      const body = JSON.parse(String(init?.body)) as { uid: string; repo: string };
      expect(body).toMatchObject({ uid: "ada", repo: "hello-web" });
      return new Response(
        JSON.stringify({
          ok: true,
          wrote: 2,
          id: "deadbeef",
          uid: "ada",
          repo: "hello-web",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;
    const result = await pushCommit("https://slab.example", "tok", {
      uid: "ada",
      repo: "hello-web",
      commit: {
        id: "deadbeef",
        parent: null,
        message: "Initial commit",
        created_at: "2026-09-10T12:00:00.000Z",
        author: "ada",
        files: [{ path: "README.md", body: "# hi\n" }],
      },
    });
    expect(result).toEqual({
      wrote: 2,
      id: "deadbeef",
      uid: "ada",
      repo: "hello-web",
    });
  });

  test("uses the server error text", async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ error: "You can only push to a repository you own" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;
    await expect(
      pushCommit("https://slab.example", "tok", {
        uid: "bob",
        repo: "hello-web",
        commit: {
          id: "deadbeef",
          parent: null,
          message: "x",
          created_at: "2026-09-10T12:00:00.000Z",
          author: "ada",
          files: [{ path: "README.md", body: "x" }],
        },
      })
    ).rejects.toThrow("You can only push to a repository you own");
  });
});
