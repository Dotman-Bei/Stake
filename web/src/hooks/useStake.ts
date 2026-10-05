"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import { stakeMarketsAbi } from "@/lib/abi";
import { stakeAddress } from "@/lib/chains";
import { toMarket, type Market, type RawMarket } from "@/lib/markets";
import { aggregate, fromWire, type ActivityEvent, type ActivityResponse } from "@/lib/activity";

const PAGE = 50n;

/** Unix seconds, ticking. 0 until mounted so server and client render the same markup. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export class NotConfiguredError extends Error {
  constructor() {
    super("STAKE contract address is not configured for this deployment.");
  }
}

/** Every market, read directly from the contract (authoritative), in bounded pages. */
export function useMarkets() {
  const client = usePublicClient();
  return useQuery<Market[]>({
    queryKey: ["markets", stakeAddress],
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!stakeAddress) throw new NotConfiguredError();
      if (!client) throw new Error("No RPC client");
      const contract = { address: stakeAddress, abi: stakeMarketsAbi } as const;
      const count = await client.readContract({ ...contract, functionName: "marketCount" });
      const pages = [];
      for (let start = 0n; start < count; start += PAGE) {
        pages.push(client.readContract({ ...contract, functionName: "getMarkets", args: [start, PAGE] }));
      }
      return (await Promise.all(pages)).flat().map((r, i) => toMarket(i, r as RawMarket));
    },
  });
}

export function useMarket(id: number | null) {
  const client = usePublicClient();
  return useQuery<Market>({
    queryKey: ["market", stakeAddress, id],
    enabled: id !== null,
    refetchInterval: 5_000,
    queryFn: async () => {
      if (!stakeAddress) throw new NotConfiguredError();
      if (!client) throw new Error("No RPC client");
      const raw = await client.readContract({ address: stakeAddress, abi: stakeMarketsAbi, functionName: "getMarket", args: [BigInt(id!)] });
      return toMarket(id!, raw as RawMarket);
    },
  });
}

/** Indexed event history from /api/activity (read cache, not a source of truth for balances). */
export function useActivity() {
  return useQuery<{ toBlock: number; events: ActivityEvent[] }>({
    queryKey: ["activity", stakeAddress],
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!stakeAddress) throw new NotConfiguredError();
      const res = await fetch("/api/activity", { cache: "no-store" });
      if (!res.ok) throw new Error(`Indexer unavailable (${res.status})`);
      const body = (await res.json()) as ActivityResponse;
      return { toBlock: body.toBlock, events: body.events.map(fromWire) };
    },
  });
}

/** Markets + activity combined into per-wallet stats, holdings and platform totals. */
export function useAggregate() {
  const markets = useMarkets();
  const activity = useActivity();
  const now = useNow(30_000);
  const agg = useMemo(
    () => (markets.data && activity.data ? aggregate(activity.data.events, markets.data, now || Math.floor(Date.now() / 1000)) : null),
    [markets.data, activity.data, now],
  );
  return { markets, activity, agg };
}

/** Feed state for the board chip: syncing → live, or why it is off. */
export function feedState(q: { isPending: boolean; isError: boolean; error: unknown }) {
  if (q.error instanceof NotConfiguredError) return { live: false, label: "Contract not configured" };
  if (q.isPending) return { live: true, label: "Syncing chain" };
  if (q.isError) return { live: false, label: "Chain unreachable" };
  return { live: true, label: "On-chain feed" };
}
