"use client";

import { useRouter } from "next/navigation";
import { Copy, KeyRound, LogOut, Settings, User } from "lucide-react";
import { toast } from "sonner";
import { useExportWallet } from "@privy-io/react-auth/solana";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pfp } from "@/components/pfp";
import { useAccount, solAmount } from "@/hooks/use-account";
import { useSlabWallet } from "@/hooks/use-slab-wallet";
import { profilePath, shortAddr } from "@/lib/cluster";
import { formatSol } from "@/lib/wallet-holdings";

function copyText(value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success("Copied"),
    () => toast.error("Could not copy")
  );
}

export function WalletDrawer() {
  const wallet = useSlabWallet();
  const { profile, solLamports } = useAccount();
  const { exportWallet } = useExportWallet();
  const router = useRouter();
  const address = wallet.address;
  const sol = solAmount(solLamports);

  if (!address) {
    return null;
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <p className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
        {sol == null ? "—" : `${formatSol(sol)} SOL`}
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex size-8 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label="Account menu"
        >
          <Pfp id={profile?.pfp} size={32} alt="" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 w-64 p-1">
          <div className="flex items-center gap-2 px-2 py-2">
            <Pfp id={profile?.pfp} size={32} alt={profile?.name || profile?.uid || "Profile"} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {profile?.name || shortAddr(address)}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {profile?.uid ? `@${profile.uid}` : shortAddr(address, 6)}
              </p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-10 gap-2"
            aria-label={`Copy address ${address}`}
            onClick={() => copyText(address)}
          >
            <Copy />
            <span className="font-mono text-xs">{shortAddr(address, 4)}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-10 gap-2"
            onClick={() =>
              router.push(profile?.uid ? profilePath(profile.uid) : "/settings")
            }
          >
            <User />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-10 gap-2"
            onClick={() => router.push("/settings")}
          >
            <Settings />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-10 gap-2"
            onClick={() => {
              void exportWallet({ address }).catch((err) =>
                toast.error(
                  err instanceof Error ? err.message : "Could not export wallet"
                )
              );
            }}
          >
            <KeyRound />
            Export wallet
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-10 gap-2"
            onClick={() => {
              void wallet.logout();
            }}
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
