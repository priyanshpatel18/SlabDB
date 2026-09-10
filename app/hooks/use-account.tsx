"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useSlabWallet } from "@/hooks/use-slab-wallet";
import type { SlabSigner } from "@/lib/wallet";
import { HOME_REPO } from "@/lib/cluster";
import { openHome, saveReadme, type HomeState } from "@/lib/home";
import {
  ensureProfileTable,
  loadProfile,
  saveProfile,
  type Profile,
  type ProfileDraft,
} from "@/lib/profile";
import { readProfileCache, writeProfileCache, writeReadmeCache } from "@/lib/profile-cache";
import { claimUsername } from "@/lib/username";
import { isAccountFunded } from "@/lib/account-fund";
import { loadSolLamports } from "@/lib/wallet-holdings";

function asSigner(
  wallet: ReturnType<typeof useSlabWallet>
): SlabSigner | null {
  if (!wallet.publicKey || !wallet.connected) {
    return null;
  }
  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
    signMessage: wallet.signMessage,
  };
}

type AccountValue = {
  signer: SlabSigner | null;
  home: HomeState | null;
  setHome: (next: HomeState | null) => void;
  profile: Profile | null;
  solLamports: number | null;
  funded: boolean;
  busy: boolean;
  status: string;
  error: string | null;
  retry: () => void;
  refreshSol: () => void;
  save: (draft: ProfileDraft) => Promise<void>;
  commitReadme: (body: string) => Promise<void>;
};

const AccountContext = createContext<AccountValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const wallet = useSlabWallet();
  const signer = useMemo(() => asSigner(wallet), [wallet]);
  const signerId = signer?.publicKey.toBase58() ?? "";

  const [home, setHome] = useState<HomeState | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() =>
    signerId ? readProfileCache(signerId) : null
  );
  const [solLamports, setSolLamports] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bootKey, setBootKey] = useState(0);
  const [boundId, setBoundId] = useState(signerId);

  if (signerId && signerId !== boundId) {
    setBoundId(signerId);
    setHome(null);
    setProfile(readProfileCache(signerId));
    setSolLamports(null);
    setStatus("");
    setError(null);
    setBusy(false);
  }

  useEffect(() => {
    if (!signerId) {
      return;
    }
    let cancelled = false;
    const pull = () => {
      void loadSolLamports(signerId).then(
        (lamports) => {
          if (!cancelled) {
            setSolLamports(lamports);
          }
        },
        () => {
          if (!cancelled) {
            setSolLamports(0);
          }
        }
      );
    };
    pull();
    const id = window.setInterval(pull, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [signerId]);

  const funded = isAccountFunded(solLamports);

  useEffect(() => {
    if (!signer || !funded) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next = await openHome(signer, (msg) => {
          if (!cancelled) {
            setStatus(msg);
          }
        });
        if (cancelled) {
          return;
        }
        await ensureProfileTable(next.session.db, (msg) => {
          if (!cancelled) {
            setStatus(msg);
          }
        });
        const row = await loadProfile(next.session.db);
        if (cancelled) {
          return;
        }
        setHome(next);
        if (row) {
          writeProfileCache(signerId, row);
          writeReadmeCache(row.uid, next.readme, signerId);
          setProfile(row);
        } else {
          const cached = readProfileCache(signerId);
          setProfile(cached);
          if (cached?.uid) {
            writeReadmeCache(cached.uid, next.readme, signerId);
          }
        }
        setStatus("");
        setError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setHome(null);
        setProfile(readProfileCache(signerId));
        setError(err instanceof Error ? err.message : "Could not open home");
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signer, signerId, funded, bootKey]);

  const retry = useCallback(() => {
    setHome(null);
    setProfile(signerId ? readProfileCache(signerId) : null);
    setError(null);
    setBusy(true);
    setBootKey((n) => n + 1);
  }, [signerId]);

  const refreshSol = useCallback(() => {
    if (!signerId) {
      return;
    }
    void loadSolLamports(signerId).then(
      (lamports) => setSolLamports(lamports),
      () => setSolLamports(0)
    );
  }, [signerId]);

  const save = useCallback(
    async (draft: ProfileDraft) => {
      if (!signer || !home) {
        throw new Error("Sign in first");
      }
      const next = await saveProfile(home.session, signer, draft, setStatus, {
        readme: home.active === HOME_REPO ? home.readme : "",
      });
      writeProfileCache(signer.publicKey.toBase58(), next);
      setProfile(next);
      setStatus("");
    },
    [home, signer]
  );

  const commitReadme = useCallback(
    async (body: string) => {
      if (!signer || !home) {
        throw new Error("Sign in first");
      }
      const saved = await saveReadme(home.session, HOME_REPO, body, setStatus);
      setHome({ ...home, readme: saved, active: HOME_REPO });
      if (profile) {
        writeReadmeCache(profile.uid, saved, signer.publicKey.toBase58());
        await claimUsername(signer, profile, { readme: saved }, setStatus);
      }
      setStatus("");
    },
    [home, profile, signer]
  );

  const value = useMemo<AccountValue>(
    () => ({
      signer,
      home,
      setHome,
      profile,
      solLamports,
      funded,
      busy: Boolean(signer) && funded && !home && !error ? true : busy,
      status,
      error,
      retry,
      refreshSol,
      save,
      commitReadme,
    }),
    [
      busy,
      commitReadme,
      error,
      funded,
      home,
      profile,
      refreshSol,
      retry,
      save,
      signer,
      solLamports,
      status,
    ]
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

export function useAccount(): AccountValue {
  const ctx = useContext(AccountContext);
  if (!ctx) {
    throw new Error("useAccount must be used in AccountProvider");
  }
  return ctx;
}

export function solAmount(lamports: number | null): number | null {
  if (lamports == null) {
    return null;
  }
  return lamports / LAMPORTS_PER_SOL;
}
