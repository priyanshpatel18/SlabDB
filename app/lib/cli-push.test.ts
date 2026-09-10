import { describe, expect, test } from "bun:test";
import { TEXT_MAX_BYTES } from "slabdb";
import { CLI_PUSH_MAX_FILES, parseCliPush } from "@/lib/cli-push";

function errStatus(fn: () => unknown): { status?: number; message: string } {
  try {
    fn();
  } catch (err) {
    return {
      status: (err as { status?: number }).status,
      message: err instanceof Error ? err.message : String(err),
    };
  }
  throw new Error("expected parseCliPush to throw");
}

function validPush(overrides?: Record<string, unknown>) {
  return {
    uid: "Ada",
    repo: "hello-web",
    commit: {
      id: "DEADBEEF",
      parent: null,
      message: "  Initial commit  ",
      created_at: "2026-09-10T12:00:00.000Z",
      author: "Ada",
      files: [{ path: "README.md", body: "# hello\n" }],
    },
    ...overrides,
  };
}

describe("parseCliPush", () => {
  test("normalizes a valid payload", () => {
    const packed = parseCliPush(validPush());
    expect(packed.uid).toBe("ada");
    expect(packed.repo).toBe("hello-web");
    expect(packed.commit).toMatchObject({
      id: "deadbeef",
      parent: null,
      message: "Initial commit",
      created_at: "2026-09-10T12:00:00.000Z",
      author: "ada",
    });
    expect(packed.commit.files).toEqual([{ path: "README.md", body: "# hello\n" }]);
  });

  test("allows .about", () => {
    const packed = parseCliPush(
      validPush({
        commit: {
          id: "deadbeef",
          parent: "cafebabe",
          message: "about",
          created_at: "2026-09-10T12:00:00.000Z",
          files: [{ path: ".about", body: "A Slab repo" }],
        },
      })
    );
    expect(packed.commit.parent).toBe("cafebabe");
    expect(packed.commit.files[0]?.path).toBe(".about");
  });

  test("rejects home and reserved tables", () => {
    expect(errStatus(() => parseCliPush(validPush({ repo: "home" })))).toEqual({
      status: 400,
      message: "uid, repo, and commit are required",
    });
    expect(errStatus(() => parseCliPush(validPush({ repo: "profile" })))).toEqual({
      status: 400,
      message: "uid, repo, and commit are required",
    });
  });

  test("rejects a bad commit id", () => {
    const body = validPush();
    (body.commit as { id: string }).id = "nope";
    expect(errStatus(() => parseCliPush(body))).toEqual({
      status: 400,
      message: "Commit id must be 8 hex characters",
    });
  });

  test("rejects .history paths", () => {
    const body = validPush();
    (body.commit as { files: { path: string; body: string }[] }).files = [
      { path: ".history/deadbeef.json", body: "{}" },
    ];
    expect(errStatus(() => parseCliPush(body)).message).toBe(
      "That path is reserved"
    );
  });

  test("rejects an empty file list", () => {
    const body = validPush();
    (body.commit as { files: unknown[] }).files = [];
    expect(errStatus(() => parseCliPush(body))).toEqual({
      status: 400,
      message: "Commit has no files",
    });
  });

  test("rejects too many files", () => {
    const body = validPush();
    (body.commit as { files: { path: string; body: string }[] }).files = Array.from(
      { length: CLI_PUSH_MAX_FILES + 1 },
      (_, i) => ({ path: `f${i}.md`, body: "x" })
    );
    expect(errStatus(() => parseCliPush(body)).message).toBe(
      `Commit can have at most ${CLI_PUSH_MAX_FILES} files`
    );
  });

  test("rejects a body over 4 KiB", () => {
    const body = validPush();
    (body.commit as { files: { path: string; body: string }[] }).files = [
      { path: "big.md", body: "x".repeat(TEXT_MAX_BYTES + 1) },
    ];
    expect(errStatus(() => parseCliPush(body)).message).toBe(
      `big.md is longer than ${TEXT_MAX_BYTES} bytes`
    );
  });

  test("rejects a missing created_at", () => {
    const body = validPush();
    (body.commit as { created_at?: string }).created_at = "not-a-date";
    expect(errStatus(() => parseCliPush(body))).toEqual({
      status: 400,
      message: "Commit created_at must be an ISO date",
    });
  });

  test("rejects a blank message", () => {
    const body = validPush();
    (body.commit as { message: string }).message = "   ";
    expect(errStatus(() => parseCliPush(body)).message).toBe(
      "Commit message is required"
    );
  });
});
