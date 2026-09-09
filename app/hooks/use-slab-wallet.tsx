"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PublicKey } from "@solana/web3.js";
import { useLogin, usePrivy, useSigners } from "@privy-io/react-auth";
import {
  useSignMessage,
  useSignTransaction,
  useWallets,
  type ConnectedStandardSolanaWallet,
} from "@privy-io/react-auth/solana";
import { toast } from "sonner";
import {
  agentSignerConfigured,
  PRIVY_POLICY_ID,
  PRIVY_SIGNER_ID,
  privyConfigured,
} from "@/lib/privy-config";
import {
  restoreSigned,
  serializeUnsigned,
  type SlabTx,
  type SlabWallet,
} from "@/lib/wallet";

const AGENT_KEY = "slab-agent:";

const empty: SlabWallet = {
  ready: false,
  connected: false,
  connecting: false,
  authenticated: false,
  publicKey: null,
  address: null,
  walletId: null,
  agentEnabled: false,
  agentAvailable: false,
  login: () => {},
  logout: async () => {},
  enableAgent: async () => {},
  signTransaction: async (tx) => tx,
  signAllTransactions: async (txs) => txs,
  signMessage: async () => new Uint8Array(),
};

const SlabWalletContext = createContext<SlabWallet>(empty);

function isPrivyEmbedded(wallet: ConnectedStandardSolanaWallet): boolean {
  const name = wallet.standardWallet?.name ?? "";
  return name === "Privy" || name.toLowerCase().includes("privy");
}

function readAgentFlag(address: string): boolean {
  try {
    return sessionStorage.getItem(AGENT_KEY + address) === "1";
  } catch {
    return false;
  }
}

function writeAgentFlag(address: string, on: boolean): void {
  try {
    if (on) {
      sessionStorage.setItem(AGENT_KEY + address, "1");
    } else {
      sessionStorage.removeItem(AGENT_KEY + address);
    }
  } catch {
    return;
  }
}

function embeddedAccount(user: ReturnType<typeof usePrivy>["user"]) {
  const accounts = user?.linkedAccounts ?? [];
  for (const account of accounts) {
    if (account.type !== "wallet") continue;
    if (account.chainType !== "solana") continue;
    if (
      account.walletClientType !== "privy" &&
      account.walletClientType !== "privy-v2"
    ) {
      continue;
    }
    return account;
  }
  return null;
}

async function agentSign(
  walletId: string,
  bytes: Uint8Array
): Promise<Uint8Array> {
  const { getAccessToken } = await import("@privy-io/react-auth");
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Privy session expired. Sign in again.");
  }
  const res = await fetch("/api/agent/sign", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      walletId,
      transaction: Buffer.from(bytes).toString("base64"),
    }),
  });
  const body = (await res.json()) as { error?: string; signed?: string };
  if (!res.ok || !body.signed) {
    throw new Error(body.error ?? "Agent could not sign");
  }
  return Uint8Array.from(Buffer.from(body.signed, "base64"));
}

function PrivyWalletBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, logout } = usePrivy();
  const { login } = useLogin();
  const { wallets, ready: walletsReady } = useWallets();
  const { signTransaction: privySignTx } = useSignTransaction();
  const { signMessage: privySignMsg } = useSignMessage();
  const { addSigners } = useSigners();
  const [agentOn, setAgentOn] = useState(false);
  const [walletIdOverride, setWalletIdOverride] = useState<string | null>(null);

  const solana = useMemo(() => {
    return wallets.find(isPrivyEmbedded) ?? wallets[0] ?? null;
  }, [wallets]);

  const account = useMemo(() => embeddedAccount(user), [user]);
  const address = solana?.address ?? account?.address ?? null;
  const publicKey = useMemo(() => {
    if (!address) return null;
    try {
      return new PublicKey(address);
    } catch {
      return null;
    }
  }, [address]);

  const walletId = walletIdOverride ?? account?.id ?? null;
  const agentAvailable = agentSignerConfigured();
  const agentEnabled = Boolean(
    address &&
      agentAvailable &&
      (agentOn || account?.delegated || readAgentFlag(address))
  );

  const signWithPrivy = useCallback(
    async (bytes: Uint8Array): Promise<Uint8Array> => {
      if (!solana) {
        throw new Error("No Privy embedded wallet");
      }
      const { signedTransaction } = await privySignTx({
        wallet: solana,
        transaction: bytes,
        chain: "solana:devnet",
        options: { uiOptions: { showWalletUIs: false } },
      });
      return signedTransaction;
    },
    [privySignTx, solana]
  );

  const signTransaction = useCallback(
    async <T extends SlabTx>(tx: T): Promise<T> => {
      const bytes = serializeUnsigned(tx);
      const signed =
        agentEnabled && walletId
          ? await agentSign(walletId, bytes)
          : await signWithPrivy(bytes);
      return restoreSigned(tx, signed);
    },
    [agentEnabled, signWithPrivy, walletId]
  );

  const signAllTransactions = useCallback(
    async <T extends SlabTx>(txs: T[]): Promise<T[]> => {
      const out: T[] = [];
      for (const tx of txs) {
        out.push(await signTransaction(tx));
      }
      return out;
    },
    [signTransaction]
  );

  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      if (!solana) {
        throw new Error("No Privy embedded wallet");
      }
      const { signature } = await privySignMsg({
        wallet: solana,
        message,
        options: { uiOptions: { showWalletUIs: false } },
      });
      return signature;
    },
    [privySignMsg, solana]
  );

  const enableAgent = useCallback(async () => {
    if (!address) {
      throw new Error("Sign in first");
    }
    if (!PRIVY_SIGNER_ID) {
      throw new Error(
        "Set NEXT_PUBLIC_PRIVY_SIGNER_ID to the Privy key quorum id"
      );
    }
    const { user: nextUser } = await addSigners({
      address,
      signers: [
        {
          signerId: PRIVY_SIGNER_ID,
          policyIds: PRIVY_POLICY_ID ? [PRIVY_POLICY_ID] : [],
        },
      ],
    });
    const nextAccount = embeddedAccount(nextUser);
    if (nextAccount?.id) {
      setWalletIdOverride(nextAccount.id);
    }
    writeAgentFlag(address, true);
    setAgentOn(true);
    toast.success("Agent signer is on this wallet");
  }, [addSigners, address]);

  const value = useMemo<SlabWallet>(() => {
    return {
      ready: ready && walletsReady,
      connected: Boolean(authenticated && publicKey),
      connecting: !ready,
      authenticated,
      publicKey: publicKey,
      address,
      walletId,
      agentEnabled,
      agentAvailable,
      login: () => login(),
      logout,
      enableAgent,
      signTransaction,
      signAllTransactions,
      signMessage,
    };
  }, [
    address,
    agentAvailable,
    agentEnabled,
    authenticated,
    enableAgent,
    login,
    logout,
    publicKey,
    ready,
    signAllTransactions,
    signMessage,
    signTransaction,
    walletId,
    walletsReady,
  ]);

  return (
    <SlabWalletContext.Provider value={value}>
      {children}
    </SlabWalletContext.Provider>
  );
}

export function SlabWalletProvider({ children }: { children: ReactNode }) {
  if (!privyConfigured()) {
    return (
      <SlabWalletContext.Provider value={empty}>
        {children}
      </SlabWalletContext.Provider>
    );
  }
  return <PrivyWalletBridge>{children}</PrivyWalletBridge>;
}

export function useSlabWallet(): SlabWallet {
  return useContext(SlabWalletContext);
}
