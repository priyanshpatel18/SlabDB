"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAccessToken } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { useSlabWallet } from "@/hooks/use-slab-wallet";
import { privyConfigured } from "@/lib/privy-config";

function callbackUrl(port: number): string {
  return `http://127.0.0.1:${port}/callback`;
}

export function CliLogin() {
  const params = useSearchParams();
  const wallet = useSlabWallet();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);

  const port = Number(params.get("port") || "");
  const nonce = (params.get("nonce") || "").trim();
  const valid = Number.isInteger(port) && port > 1024 && port < 65536 && nonce.length >= 16;

  const target = useMemo(() => (valid ? callbackUrl(port) : ""), [port, valid]);

  async function sendToken() {
    if (!valid || !target) {
      setError("Open this page from slab login.");
      return;
    }
    setError("");
    setStatus("Sending token to the CLI");
    const access = await getAccessToken();
    if (!access) {
      setError("Privy session expired. Sign in again.");
      setStatus("");
      return;
    }
    setToken(access);
    if (wallet.agentAvailable && !wallet.agentEnabled) {
      try {
        await wallet.enableAgent();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Turn on Agent in the wallet menu, then try again"
        );
        setStatus("");
        return;
      }
    }
    try {
      const res = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: access, nonce }),
      });
      if (!res.ok) {
        throw new Error("CLI did not accept the token");
      }
      setSent(true);
      setStatus("You can close this window.");
    } catch {
      setError(
        "Could not reach the CLI. Paste this token in the terminal: slab login --token <token>"
      );
      setStatus("");
    }
  }

  if (!privyConfigured()) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">CLI login</h1>
        <p className="text-sm text-muted-foreground">
          Set NEXT_PUBLIC_PRIVY_APP_ID to enable sign-in.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">CLI login</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Sign in with the same Slab account you use on the site. The CLI receives
        a user token. The server signing key never leaves the server.
      </p>
      {!valid ? (
        <p className="text-sm text-destructive">
          Open this page from <span className="font-mono">slab login</span>.
        </p>
      ) : null}
      {!wallet.connected ? (
        <Button
          type="button"
          className="min-h-10 w-fit"
          disabled={!wallet.ready || wallet.connecting}
          onClick={() => wallet.login()}
        >
          {wallet.connecting ? "Signing in" : "Sign in to Slab"}
        </Button>
      ) : sent ? (
        <p className="text-sm text-foreground">{status}</p>
      ) : (
        <Button
          type="button"
          className="min-h-10 w-fit"
          onClick={() => void sendToken()}
        >
          Send token to CLI
        </Button>
      )}
      {status && !sent ? (
        <p className="text-sm text-muted-foreground">{status}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {token && error ? (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Token</span>
          <textarea
            readOnly
            value={token}
            className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs"
          />
        </label>
      ) : null}
    </div>
  );
}
