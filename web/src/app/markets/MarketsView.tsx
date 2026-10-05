"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { BoardHeader, EmptyState, MarketGrid } from "@/components/MarketBoard";
import { MarketTabs } from "@/components/MarketTabs";
import { CreateMarketPanel } from "@/components/CreateMarketPanel";
import { feedState, useNow } from "@/hooks/useStake";
import { useBoard } from "@/hooks/useBoard";
import { TABS, filterMarkets, isTab, type TabKey } from "@/lib/markets";
import { stakeMarketsAbi } from "@/lib/abi";
import { activeChain, stakeAddress } from "@/lib/chains";

const EMPTY_COPY: Record<TabKey, string> = {
  active: "No markets are open right now. New short-duration markets open regularly.",
  closing: "Nothing closes in the next two hours.",
  resolved: "No market has been settled yet.",
  mine: "This wallet has no positions yet. Pick a market and stake on a side.",
  bot: "No BOT price markets right now.",
  crypto: "No crypto price markets right now.",
  ecosystem: "No BOT ecosystem markets right now.",
};

export function MarketsView() {
  const router = useRouter();
  const params = useSearchParams();
  const tab: TabKey = isTab(params.get("tab")) ? (params.get("tab") as TabKey) : "active";
  const query = params.get("q") ?? "";
  const now = useNow();
  const { address, isConnected } = useAccount();
  const { markets, participants, mine } = useBoard();
  const [creating, setCreating] = useState(false);

  const { data: isCreator } = useReadContract({
    address: stakeAddress ?? undefined,
    abi: stakeMarketsAbi,
    functionName: "isCreator",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!stakeAddress },
  });

  const setTab = (t: TabKey) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", t);
    router.replace(`/markets?${next}`, { scroll: false });
  };

  const list = now && markets.data ? filterMarkets(markets.data, tab, now, new Set(mine.keys()), query) : [];
  const label = TABS.find((t) => t.key === tab)!.label;
  const feed = feedState(markets);

  return (
    <>
      <MarketTabs active={tab} onChange={setTab} />
      {creating && isCreator && <CreateMarketPanel onClose={() => setCreating(false)} />}

      <BoardHeader eyebrow={`${activeChain.name} / ${label}`} title="Markets" feed={feed}>
        {isCreator && !creating && (
          <button className="create-button" onClick={() => setCreating(true)}>
            <span className="full-label">Create market</span>
            <span className="short">Create</span>
          </button>
        )}
      </BoardHeader>

      {markets.isPending || !now ? (
        <EmptyState title="Loading markets">Reading markets from the STAKE contract on {activeChain.name}.</EmptyState>
      ) : markets.isError ? (
        <EmptyState title={feed.label}>{(markets.error as Error).message}</EmptyState>
      ) : tab === "mine" && !isConnected ? (
        <EmptyState title="Connect a wallet">Connect a wallet to see the markets you hold positions in.</EmptyState>
      ) : list.length === 0 ? (
        <EmptyState title="No markets found">{query ? `Nothing matches “${query}”. Try a different search or another tab.` : EMPTY_COPY[tab]}</EmptyState>
      ) : (
        <MarketGrid markets={list} now={now} participants={participants} mine={mine} />
      )}
    </>
  );
}
