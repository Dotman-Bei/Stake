import { createPublicClient, http, parseAbi, type PublicClient } from "viem";
import { formatUnits, numberToDecimal, type ResolutionParams } from "./params";

/** A value read from a declared source, with enough context to be re-checked by anyone. */
export type Observation = {
  value: string; // plain decimal string
  sampledAt: number; // unix seconds when the value applies (block timestamp or sample time)
  ref: string; // e.g. "block 25632449" or the API URL
};

export class NotYetAvailable extends Error {}

const FETCH_TIMEOUT_MS = 10_000;

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Explorer (Blockscout) stats field, sampled now. */
async function blockscoutField(url: string, field: string): Promise<Observation> {
  const body = await getJson(url);
  const raw = body[field];
  if (raw === null || raw === undefined) throw new Error(`${url} has no ${field}`);
  return { value: numberToDecimal(raw as string | number), sampledAt: Math.floor(Date.now() / 1000), ref: url };
}

async function coingeckoPrice(id: string): Promise<Observation> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_last_updated_at=true`;
  const body = (await getJson(url)) as Record<string, { usd?: number; last_updated_at?: number }>;
  const entry = body[id];
  if (!entry || typeof entry.usd !== "number") throw new Error(`CoinGecko has no usd price for ${id}`);
  return {
    value: numberToDecimal(entry.usd),
    sampledAt: entry.last_updated_at ?? Math.floor(Date.now() / 1000),
    ref: `coingecko:${id}/usd`,
  };
}

/** First block whose timestamp is >= `ts`, by binary search. Throws NotYetAvailable if none exists yet. */
export async function blockAtOrAfter(client: PublicClient, ts: number): Promise<{ number: bigint; timestamp: number }> {
  const latest = await client.getBlock({ blockTag: "latest" });
  if (Number(latest.timestamp) < ts) throw new NotYetAvailable("no block at/after close yet");
  let lo = 0n;
  let hi = latest.number;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const b = await client.getBlock({ blockNumber: mid });
    if (Number(b.timestamp) >= ts) hi = mid;
    else lo = mid + 1n;
  }
  const block = await client.getBlock({ blockNumber: lo });
  return { number: block.number, timestamp: Number(block.timestamp) };
}

const erc20Abi = parseAbi(["function totalSupply() view returns (uint256)"]);

export class Sources {
  private clients = new Map<number, PublicClient>();

  constructor(private readonly dataRpcs: Record<number, string>) {}

  private client(chainId: number): PublicClient {
    let c = this.clients.get(chainId);
    if (!c) {
      const url = this.dataRpcs[chainId];
      if (!url) throw new Error(`no data RPC configured for chain ${chainId} (set DATA_RPC_${chainId})`);
      c = createPublicClient({ transport: http(url, { timeout: FETCH_TIMEOUT_MS }) }) as PublicClient;
      this.clients.set(chainId, c);
    }
    return c;
  }

  /** Reads the declared source for a market that closed at `closeTime`. */
  async observe(p: ResolutionParams, closeTime: number): Promise<Observation> {
    switch (p.kind) {
      case "price":
        return p.feed === "blockscout" ? blockscoutField(p.url!, p.field!) : coingeckoPrice(p.id!);
      case "explorerStat":
        return blockscoutField(p.url, p.field);
      case "txCount": {
        const client = this.client(p.chainId);
        const block = await blockAtOrAfter(client, closeTime);
        const nonce = await client.getTransactionCount({ address: p.address, blockNumber: block.number });
        return { value: String(nonce), sampledAt: block.timestamp, ref: `chain ${p.chainId} block ${block.number}` };
      }
      case "erc20Supply": {
        const client = this.client(p.chainId);
        const block = await blockAtOrAfter(client, closeTime);
        const supply = await client.readContract({ address: p.token, abi: erc20Abi, functionName: "totalSupply", blockNumber: block.number });
        return { value: formatUnits(supply, p.decimals), sampledAt: block.timestamp, ref: `chain ${p.chainId} block ${block.number}` };
      }
    }
  }
}

/** Off-chain feeds are point-in-time samples and must be taken close to the deadline. */
export function isSampledFeed(p: ResolutionParams): p is Extract<ResolutionParams, { maxDelaySec: number }> {
  return p.kind === "price" || p.kind === "explorerStat";
}
