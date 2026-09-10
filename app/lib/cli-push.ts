import { TEXT_MAX_BYTES } from "slabdb";
import { HOME_REPO } from "@/lib/cluster";
import {
  ABOUT_PATH,
  assertFilePath,
  isRepoName,
  isUserRepo,
  parseRepoParam,
  utf8Bytes,
} from "@/lib/files";
import {
  COMMIT_MESSAGE_MAX,
  isHistoryPath,
  normalizeCommitMessage,
} from "@/lib/history";

export const CLI_PUSH_MAX_FILES = 40;

export type CliPushFile = {
  path: string;
  body: string;
};

export type CliPushCommit = {
  id: string;
  parent: string | null;
  message: string;
  created_at: string;
  author: string;
  files: CliPushFile[];
};

const COMMIT_ID_RE = /^[a-f0-9]{8}$/;

function assertPushPath(raw: string): string {
  const path = raw.trim();
  if (path === ABOUT_PATH) {
    return path;
  }
  return assertFilePath(path);
}

export function parseCliPush(body: unknown): {
  uid: string;
  repo: string;
  commit: CliPushCommit;
} {
  const row = body as {
    uid?: unknown;
    repo?: unknown;
    commit?: {
      id?: unknown;
      parent?: unknown;
      message?: unknown;
      created_at?: unknown;
      author?: unknown;
      files?: unknown;
    };
  };
  const uid = typeof row?.uid === "string" ? row.uid.trim().toLowerCase() : "";
  const repo = parseRepoParam(typeof row?.repo === "string" ? row.repo : "");
  const commit = row?.commit;
  if (!uid || !repo || !commit) {
    throw Object.assign(new Error("uid, repo, and commit are required"), {
      status: 400,
    });
  }
  if (!isRepoName(repo) || !isUserRepo(repo) || repo === HOME_REPO) {
    throw Object.assign(new Error("Invalid repository name"), { status: 400 });
  }
  const id = typeof commit.id === "string" ? commit.id.trim().toLowerCase() : "";
  if (!COMMIT_ID_RE.test(id)) {
    throw Object.assign(new Error("Commit id must be 8 hex characters"), {
      status: 400,
    });
  }
  const parent =
    commit.parent === null || commit.parent === undefined
      ? null
      : typeof commit.parent === "string"
        ? commit.parent.trim().toLowerCase()
        : "";
  if (parent !== null && !COMMIT_ID_RE.test(parent)) {
    throw Object.assign(new Error("Commit parent must be 8 hex characters"), {
      status: 400,
    });
  }
  let message = "";
  try {
    message = normalizeCommitMessage(
      typeof commit.message === "string" ? commit.message : ""
    );
  } catch (err) {
    throw Object.assign(
      new Error(err instanceof Error ? err.message : "Commit message is required"),
      { status: 400 }
    );
  }
  if (message.length > COMMIT_MESSAGE_MAX) {
    throw Object.assign(new Error("Commit message is too long"), { status: 400 });
  }
  const created_at =
    typeof commit.created_at === "string" ? commit.created_at.trim() : "";
  if (!created_at || Number.isNaN(Date.parse(created_at))) {
    throw Object.assign(new Error("Commit created_at must be an ISO date"), {
      status: 400,
    });
  }
  const author =
    typeof commit.author === "string" ? commit.author.trim().toLowerCase() : uid;
  const rawFiles = Array.isArray(commit.files) ? commit.files : [];
  if (rawFiles.length === 0) {
    throw Object.assign(new Error("Commit has no files"), { status: 400 });
  }
  if (rawFiles.length > CLI_PUSH_MAX_FILES) {
    throw Object.assign(
      new Error(`Commit can have at most ${CLI_PUSH_MAX_FILES} files`),
      { status: 400 }
    );
  }
  const files: CliPushFile[] = rawFiles.map((file) => {
    const item = file as { path?: unknown; body?: unknown };
    const path = assertPushPath(typeof item.path === "string" ? item.path : "");
    if (isHistoryPath(path)) {
      throw Object.assign(new Error("Do not push .history files"), {
        status: 400,
      });
    }
    const fileBody = typeof item.body === "string" ? item.body : "";
    if (utf8Bytes(fileBody) > TEXT_MAX_BYTES) {
      throw Object.assign(
        new Error(`${path} is longer than ${TEXT_MAX_BYTES} bytes`),
        { status: 400 }
      );
    }
    return { path, body: fileBody };
  });
  return {
    uid,
    repo,
    commit: { id, parent, message, created_at, author, files },
  };
}
