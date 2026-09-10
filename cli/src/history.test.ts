import { describe, expect, test } from "bun:test";
import { makeCommitId } from "./history";

describe("makeCommitId", () => {
  test("returns 8 lowercase hex characters", () => {
    const id = makeCommitId("hello-web:null:2026-09-10:msg:README.md");
    expect(id).toMatch(/^[a-f0-9]{8}$/);
  });

  test("is stable for the same seed", () => {
    const seed = "hello-web:null:2026-09-10:msg:README.md";
    expect(makeCommitId(seed)).toBe(makeCommitId(seed));
  });

  test("changes when the seed changes", () => {
    expect(makeCommitId("a")).not.toBe(makeCommitId("b"));
  });
});
