import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  clearCredentials,
  defaultApi,
  fetchCliMe,
  loadCredentials,
  saveCredentials,
} from "./auth";

function openUrl(url: string) {
  const platform = process.platform;
  if (platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    return;
  }
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], {
      stdio: "ignore",
      detached: true,
    }).unref();
    return;
  }
  spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
}

export function allowedOrigins(api: string): Set<string> {
  const allowed = new Set([api]);
  try {
    const url = new URL(api);
    const port = url.port ? `:${url.port}` : "";
    if (url.hostname === "localhost") {
      allowed.add(`${url.protocol}//127.0.0.1${port}`);
    }
    if (url.hostname === "127.0.0.1") {
      allowed.add(`${url.protocol}//localhost${port}`);
    }
  } catch {
    /* Keep the API origin only. */
  }
  return allowed;
}

export function corsOrigin(origin: string | undefined, api: string): string {
  const allowed = allowedOrigins(api);
  if (origin && allowed.has(origin)) {
    return origin;
  }
  return api;
}

function waitForToken(opts: {
  api: string;
  nonce: string;
  timeoutMs: number;
}): Promise<{ token: string; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const origin = corsOrigin(
        typeof req.headers.origin === "string" ? req.headers.origin : undefined,
        opts.api
      );
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Max-Age", "600");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method !== "POST" || req.url !== "/callback") {
        res.writeHead(404);
        res.end();
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      req.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 24_000) {
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            token?: unknown;
            nonce?: unknown;
          };
          if (body.nonce !== opts.nonce || typeof body.token !== "string") {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Bad nonce" }));
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          const addr = server.address();
          const port = addr && typeof addr === "object" ? addr.port : 0;
          server.close();
          resolve({ token: body.token, port });
        } catch {
          res.writeHead(400);
          res.end();
        }
      });
    });
    const timer = setTimeout(() => {
      server.close();
      reject(new Error("Login timed out"));
    }, opts.timeoutMs);
    server.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        clearTimeout(timer);
        server.close();
        reject(new Error("Could not bind login port"));
        return;
      }
      const url = `${opts.api}/cli/login?port=${addr.port}&nonce=${opts.nonce}`;
      process.stdout.write(`Opening ${url}\n`);
      process.stdout.write("If the browser does not open, visit that URL.\n");
      process.stdout.write("Then click Sign in, then Send token to CLI.\n");
      try {
        openUrl(url);
      } catch {
        /* User can open the URL. */
      }
    });
    const done = () => clearTimeout(timer);
    server.on("close", done);
  });
}

export async function cmdLogin(opts: { api?: string; token?: string }) {
  const api = (opts.api || defaultApi()).replace(/\/+$/, "");
  let token = opts.token?.trim() || "";
  if (!token) {
    const nonce = randomBytes(16).toString("hex");
    const got = await waitForToken({ api, nonce, timeoutMs: 5 * 60_000 });
    token = got.token;
  }
  const me = await fetchCliMe(api, token);
  saveCredentials({ ...me, token });
  process.stdout.write(`Logged in as ${me.uid}\n`);
}

export async function cmdLogout() {
  const prev = loadCredentials();
  clearCredentials();
  process.stdout.write(
    prev?.uid ? `Logged out ${prev.uid}\n` : "Logged out\n"
  );
}
