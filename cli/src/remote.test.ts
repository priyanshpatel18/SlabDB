import { afterEach, describe, expect, test } from "bun:test";
import { parseRemote, parseRemoteUrl } from "./remote";

const prevApi = process.env.SLAB_API;

afterEach(() => {
  if (prevApi === undefined) {
    delete process.env.SLAB_API;
  } else {
    process.env.SLAB_API = prevApi;
  }
});

describe("parseRemote", () => {
  test("reads uid/repo", () => {
    expect(parseRemote("Ada/Hello-web")).toEqual({ uid: "ada", repo: "hello-web" });
  });

  test("defaults a missing repo to home", () => {
    expect(parseRemote("ada")).toEqual({ uid: "ada", repo: "home" });
  });

  test("rejects a bad username", () => {
    expect(() => parseRemote("1ada/hello")).toThrow("Clone target must be uid or uid/repo");
  });
});

describe("parseRemoteUrl", () => {
  test("reads a full Slab URL", () => {
    const remote = parseRemoteUrl(
      "https://slab.priyanshpatel.com/ada/hello-web"
    );
    expect(remote).toEqual({
      api: "https://slab.priyanshpatel.com",
      uid: "ada",
      repo: "hello-web",
      url: "https://slab.priyanshpatel.com/ada/hello-web",
    });
  });

  test("reads uid/repo against SLAB_API", () => {
    process.env.SLAB_API = "http://localhost:3000/";
    const remote = parseRemoteUrl("ada/hello-web");
    expect(remote.api).toBe("http://localhost:3000");
    expect(remote.uid).toBe("ada");
    expect(remote.repo).toBe("hello-web");
    expect(remote.url).toBe("http://localhost:3000/ada/hello-web");
  });

  test("rejects home, profile, and users", () => {
    expect(() => parseRemoteUrl("ada/home")).toThrow("Remote must be a user repository");
    expect(() => parseRemoteUrl("https://slab.priyanshpatel.com/ada/profile")).toThrow(
      "Remote must be a user repository"
    );
  });

  test("rejects a uid without a repo", () => {
    expect(() => parseRemoteUrl("ada")).toThrow(
      "Remote must be uid/repo or a full Slab URL"
    );
  });

  test("rejects a non-http URL", () => {
    expect(() => parseRemoteUrl("git://host/ada/hello-web")).toThrow(
      "Remote URL must be http or https"
    );
  });
});
