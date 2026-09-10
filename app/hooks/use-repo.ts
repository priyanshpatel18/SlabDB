"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RelInfo } from "slabdb";
import { useAccount } from "@/hooks/use-account";
import { useSlabWallet } from "@/hooks/use-slab-wallet";
import { README_PATH } from "@/lib/cluster";
import type { RepoFileRow } from "@/lib/files";
import { normalizeCommitMessage, type CommitRecord } from "@/lib/history";
import { guestSigner } from "@/lib/guest-wallet";
import {
  deleteFile,
  deleteRepo,
  listRepoState,
  openCatalog,
  renameRepo,
  saveDescription,
  saveFile,
  userRepos,
  type HomeState,
} from "@/lib/home";
import type { CachedPublicProfile } from "@/lib/profile-cache";
import type { ChainSession } from "@/lib/session";
import { lookupUsername } from "@/lib/username";
import type { SlabSigner } from "@/lib/wallet";

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

export type UserCatalog = {
  uid: string;
  profile: CachedPublicProfile | null;
  session: ChainSession | null;
  repos: RelInfo[];
  own: boolean;
  loading: boolean;
  error: string | null;
  status: string;
};

export function useUserCatalog(uid: string): UserCatalog {
  const wallet = useSlabWallet();
  const account = useAccount();
  const signer = useMemo(() => asSigner(wallet), [wallet]);
  const guest = useMemo(() => guestSigner(), []);
  const [lookup, setLookup] = useState<{
    uid: string;
    profile: CachedPublicProfile | null;
    error: string | null;
  } | null>(null);
  const [foreign, setForeign] = useState<ChainSession | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const lookupDone = lookup?.uid === uid;
  const remote = lookupDone ? lookup.profile : null;
  const own = Boolean(
    (account.profile?.uid && account.profile.uid === uid) ||
      (wallet.address && lookupDone && remote?.wallet === wallet.address)
  );

  useEffect(() => {
    let cancelled = false;
    void lookupUsername(uid)
      .then((row) => {
        if (!cancelled) {
          setLookup({ uid, profile: row, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLookup({
            uid,
            profile: null,
            error: err instanceof Error ? err.message : "Could not load user",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (own) {
      return;
    }
    const owner = remote?.wallet;
    if (!owner || !lookupDone) {
      return;
    }
    const reader = signer ?? guest;
    let cancelled = false;
    void openCatalog(reader, owner, (msg) => {
      if (!cancelled) {
        setStatus(msg);
      }
    })
      .then((session) => {
        if (!cancelled) {
          setForeign(session);
          setCatalogError(null);
          setStatus("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setForeign(null);
          setCatalogError(
            err instanceof Error ? err.message : "Could not open catalog"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [guest, lookupDone, own, remote?.wallet, signer]);

  const session = own ? (account.home?.session ?? null) : foreign;
  const repos = userRepos(
    session?.rels ?? (own ? (account.home?.repos ?? []) : [])
  );
  const profile =
    own && account.profile?.uid === uid
      ? {
          ...account.profile,
          wallet: wallet.address ?? remote?.wallet ?? "",
          readme: account.home?.readme ?? remote?.readme ?? "",
        }
      : remote;

  const loading =
    !lookupDone ||
    Boolean(
      own && wallet.connected && !account.error && !account.home && account.busy
    ) ||
    Boolean(!own && remote?.wallet && !foreign && !catalogError);

  return {
    uid,
    profile,
    session,
    repos,
    own,
    loading,
    error: own
      ? account.error
      : lookupDone
        ? lookup.error || catalogError
        : catalogError,
    status: own ? account.status : status,
  };
}

export type RepoAccess = UserCatalog & {
  repo: string;
  files: RepoFileRow[];
  commits: CommitRecord[];
  description: string;
  website: string;
  found: boolean;
  writeFile: (path: string, body: string, message: string) => Promise<void>;
  removeFile: (path: string, message: string) => Promise<void>;
  writeAbout: (next: { description: string; website: string }) => Promise<void>;
  rename: (next: string) => Promise<string>;
  destroy: () => Promise<void>;
};

export function useRepo(uid: string, repo: string): RepoAccess {
  const account = useAccount();
  const catalog = useUserCatalog(uid);
  const [pack, setPack] = useState<{
    key: string;
    files: RepoFileRow[];
    commits: CommitRecord[];
    description: string;
    website: string;
    error: string | null;
  } | null>(null);

  const found = Boolean(
    catalog.session?.rels.some((rel) => rel.name === repo)
  );
  const key =
    catalog.session && found ? `${catalog.session.slab}:${repo}` : "";
  const files = pack?.key === key ? pack.files : [];
  const commits = pack?.key === key ? pack.commits : [];
  const description = pack?.key === key ? pack.description : "";
  const website = pack?.key === key ? pack.website : "";
  const fileError = pack?.key === key ? pack.error : null;

  useEffect(() => {
    const session = catalog.session;
    if (!session || !found) {
      return;
    }
    const nextKey = `${session.slab}:${repo}`;
    let cancelled = false;
    void listRepoState(session, repo)
      .then((state) => {
        if (!cancelled) {
          setPack({
            key: nextKey,
            files: state.files,
            commits: state.commits,
            description: state.description,
            website: state.website,
            error: null,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPack({
            key: nextKey,
            files: [],
            commits: [],
            description: "",
            website: "",
            error: err instanceof Error ? err.message : "Could not load files",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [catalog.session, found, repo]);

  const writeFile = useCallback(
    async (path: string, body: string, message: string) => {
      if (!catalog.own || !account.home) {
        throw new Error("Sign in as the owner to write");
      }
      const next = await saveFile(
        account.home.session,
        repo,
        path,
        body,
        () => {},
        { author: uid, message: normalizeCommitMessage(message) }
      );
      setPack({
        key: `${account.home.session.slab}:${repo}`,
        files: next.files,
        commits: next.commits,
        description: next.description,
        website: next.website,
        error: null,
      });
      account.setHome({
        ...account.home,
        active: repo,
        readme:
          repo === account.home.active && path === README_PATH
            ? body
            : account.home.readme,
      });
    },
    [account, catalog.own, repo, uid]
  );

  const removeFile = useCallback(
    async (path: string, message: string) => {
      if (!catalog.own || !account.home) {
        throw new Error("Sign in as the owner to write");
      }
      const next = await deleteFile(account.home.session, repo, path, () => {}, {
        author: uid,
        message: normalizeCommitMessage(message),
      });
      setPack({
        key: `${account.home.session.slab}:${repo}`,
        files: next.files,
        commits: next.commits,
        description: next.description,
        website: next.website,
        error: null,
      });
    },
    [account.home, catalog.own, repo, uid]
  );

  const writeAbout = useCallback(
    async (nextAbout: { description: string; website: string }) => {
      if (!catalog.own || !account.home) {
        throw new Error("Sign in as the owner to write");
      }
      const next = await saveDescription(account.home.session, repo, nextAbout);
      setPack({
        key: `${account.home.session.slab}:${repo}`,
        files: next.files,
        commits: next.commits,
        description: next.description,
        website: next.website,
        error: null,
      });
    },
    [account.home, catalog.own, repo]
  );

  const rename = useCallback(
    async (nextName: string) => {
      if (!catalog.own || !account.home) {
        throw new Error("Sign in as the owner to write");
      }
      const next = await renameRepo(account.home.session, repo, nextName);
      account.setHome(next);
      return next.active;
    },
    [account, catalog.own, repo]
  );

  const destroy = useCallback(async () => {
    if (!catalog.own || !account.home) {
      throw new Error("Sign in as the owner to write");
    }
    const next: HomeState = await deleteRepo(account.home.session, repo);
    account.setHome(next);
  }, [account, catalog.own, repo]);

  const filesLoading = Boolean(key && pack?.key !== key);

  return {
    ...catalog,
    repo,
    files,
    commits,
    description,
    website,
    found,
    loading: catalog.loading || filesLoading,
    error: fileError || catalog.error,
    writeFile,
    removeFile,
    writeAbout,
    rename,
    destroy,
  };
}
