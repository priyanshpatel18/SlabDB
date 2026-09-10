import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertRepoName,
  findRoot,
  initRoot,
  loadConfig,
  repoRelPath,
  snapshotHash,
} from "./repo";

describe("assertRepoName", () => {
  test("accepts a GitHub-like name", () => {
    expect(assertRepoName("Hello-web")).toBe("hello-web");
  });

  test("rejects profile and users", () => {
    expect(() => assertRepoName("profile")).toThrow("profile is reserved");
    expect(() => assertRepoName("users")).toThrow("users is reserved");
  });

  test("rejects a trailing hyphen", () => {
    expect(() => assertRepoName("hello-")).toThrow("Repo name must start with a letter");
  });
});

describe("initRoot", () => {
  test("writes .slab/config.json and finds the root from a nested dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "slab-repo-"));
    try {
      initRoot(dir, "hello-web", "Owner111");
      const nested = join(dir, "src", "pages");
      mkdirSync(nested, { recursive: true });
      expect(findRoot(nested)).toBe(dir);
      expect(loadConfig(dir)).toMatchObject({
        ns: "home",
        repo: "hello-web",
        owner: "Owner111",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("repoRelPath", () => {
  test("returns a posix relative path", () => {
    const dir = mkdtempSync(join(tmpdir(), "slab-rel-"));
    try {
      initRoot(dir, "hello-web");
      const file = join(dir, "docs", "README.md");
      mkdirSync(join(dir, "docs"));
      writeFileSync(file, "# hi\n");
      expect(repoRelPath(dir, file)).toBe("docs/README.md");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rejects .slab", () => {
    const dir = mkdtempSync(join(tmpdir(), "slab-rel-"));
    try {
      initRoot(dir, "hello-web");
      expect(() => repoRelPath(dir, join(dir, ".slab", "config.json"))).toThrow(
        "Do not add .slab"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("snapshotHash", () => {
  test("is stable for the same files in any order", () => {
    const a = snapshotHash([
      { path: "b.md", body: "b" },
      { path: "a.md", body: "a" },
    ]);
    const b = snapshotHash([
      { path: "a.md", body: "a" },
      { path: "b.md", body: "b" },
    ]);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
