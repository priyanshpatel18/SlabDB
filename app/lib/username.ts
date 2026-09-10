"use client";

import { Buffer } from "buffer";
import { fundIrys, type StatusFn } from "slabdb/web";
import { IRYS_RPC_URL } from "@/lib/cluster";
import {
  localWalletForUid,
  readPublicCache,
  readReadmeCache,
  releaseLocalUid,
  writePublicCache,
  writeReadmeCache,
  type CachedPublicProfile,
} from "@/lib/profile-cache";
import type { Profile } from "@/lib/profile";
import {
  USERNAME_APP,
  USERNAME_FILE,
  isUsernameFormat,
  lookupUsernameRemote,
} from "@/lib/username-lookup";
import type { SlabSigner } from "@/lib/wallet";

function isIrysUnpaid(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /402|not enough funds|not enough balance/i.test(msg);
}

export async function lookupUsername(
  raw: string
): Promise<CachedPublicProfile | null> {
  const uid = raw.trim().toLowerCase();
  if (!isUsernameFormat(uid)) {
    return null;
  }
  const cached = readPublicCache(uid);
  try {
    const remote = await lookupUsernameRemote(uid);
    if (!remote) {
      return cached?.wallet ? cached : null;
    }
    const readme = remote.readme || cached?.readme || readReadmeCache(uid);
    if (readme) {
      writeReadmeCache(uid, readme, remote.wallet);
    }
    const next = { ...remote, readme };
    writePublicCache(next);
    return next;
  } catch {
    if (cached) {
      return cached;
    }
    const wallet = localWalletForUid(uid);
    if (!wallet) {
      return null;
    }
    return {
      uid,
      name: uid,
      bio: "",
      website: "",
      pfp: "",
      links: ["", "", "", "", ""],
      wallet,
      readme: "",
    };
  }
}

export async function assertUsernameFree(
  uid: string,
  wallet: string
): Promise<void> {
  const local = localWalletForUid(uid);
  if (local && local !== wallet) {
    throw new Error("Username is taken");
  }
  const claim = await lookupUsername(uid);
  if (claim && claim.wallet !== wallet) {
    throw new Error("Username is taken");
  }
}

async function irysUpload(
  wallet: SlabSigner,
  data: Buffer,
  tags: { name: string; value: string }[]
): Promise<void> {
  const { WebUploader } = await import("@irys/web-upload");
  const { WebSolana } = await import("@irys/web-upload-solana");
  const irys = await WebUploader(WebSolana)
    .withProvider(wallet as never)
    .withRpc(IRYS_RPC_URL)
    .withTokenOptions({ finality: "confirmed" })
    .timeout(60_000)
    .devnet();
  const receipt = await irys.upload(data, { tags });
  if (!receipt?.id) {
    throw new Error("Username claim returned no id");
  }
}

async function uploadClaim(
  wallet: SlabSigner,
  tags: { name: string; value: string }[],
  body: unknown,
  onStatus: StatusFn
) {
  const data = Buffer.from(JSON.stringify(body));
  try {
    await irysUpload(wallet, data, tags);
  } catch (err) {
    if (!isIrysUnpaid(err)) {
      throw err;
    }
    onStatus("Funding Irys");
    await fundIrys(wallet, onStatus);
    await irysUpload(wallet, data, tags);
  }
}

export async function claimUsername(
  wallet: SlabSigner,
  profile: Profile,
  extras: { readme: string; previousUid?: string },
  onStatus: StatusFn = () => {}
): Promise<CachedPublicProfile> {
  const address = wallet.publicKey.toBase58();
  await assertUsernameFree(profile.uid, address);
  const row: CachedPublicProfile = {
    ...profile,
    wallet: address,
    readme: extras.readme,
  };
  onStatus("Claiming username");
  await uploadClaim(
    wallet,
    [
      { name: "Content-Type", value: "application/json" },
      { name: "App-Name", value: USERNAME_APP },
      { name: "App-File", value: USERNAME_FILE },
      { name: "Username", value: profile.uid },
      { name: "Wallet", value: address },
      { name: "Active", value: "1" },
    ],
    row,
    onStatus
  );
  if (extras.previousUid && extras.previousUid !== profile.uid) {
    await uploadClaim(
      wallet,
      [
        { name: "Content-Type", value: "application/json" },
        { name: "App-Name", value: USERNAME_APP },
        { name: "App-File", value: USERNAME_FILE },
        { name: "Username", value: extras.previousUid },
        { name: "Wallet", value: address },
        { name: "Active", value: "0" },
      ],
      { ...row, uid: extras.previousUid, active: false },
      onStatus
    );
    releaseLocalUid(extras.previousUid, address);
  }
  const again = await lookupUsername(profile.uid);
  if (again && again.wallet !== address) {
    throw new Error("Username is taken");
  }
  writePublicCache(row);
  writeReadmeCache(profile.uid, extras.readme, address);
  return row;
}
