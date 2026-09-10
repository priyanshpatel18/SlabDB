import { describe, expect, test } from "bun:test";
import { handleCliMe, handleCliPush } from "@/lib/cli-api";
import type { CliIdentity } from "@/lib/cli-session";

const identity: CliIdentity = {
  userId: "did:privy:ada",
  walletId: "wallet_ada",
  wallet: "Ada11111111111111111111111111111111111111111",
  profile: {
    uid: "ada",
    name: "Ada",
    bio: "",
    website: "",
    pfp: "",
    links: ["", "", "", "", ""],
    wallet: "Ada11111111111111111111111111111111111111111",
    readme: "",
  },
};

function jsonReq(url: string, body: unknown, token = "tok"): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const validPush = {
  uid: "ada",
  repo: "hello-web",
  commit: {
    id: "deadbeef",
    parent: null,
    message: "Initial commit",
    created_at: "2026-09-10T12:00:00.000Z",
    author: "ada",
    files: [{ path: "README.md", body: "# hello\n" }],
  },
};

describe("GET /api/cli/me", () => {
  test("returns 503 when Privy is not configured", async () => {
    const res = await handleCliMe(new Request("http://slab.test/api/cli/me"), {
      privyReady: () => false,
      identity: async () => identity,
    });
    expect(await readJson(res)).toEqual({
      status: 503,
      body: { error: "CLI login is not configured" },
    });
  });

  test("returns 401 when the token is missing", async () => {
    const res = await handleCliMe(new Request("http://slab.test/api/cli/me"), {
      privyReady: () => true,
      identity: async () => {
        throw Object.assign(new Error("Missing Slab login token"), { status: 401 });
      },
    });
    expect(await readJson(res)).toEqual({
      status: 401,
      body: { error: "Missing Slab login token" },
    });
  });

  test("returns the logged-in profile", async () => {
    const res = await handleCliMe(new Request("http://slab.test/api/cli/me"), {
      privyReady: () => true,
      identity: async () => identity,
    });
    expect(await readJson(res)).toEqual({
      status: 200,
      body: {
        uid: "ada",
        name: "Ada",
        wallet: identity.wallet,
        walletId: "wallet_ada",
      },
    });
  });
});

describe("POST /api/cli/push", () => {
  test("returns 503 when the server is not ready", async () => {
    const res = await handleCliPush(jsonReq("http://slab.test/api/cli/push", validPush), {
      privyReady: () => true,
      irysReady: () => false,
      identity: async () => identity,
      assertOwns: async () => identity.profile,
      applyPush: async () => ({ wrote: 1, id: "deadbeef" }),
    });
    expect(await readJson(res)).toEqual({
      status: 503,
      body: { error: "CLI push is not configured on the server" },
    });
  });

  test("returns 400 for invalid JSON", async () => {
    const res = await handleCliPush(
      new Request("http://slab.test/api/cli/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
      {
        privyReady: () => true,
        irysReady: () => true,
        identity: async () => identity,
        assertOwns: async () => identity.profile,
        applyPush: async () => ({ wrote: 1, id: "deadbeef" }),
      }
    );
    expect(await readJson(res)).toEqual({
      status: 400,
      body: { error: "Invalid JSON" },
    });
  });

  test("returns 400 for a bad payload", async () => {
    const res = await handleCliPush(
      jsonReq("http://slab.test/api/cli/push", { uid: "ada" }),
      {
        privyReady: () => true,
        irysReady: () => true,
        identity: async () => identity,
        assertOwns: async () => identity.profile,
        applyPush: async () => ({ wrote: 1, id: "deadbeef" }),
      }
    );
    expect((await readJson(res)).status).toBe(400);
  });

  test("returns 403 when the remote uid is not the logged-in user", async () => {
    const res = await handleCliPush(
      jsonReq("http://slab.test/api/cli/push", { ...validPush, uid: "bob" }),
      {
        privyReady: () => true,
        irysReady: () => true,
        identity: async () => identity,
        assertOwns: async () => identity.profile,
        applyPush: async () => ({ wrote: 1, id: "deadbeef" }),
      }
    );
    expect(await readJson(res)).toEqual({
      status: 403,
      body: { error: "You can only push to a repository you own" },
    });
  });

  test("overwrites the author and applies the commit", async () => {
    let applied: { author?: string; repo?: string } = {};
    const res = await handleCliPush(
      jsonReq("http://slab.test/api/cli/push", {
        ...validPush,
        commit: { ...validPush.commit, author: "eve" },
      }),
      {
        privyReady: () => true,
        irysReady: () => true,
        identity: async () => identity,
        assertOwns: async () => identity.profile,
        applyPush: async (opts) => {
          applied = { author: opts.commit.author, repo: opts.repo };
          return { wrote: 1, id: opts.commit.id };
        },
      }
    );
    expect(applied).toEqual({ author: "ada", repo: "hello-web" });
    expect(await readJson(res)).toEqual({
      status: 200,
      body: {
        ok: true,
        wrote: 1,
        id: "deadbeef",
        uid: "ada",
        repo: "hello-web",
      },
    });
  });
});
