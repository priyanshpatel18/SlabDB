"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useExportWallet } from "@privy-io/react-auth/solana";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  KeyRound,
  RefreshCw,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSlabWallet } from "@/hooks/use-slab-wallet";
import { explorerAddressUrl, explorerTxUrl, shortAddr } from "@/lib/cluster";
import {
  formatQty,
  formatUsd,
  loadActivity,
  loadHoldings,
  type ActivityItem,
  type Holding,
} from "@/lib/wallet-holdings";

type PanelView = "main" | "settings";
type ListTab = "balances" | "activity";

const SOL_MARK = "/SOL.png";

function copyText(value: string, ok: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(ok),
    () => toast.error("Could not copy"),
  );
}

export function WalletDrawer() {
  const {
    address,
    agentEnabled,
    agentAvailable,
    enableAgent,
    logout,
  } = useSlabWallet();
  const { exportWallet } = useExportWallet();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PanelView>("main");
  const [listTab, setListTab] = useState<ListTab>("balances");
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [agentBusy, setAgentBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const load = useCallback(async (pubkey: string) => {
    setLoading(true);
    setError(null);
    try {
      const [nextHoldings, nextActivity] = await Promise.all([
        loadHoldings(pubkey),
        loadActivity(pubkey),
      ]);
      setHoldings(nextHoldings);
      setActivity(nextActivity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !address) return;
    void load(address);
  }, [address, load, open, tick]);

  const totalUsd = useMemo(
    () => holdings.reduce((sum, row) => sum + row.usd, 0),
    [holdings],
  );

  if (!address) return null;

  const onEnableAgent = () => {
    setAgentBusy(true);
    void enableAgent()
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Could not enable agent"),
      )
      .finally(() => setAgentBusy(false));
  };

  const onExport = () => {
    setExportBusy(true);
    void exportWallet({ address })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Could not export wallet"),
      )
      .finally(() => setExportBusy(false));
  };

  return (
    <Drawer
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setView("main");
      }}
      showSwipeHandle
      swipeDirection="right"
    >
      <DrawerTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="min-h-10 shrink-0 font-mono sm:min-h-7"
            aria-label="Open wallet"
          />
        }
      >
        <span
          className="size-1.5 shrink-0 rounded-full bg-kiln"
          aria-hidden
        />
        {shortAddr(address)}
      </DrawerTrigger>
      <DrawerContent className="h-full bg-background sm:[--drawer-content-width:22rem]">
        <div className="flex h-full min-h-0 flex-col">
          <DrawerHeader className="gap-3 p-4 pb-3 md:text-left">
            <DrawerTitle className="sr-only">Wallet</DrawerTitle>
            <DrawerDescription className="sr-only">
              Balances and recent activity for this wallet.
            </DrawerDescription>
            <div className="flex items-center gap-2">
              <Avatar size="sm">
                <AvatarImage src={SOL_MARK} alt="" />
                <AvatarFallback className="text-[10px] font-medium">
                  SO
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="min-h-10 rounded-md px-1 font-mono text-sm text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-8"
                onClick={() => copyText(address, "Copied")}
              >
                {shortAddr(address)}
              </button>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="min-h-10 min-w-10 sm:min-h-8 sm:min-w-8"
                      aria-label="Copy address"
                      onClick={() => copyText(address, "Copied")}
                    />
                  }
                >
                  <Copy data-icon="inline-start" />
                </TooltipTrigger>
                <TooltipContent>Copy address</TooltipContent>
              </Tooltip>
              <div className="ml-auto flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="min-h-10 min-w-10 sm:min-h-8 sm:min-w-8"
                        aria-label={
                          view === "settings" ? "Back to wallet" : "Wallet settings"
                        }
                        aria-pressed={view === "settings"}
                        onClick={() =>
                          setView((current) =>
                            current === "settings" ? "main" : "settings",
                          )
                        }
                      />
                    }
                  >
                    {view === "settings" ? (
                      <ArrowLeft data-icon="inline-start" />
                    ) : (
                      <Settings data-icon="inline-start" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    {view === "settings" ? "Back" : "Settings"}
                  </TooltipContent>
                </Tooltip>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-10 sm:min-h-7"
                  onClick={() => {
                    void logout();
                  }}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          </DrawerHeader>

          {view === "settings" ? (
            <SettingsList
              address={address}
              agentAvailable={agentAvailable}
              agentBusy={agentBusy}
              agentEnabled={agentEnabled}
              exportBusy={exportBusy}
              onEnableAgent={onEnableAgent}
              onExport={onExport}
              onRefresh={() => setTick((n) => n + 1)}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
              <div>
                {loading && holdings.length === 0 ? (
                  <Skeleton className="h-10 w-40" />
                ) : (
                  <p className="font-heading text-3xl font-medium tracking-tight tabular-nums">
                    {formatUsd(totalUsd)}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Token prices estimated via Jupiter.
                </p>
              </div>

              {error ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-10 sm:min-h-7"
                    onClick={() => setTick((n) => n + 1)}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}

              <Tabs
                value={listTab}
                onValueChange={(value) => setListTab(value as ListTab)}
                className="min-h-0 flex-1 gap-2"
              >
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-transparent p-0">
                  <TabsTrigger
                    value="balances"
                    className="h-10 rounded-lg border border-transparent data-active:border-kiln data-active:bg-kiln/15 data-active:text-foreground"
                  >
                    Balances
                  </TabsTrigger>
                  <TabsTrigger
                    value="activity"
                    className="h-10 rounded-lg border border-transparent data-active:border-kiln data-active:bg-kiln/15 data-active:text-foreground"
                  >
                    Activity
                  </TabsTrigger>
                </TabsList>
                <ScrollArea className="min-h-0 flex-1">
                  <TabsContent value="balances" className="mt-0">
                    <BalancesList holdings={holdings} loading={loading} />
                  </TabsContent>
                  <TabsContent value="activity" className="mt-0">
                    <ActivityList items={activity} loading={loading} />
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function BalancesList({
  holdings,
  loading,
}: {
  holdings: Holding[];
  loading: boolean;
}) {
  if (loading && holdings.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  const visible = holdings.filter(
    (row) => row.mint === "native" || row.amount > 0,
  );
  if (visible.length === 0) {
    return (
      <Empty className="border-0 py-10">
        <EmptyHeader>
          <EmptyTitle>No token balances</EmptyTitle>
          <EmptyDescription>
            This wallet has no tokens yet.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ul className="flex flex-col">
      {visible.map((row) => (
        <li
          key={row.mint}
          className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
        >
          <Avatar size="sm" className="bg-muted">
            {row.mint === "native" ? (
              <AvatarImage src={SOL_MARK} alt="" />
            ) : null}
            <AvatarFallback className="text-[10px] font-medium">
              {row.symbol.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{row.symbol}</p>
            <p className="truncate text-xs text-muted-foreground">{row.name}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm tabular-nums">
              {formatQty(row.amount)}
            </p>
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatUsd(row.usd)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ActivityList({
  items,
  loading,
}: {
  items: ActivityItem[];
  loading: boolean;
}) {
  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <Empty className="border-0 py-10">
        <EmptyHeader>
          <EmptyTitle>No activity yet</EmptyTitle>
          <EmptyDescription>
            Confirmed signatures for this wallet will list here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li key={item.signature} className="border-b border-border last:border-b-0">
          <a
            href={explorerTxUrl(item.signature)}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-10 items-center justify-between gap-3 py-3 text-sm hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="font-mono tabular-nums">
              {shortAddr(item.signature, 6)}
            </span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {item.err ? (
                <span className="text-destructive">Failed</span>
              ) : (
                <span>Slot {item.slot}</span>
              )}
              <ExternalLink className="size-3.5" aria-hidden />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function SettingsList({
  address,
  agentAvailable,
  agentBusy,
  agentEnabled,
  exportBusy,
  onEnableAgent,
  onExport,
  onRefresh,
}: {
  address: string;
  agentAvailable: boolean;
  agentBusy: boolean;
  agentEnabled: boolean;
  exportBusy: boolean;
  onEnableAgent: () => void;
  onExport: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 pb-4">
      <Button
        variant="ghost"
        className="h-10 justify-start"
        onClick={() => copyText(address, "Copied")}
      >
        <Copy data-icon="inline-start" />
        Copy address
      </Button>
      <Button
        variant="ghost"
        className="h-10 justify-start"
        nativeButton={false}
        render={
          <a
            href={explorerAddressUrl(address)}
            target="_blank"
            rel="noreferrer"
          />
        }
      >
        <ExternalLink data-icon="inline-start" />
        View on explorer
      </Button>
      <Button
        variant="ghost"
        className="h-10 justify-start"
        onClick={onRefresh}
      >
        <RefreshCw data-icon="inline-start" />
        Refresh balances
      </Button>
      {agentAvailable && !agentEnabled ? (
        <Button
          variant="ghost"
          className="h-10 justify-start"
          disabled={agentBusy}
          aria-busy={agentBusy}
          onClick={onEnableAgent}
        >
          <ShieldCheck data-icon="inline-start" />
          {agentBusy ? "Enabling agent" : "Enable agent"}
        </Button>
      ) : null}
      {agentEnabled ? (
        <p className="px-2.5 py-2 text-sm text-muted-foreground">Agent signer on</p>
      ) : null}
      <Button
        variant="ghost"
        className="h-10 justify-start"
        disabled={exportBusy}
        aria-busy={exportBusy}
        onClick={onExport}
      >
        <KeyRound data-icon="inline-start" />
        {exportBusy ? "Opening export" : "Export wallet"}
      </Button>
    </div>
  );
}
