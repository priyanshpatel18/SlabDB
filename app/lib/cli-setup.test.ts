import { describe, expect, test } from "bun:test";
import {
  existingRepoCliCommands,
  newRepoCliCommands,
  repoRemoteUrl,
} from "@/lib/cli-setup";

describe("repoRemoteUrl", () => {
  test("joins origin and uid/repo", () => {
    expect(repoRemoteUrl("https://slab.priyanshpatel.com", "ada", "hello-web")).toBe(
      "https://slab.priyanshpatel.com/ada/hello-web"
    );
    expect(repoRemoteUrl("https://slab.priyanshpatel.com/", "ada", "hello-web")).toBe(
      "https://slab.priyanshpatel.com/ada/hello-web"
    );
  });
});

describe("newRepoCliCommands", () => {
  test("matches the GitHub-style create flow", () => {
    const remote = "https://slab.priyanshpatel.com/ada/hello-web";
    expect(newRepoCliCommands(remote, "hello-web")).toBe(
      [
        'echo "# hello-web" >> README.md',
        "slab init hello-web",
        "slab add .",
        'slab commit -m "first commit"',
        `slab remote add ${remote}`,
        "slab push",
      ].join("\n")
    );
  });
});

describe("existingRepoCliCommands", () => {
  test("matches the GitHub-style push flow", () => {
    const remote = "https://slab.priyanshpatel.com/ada/hello-web";
    expect(existingRepoCliCommands(remote)).toBe(
      [
        `slab remote add ${remote}`,
        "slab add .",
        'slab commit -m "first commit"',
        "slab push",
      ].join("\n")
    );
  });
});
