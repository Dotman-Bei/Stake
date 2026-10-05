import "server-only";
import { createPublicClient, http, type Log } from "viem";
import { stakeMarketsAbi } from "./abi";
import { activeChain, deployBlock, rpcUrl, stakeAddress } from "./chains";
import { toWire, type ActivityEvent } from "./activity";

/**
 * Minimal incremental log indexer. Keeps decoded StakeMarkets events in memory and only scans
 * new blocks on each call. Restarting the server rebuilds it from the deploy block; nothing here
 * is authoritative — it is all re-derivable from chain logs.
 */
const CHUNK = 50_000n;
const EVENTS = ["MarketCreated", "PositionTaken", "MarketResolved", "MarketVoided", "Claimed"] as const;

const client = createPublicClient({ chain: activeChain, transport: http(rpcUrl, { timeout: 20_000 }) });

type Cache = { next: bigint; head: bigint; events: ActivityEvent[]; syncing: Promise<void> | null };
const cache: Cache = { next: deployBlock, head: deployBlock - 1n, events: [], syncing: null };

function decode(log: Log & { eventName?: string; args?: Record<string, unknown> }): ActivityEvent | null {
  const base = {
    marketId: Number(log.args!.marketId as bigint),
    block: Number(log.blockNumber),
    tx: log.transactionHash!,
    logIndex: log.logIndex!,
  };
  const a = log.args!;
  switch (log.eventName) {
    case "MarketCreated": return { ...base, type: "created" };
    case "PositionTaken": return { ...base, type: "position", user: (a.user as string).toLowerCase(), side: Number(a.side), amount: a.amount as bigint };
    case "MarketResolved": return { ...base, type: "resolved", outcome: Number(a.outcome), fee: a.fee as bigint };
    case "MarketVoided": return { ...base, type: "voided", reason: a.reason as string };
    case "Claimed": return { ...base, type: "claimed", user: (a.user as string).toLowerCase(), amount: a.amount as bigint, refund: a.refund as boolean };
    default: return null;
  }
}

async function sync() {
  if (!stakeAddress) return;
  const latest = await client.getBlockNumber();
  while (cache.next <= latest) {
    const to = cache.next + CHUNK - 1n > latest ? latest : cache.next + CHUNK - 1n;
    const logs = await client.getContractEvents({ address: stakeAddress, abi: stakeMarketsAbi, fromBlock: cache.next, toBlock: to });
    for (const log of logs) {
      if (!EVENTS.includes(log.eventName as (typeof EVENTS)[number])) continue;
      const e = decode(log as never);
      if (e) cache.events.push(e);
    }
    cache.next = to + 1n;
    cache.head = to;
  }
}

/** Brings the cache up to the chain head. Concurrent callers share one sync. */
export async function getActivity() {
  if (!cache.syncing) cache.syncing = sync().finally(() => { cache.syncing = null; });
  await cache.syncing;
  return {
    chainId: activeChain.id,
    fromBlock: Number(deployBlock),
    toBlock: Number(cache.head),
    events: cache.events,
  };
}

export async function getActivityWire() {
  const a = await getActivity();
  return { ...a, events: a.events.map(toWire) };
}

export async function readAllMarkets() {
  if (!stakeAddress) return [];
  const count = await client.readContract({ address: stakeAddress, abi: stakeMarketsAbi, functionName: "marketCount" });
  const pages = [];
  for (let start = 0n; start < count; start += 50n) {
    pages.push(client.readContract({ address: stakeAddress, abi: stakeMarketsAbi, functionName: "getMarkets", args: [start, 50n] }));
  }
  return (await Promise.all(pages)).flat();
}
