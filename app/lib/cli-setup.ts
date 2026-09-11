import { repoHref } from "@/lib/files";

export const CLI_FIRST_COMMIT = "first commit";

export function repoRemoteUrl(origin: string, uid: string, repo: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${repoHref(uid, repo)}`;
}

export function newRepoCliCommands(remote: string, repo: string): string {
  return [
    `echo "# ${repo}" >> README.md`,
    `slab init ${repo}`,
    "slab add .",
    `slab commit -m "${CLI_FIRST_COMMIT}"`,
    `slab remote add ${remote}`,
    "slab push",
  ].join("\n");
}

export function existingRepoCliCommands(remote: string): string {
  return [
    `slab remote add ${remote}`,
    "slab add .",
    `slab commit -m "${CLI_FIRST_COMMIT}"`,
    "slab push",
  ].join("\n");
}
