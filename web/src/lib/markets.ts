/** Market domain model mirrored from StakeMarkets.sol, plus pure helpers used across the UI. */

export const MarketType = { BotPrice: 0, CryptoPrice: 1, EcosystemMetric: 2, EcosystemEvent: 3 } as const;
export const Side = { None: 0, Yes: 1, No: 2 } as const;
export const Outcome = { Unresolved: 0, Yes: 1, No: 2, Invalid: 3 } as const;

export type Market = {
  id: number;
  totalYes: bigint;
  totalNo: bigint;
  minStake: bigint;
  maxStake: bigint;
  openTime: number;
  closeTime: number;
  createdAt: number;
  resolvedAt: number;
  yesCount: number;
  noCount: number;
  feeBps: number;
  marketType: number;
  outcome: number;
  creator: string;
  resolvedBy: string;
  fee: bigint;
  question: string;
  description: string;
  resolutionSource: string;
  resolutionParams: string;
  resolutionEvidence: string;
};

/** Raw struct as returned by viem for `getMarket` / `getMarkets`. */
export type RawMarket = {
  totalYes: bigint; totalNo: bigint; minStake: bigint; maxStake: bigint;
  openTime: bigint; closeTime: bigint; createdAt: bigint; resolvedAt: bigint;
  yesCount: number; noCount: number; feeBps: number; marketType: number; outcome: number;
  creator: string; resolvedBy: string; fee: bigint;
  question: string; description: string; resolutionSource: string; resolutionParams: string; resolutionEvidence: string;
};

export function toMarket(id: number, r: RawMarket): Market {
  return {
    ...r,
    id,
    openTime: Number(r.openTime),
    closeTime: Number(r.closeTime),
    createdAt: Number(r.createdAt),
    resolvedAt: Number(r.resolvedAt),
  };
}

export type Status = "upcoming" | "live" | "closed" | "resolved" | "invalid";

export function marketStatus(m: Pick<Market, "outcome" | "openTime" | "closeTime">, now: number): Status {
  if (m.outcome === Outcome.Invalid) return "invalid";
  if (m.outcome !== Outcome.Unresolved) return "resolved";
  if (now < m.openTime) return "upcoming";
  if (now < m.closeTime) return "live";
  return "closed";
}

export const STATUS_LABEL: Record<Status, string> = {
  upcoming: "Upcoming",
  live: "Live",
  closed: "Awaiting result",
  resolved: "Resolved",
  invalid: "Refund",
};

export const TYPE_LABEL: Record<number, string> = {
  [MarketType.BotPrice]: "BOT price",
  [MarketType.CryptoPrice]: "Crypto price",
  [MarketType.EcosystemMetric]: "Ecosystem metric",
  [MarketType.EcosystemEvent]: "Ecosystem event",
};

export const TYPE_CODE: Record<number, string> = {
  [MarketType.BotPrice]: "BT",
  [MarketType.CryptoPrice]: "CR",
  [MarketType.EcosystemMetric]: "EM",
  [MarketType.EcosystemEvent]: "EV",
};

export const total = (m: Pick<Market, "totalYes" | "totalNo">) => m.totalYes + m.totalNo;

/** YES share of the pool in whole percent (50 when empty). */
export function yesPercent(m: Pick<Market, "totalYes" | "totalNo">): number {
  const t = total(m);
  if (t === 0n) return 50;
  return Number((m.totalYes * 10_000n) / t) / 100;
}

/** Fee charged on the losing pool, as in the contract. */
export function feeFor(losing: bigint, feeBps: number): bigint {
  return (losing * BigInt(feeBps)) / 10_000n;
}

/**
 * Payout for `amount` on `side` if that side wins, after adding `amount` to the pool (a quote).
 * Mirrors StakeMarkets._payout: amount * (total - fee) / winningPool.
 */
export function quotePayout(m: Pick<Market, "totalYes" | "totalNo" | "feeBps">, side: 1 | 2, amount: bigint, alreadyIn = false): bigint {
  if (amount <= 0n) return 0n;
  const yes = m.totalYes + (side === Side.Yes && !alreadyIn ? amount : 0n);
  const no = m.totalNo + (side === Side.No && !alreadyIn ? amount : 0n);
  const winning = side === Side.Yes ? yes : no;
  const losing = side === Side.Yes ? no : yes;
  return (amount * (yes + no - feeFor(losing, m.feeBps))) / winning;
}

/** Settled payout for a position (0 for a loss, the stake for a refund). */
export function settledPayout(m: Pick<Market, "totalYes" | "totalNo" | "fee" | "outcome">, side: number, amount: bigint): bigint {
  if (m.outcome === Outcome.Invalid) return amount;
  if (m.outcome === Outcome.Unresolved || side !== m.outcome) return 0n;
  const winning = m.outcome === Outcome.Yes ? m.totalYes : m.totalNo;
  if (winning === 0n) return 0n;
  return (amount * (m.totalYes + m.totalNo - m.fee)) / winning;
}

/** Card tone, hashed from the question so the grid varies without colour (frontend.md §2). */
export const TONES = ["mint", "rose", "ivory", "blue", "violet", "amber"] as const;
export function toneFor(text: string): (typeof TONES)[number] {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

/** Four bar heights (percent) for the fallback visual, stable per market. */
export function barsFor(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return [0, 1, 2, 3].map((i) => 30 + ((h >>> (i * 8)) & 0xff) % 66);
}

export const CLOSING_SOON_SECONDS = 2 * 3600;

export type TabKey = "active" | "closing" | "resolved" | "mine" | "bot" | "crypto" | "ecosystem";

export const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "closing", label: "Closing Soon" },
  { key: "resolved", label: "Resolved" },
  { key: "mine", label: "My Positions" },
  { key: "bot", label: "BOT Price" },
  { key: "crypto", label: "Crypto" },
  { key: "ecosystem", label: "Ecosystem" },
];

export function isTab(v: string | null): v is TabKey {
  return TABS.some((t) => t.key === v);
}

/** Filters and orders markets for a tab. `mine` is the set of market IDs the wallet holds. */
export function filterMarkets(markets: Market[], tab: TabKey, now: number, mine: Set<number>, query = ""): Market[] {
  const q = query.trim().toLowerCase();
  const open = (m: Market) => { const s = marketStatus(m, now); return s === "live" || s === "upcoming"; };
  const list = markets.filter((m) => {
    if (q && !m.question.toLowerCase().includes(q)) return false;
    switch (tab) {
      case "active": return open(m);
      case "closing": return marketStatus(m, now) === "live" && m.closeTime - now <= CLOSING_SOON_SECONDS;
      case "resolved": return m.outcome !== Outcome.Unresolved || marketStatus(m, now) === "closed";
      case "mine": return mine.has(m.id);
      case "bot": return m.marketType === MarketType.BotPrice;
      case "crypto": return m.marketType === MarketType.CryptoPrice;
      case "ecosystem": return m.marketType === MarketType.EcosystemMetric || m.marketType === MarketType.EcosystemEvent;
    }
  });
  if (tab === "resolved") return list.sort((a, b) => (b.resolvedAt || b.closeTime) - (a.resolvedAt || a.closeTime));
  // open first by soonest close, then the rest newest first
  return list.sort((a, b) => {
    const ao = open(a), bo = open(b);
    if (ao !== bo) return ao ? -1 : 1;
    return ao ? a.closeTime - b.closeTime : b.closeTime - a.closeTime;
  });
}

/** Parses the on-chain evidence JSON written by the resolver. */
export function parseEvidence(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
