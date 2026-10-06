/**
 * Market templates (PRD §7). Same semantics as `contracts/tasks/markets.ts`: the question,
 * source and machine-readable params are generated together, so a market can never say one
 * thing and resolve on another. Questions are not free text on purpose (no ambiguous markets).
 */
import { MarketType } from "./markets";

export type TemplateKey = "bot-price" | "crypto-price" | "chain-txs" | "address-txs" | "erc20-supply";
export type Op = ">" | ">=" | "<" | "<=";

export const TEMPLATES: { key: TemplateKey; label: string }[] = [
  { key: "bot-price", label: "BOT price" },
  { key: "crypto-price", label: "Crypto price" },
  { key: "chain-txs", label: "BOT Chain total transactions" },
  { key: "address-txs", label: "Account transaction count" },
  { key: "erc20-supply", label: "Token supply" },
];

const WORD: Record<Op, string> = { ">": "above", ">=": "at or above", "<": "below", "<=": "at or below" };

/** Human threshold for questions: 85400 → "85,400" (params keep the exact string). */
const fmt = (t: string) => Number(t).toLocaleString("en-US", { maximumFractionDigits: 18 });
const COUNT: Record<Op, string> = { ">": "more than", ">=": "at least", "<": "fewer than", "<=": "at most" };

export type TemplateInput = {
  template: TemplateKey;
  op: Op;
  threshold: string;
  closeTime: number;
  asset?: string; // coingecko id
  symbol?: string;
  target?: string;
  label?: string;
  decimals?: number;
  dataChain?: number;
};

export type Draft = {
  marketType: number;
  question: string;
  description: string;
  resolutionSource: string;
  resolutionParams: string;
};

export function utcLabel(ts: number) {
  const iso = new Date(ts * 1000).toISOString();
  return `${iso.slice(11, 16)} UTC on ${iso.slice(0, 10)}`;
}

const isAddress = (a?: string) => !!a && /^0x[0-9a-fA-F]{40}$/.test(a);

/** Builds a market draft or returns a validation error. */
export function buildDraft(i: TemplateInput): Draft | { error: string } {
  if (!/^\d+(\.\d+)?$/.test(i.threshold)) return { error: "Threshold must be a plain non-negative number." };
  const when = utcLabel(i.closeTime);
  const w = WORD[i.op];
  const t = i.threshold;
  const chain = i.dataChain ?? 677;

  switch (i.template) {
    case "bot-price":
      return {
        marketType: MarketType.BotPrice,
        question: `Will BOT be ${w} $${fmt(t)} at ${when}?`,
        resolutionSource: "BOT Chain explorer stats API: scan.botchain.ai/api/v2/stats (coin_price)",
        description: `Resolves YES if the BOT/USD coin_price reported by the BOT Chain explorer, sampled at close, is ${w} ${t}. A sample taken more than 10 minutes after close resolves INVALID (refund).`,
        resolutionParams: JSON.stringify({ kind: "price", feed: "blockscout", url: "https://scan.botchain.ai/api/v2/stats", field: "coin_price", op: i.op, threshold: t, maxDelaySec: 600 }),
      };
    case "crypto-price": {
      const id = (i.asset || "").trim();
      const sym = (i.symbol || "").trim().toUpperCase();
      if (!/^[a-z0-9-]+$/.test(id) || !sym) return { error: "Enter a CoinGecko id (e.g. bitcoin) and a symbol." };
      return {
        marketType: MarketType.CryptoPrice,
        question: `Will ${sym} be ${w} $${fmt(t)} at ${when}?`,
        resolutionSource: `CoinGecko simple price API: ${id}/usd`,
        description: `Resolves YES if CoinGecko's ${sym}/USD price sampled at close is ${w} ${t}. A sample taken more than 10 minutes after close resolves INVALID (refund).`,
        resolutionParams: JSON.stringify({ kind: "price", feed: "coingecko", id, op: i.op, threshold: t, maxDelaySec: 600 }),
      };
    }
    case "chain-txs":
      return {
        marketType: MarketType.EcosystemMetric,
        question: `Will BOT Chain total transactions be ${w} ${Number(t).toLocaleString("en-US")} at ${when}?`,
        resolutionSource: "BOT Chain explorer stats API: scan.botchain.ai/api/v2/stats (total_transactions)",
        description: `Resolves YES if total_transactions reported by the BOT Chain mainnet explorer, sampled at close, is ${w} ${t}. A sample taken more than 10 minutes after close resolves INVALID (refund).`,
        resolutionParams: JSON.stringify({ kind: "explorerStat", url: "https://scan.botchain.ai/api/v2/stats", field: "total_transactions", op: i.op, threshold: t, maxDelaySec: 600 }),
      };
    case "address-txs":
      if (!isAddress(i.target)) return { error: "Enter a valid 0x account address." };
      return {
        marketType: MarketType.EcosystemEvent,
        question: `Will ${i.label?.trim() || i.target} have sent ${COUNT[i.op]} ${fmt(t)} transactions by ${when}?`,
        resolutionSource: `eth_getTransactionCount(${i.target}) on chain ${chain} at the first block at/after close`,
        description: `Resolves YES if the account nonce of ${i.target} on chain ${chain}, read at the first block whose timestamp is at or after close, is ${w} ${t}. Anyone can re-check this on-chain.`,
        resolutionParams: JSON.stringify({ kind: "txCount", chainId: chain, address: i.target, op: i.op, threshold: t }),
      };
    case "erc20-supply":
      if (!isAddress(i.target)) return { error: "Enter a valid 0x token address." };
      return {
        marketType: MarketType.EcosystemMetric,
        question: `Will ${i.label?.trim() || "the token"} supply be ${w} ${fmt(t)} at ${when}?`,
        resolutionSource: `ERC-20 totalSupply() of ${i.target} on chain ${chain} at the first block at/after close`,
        description: `Resolves YES if totalSupply() of ${i.target} (${i.decimals ?? 18} decimals) on chain ${chain}, read at the first block whose timestamp is at or after close, is ${w} ${t}. Anyone can re-check this on-chain.`,
        resolutionParams: JSON.stringify({ kind: "erc20Supply", chainId: chain, token: i.target, decimals: i.decimals ?? 18, op: i.op, threshold: t }),
      };
  }
}
