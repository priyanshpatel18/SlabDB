import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type CliCredentials = {
  api: string;
  token: string;
  uid: string;
  wallet: string;
  walletId: string;
};

export function defaultApi(): string {
  return (process.env.SLAB_API || "https://slab.priyanshpatel.com").replace(
    /\/+$/,
    ""
  );
}

export function credentialsPath(): string {
  return join(homedir(), ".config", "slab", "credentials.json");
}

export function loadCredentials(): CliCredentials | null {
  const path = credentialsPath();
  if (!existsSync(path)) {
    return null;
  }
  const row = JSON.parse(readFileSync(path, "utf8")) as Partial<CliCredentials>;
  if (!row.api || !row.token) {
    return null;
  }
  return {
    api: row.api.replace(/\/+$/, ""),
    token: row.token,
    uid: row.uid || "",
    wallet: row.wallet || "",
    walletId: row.walletId || "",
  };
}

export function saveCredentials(row: CliCredentials) {
  const path = credentialsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        api: row.api.replace(/\/+$/, ""),
        token: row.token,
        uid: row.uid,
        wallet: row.wallet,
        walletId: row.walletId,
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );
  try {
    chmodSync(path, 0o600);
  } catch {
    /* Windows may ignore chmod. */
  }
}

export function clearCredentials() {
  const path = credentialsPath();
  if (existsSync(path)) {
    rmSync(path);
  }
}

export async function fetchCliMe(
  api: string,
  token: string
): Promise<Omit<CliCredentials, "token">> {
  const res = await fetch(`${api.replace(/\/+$/, "")}/api/cli/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as {
    error?: string;
    uid?: string;
    wallet?: string;
    walletId?: string;
  };
  if (!res.ok) {
    throw new Error(body.error || `CLI login failed (${res.status})`);
  }
  if (!body.uid || !body.wallet || !body.walletId) {
    throw new Error("CLI login did not return a username");
  }
  return {
    api: api.replace(/\/+$/, ""),
    uid: body.uid,
    wallet: body.wallet,
    walletId: body.walletId,
  };
}

export async function pushCommit(
  api: string,
  token: string,
  body: {
    uid: string;
    repo: string;
    commit: {
      id: string;
      parent: string | null;
      message: string;
      created_at: string;
      author: string;
      files: { path: string; body: string }[];
    };
  }
): Promise<{ wrote: number; id: string; uid: string; repo: string }> {
  const res = await fetch(`${api.replace(/\/+$/, "")}/api/cli/push`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const row = (await res.json()) as {
    error?: string;
    wrote?: number;
    id?: string;
    uid?: string;
    repo?: string;
  };
  if (!res.ok) {
    throw new Error(row.error || `Push failed (${res.status})`);
  }
  return {
    wrote: row.wrote ?? 0,
    id: row.id || body.commit.id,
    uid: row.uid || body.uid,
    repo: row.repo || body.repo,
  };
}
