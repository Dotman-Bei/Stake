/**
 * Indexed activity derived from StakeMarkets events, and pure aggregations over it.
 * This is a read cache for lists, history and rankings. Balances and claimability are always
 * re-read from the contract before money moves (PRD §21).
 */
import { Outcome, settledPayout, type Market } from "./markets";

type Base = { marketId: number; block: number; tx: string; logIndex: number };

export type ActivityEvent =
  | (Base & { type: "created" })
  | (Base & { type: "position"; user: string; side: number; amount: bigint })
  | (Base & { type: "resolved"; outcome: number; fee: bigint })
  | (Base & { type: "voided"; reason: string })
  | (Base & { type: "claimed"; user: string; amount: bigint; refund: boolean });

export type ActivityResponse = { chainId: number; fromBlock: number; toBlock: number; events: Record<string, unknown>[] };

/** Wire format: bigints as decimal strings. */
export function toWire(e: ActivityEvent): Record<string, unknown> {
  return Object.fromEntries(Object.entries(e).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]));
}

export function fromWire(raw: Record<string, unknown>): ActivityEvent {
  const e = { ...raw } as Record<string, unknown>;
  for (const k of ["amount", "fee"]) if (typeof e[k] === "string") e[k] = BigInt(e[k] as string);
  if (typeof e.user === "string") e.user = (e.user as string).toLowerCase();
  return e as ActivityEvent;
}

export type Holding = { side: number; amount: bigint; entries: number; lastTx: string; lastBlock: number };

export type PositionRow = {
  marketId: number;
  side: number;
  amount: bigint;
  result: "open" | "pending" | "won" | "lost" | "refund";
  payout: bigint; // settled payout (0 for loss/open)
  claimed: boolean;
  claimTx: string | null;
  lastTx: string;
  lastBlock: number;
};

export type UserStats = {
  address: string;
  marketsEntered: number;
  volume: bigint;
  wins: number;
  losses: number;
  refunds: number;
  open: number;
  claimed: bigint;
  unclaimed: bigint; // settled winnings/refunds not yet claimed (indexed estimate)
  net: bigint; // realized P&L on settled markets
  positions: PositionRow[];
};

export type PlatformStats = {
  markets: number;
  volume: bigint;
  positions: number;
  predictors: number;
  settled: number;
  claims: number;
  claimedVolume: bigint;
};

export type Aggregate = {
  holdings: Map<number, Map<string, Holding>>;
  users: Map<string, UserStats>;
  platform: PlatformStats;
  resolutionTx: Map<number, string>;
};

export function aggregate(events: ActivityEvent[], markets: Market[], now: number): Aggregate {
  const byId = new Map(markets.map((m) => [m.id, m]));
  const holdings = new Map<number, Map<string, Holding>>();
  const claims = new Map<string, { amount: bigint; tx: string }>(); // `${id}:${user}`
  const resolutionTx = new Map<number, string>();
  let positions = 0;
  let volume = 0n;
  let claimedVolume = 0n;
  let claimCount = 0;

  for (const e of events) {
    if (e.type === "position") {
      positions++;
      volume += e.amount;
      let m = holdings.get(e.marketId);
      if (!m) holdings.set(e.marketId, (m = new Map()));
      const h = m.get(e.user) ?? { side: e.side, amount: 0n, entries: 0, lastTx: e.tx, lastBlock: e.block };
      h.amount += e.amount;
      h.entries++;
      h.lastTx = e.tx;
      h.lastBlock = e.block;
      m.set(e.user, h);
    } else if (e.type === "claimed") {
      claimCount++;
      claimedVolume += e.amount;
      claims.set(`${e.marketId}:${e.user}`, { amount: e.amount, tx: e.tx });
    } else if (e.type === "resolved" || e.type === "voided") {
      resolutionTx.set(e.marketId, e.tx);
    }
  }

  const users = new Map<string, UserStats>();
  for (const [marketId, holders] of holdings) {
    const market = byId.get(marketId);
    for (const [address, h] of holders) {
      let u = users.get(address);
      if (!u) {
        u = { address, marketsEntered: 0, volume: 0n, wins: 0, losses: 0, refunds: 0, open: 0, claimed: 0n, unclaimed: 0n, net: 0n, positions: [] };
        users.set(address, u);
      }
      u.marketsEntered++;
      u.volume += h.amount;
      const claim = claims.get(`${marketId}:${address}`);
      const row: PositionRow = { marketId, side: h.side, amount: h.amount, result: "open", payout: 0n, claimed: !!claim, claimTx: claim?.tx ?? null, lastTx: h.lastTx, lastBlock: h.lastBlock };

      if (!market || market.outcome === Outcome.Unresolved) {
        row.result = market && now >= market.closeTime ? "pending" : "open";
        u.open++;
      } else if (market.outcome === Outcome.Invalid) {
        row.result = "refund";
        row.payout = h.amount;
        u.refunds++;
      } else if (market.outcome === h.side) {
        row.result = "won";
        row.payout = settledPayout(market, h.side, h.amount);
        u.wins++;
        u.net += row.payout - h.amount;
      } else {
        row.result = "lost";
        u.losses++;
        u.net -= h.amount;
      }
      if (claim) u.claimed += claim.amount;
      else if (row.result === "won" || row.result === "refund") u.unclaimed += row.payout;
      u.positions.push(row);
    }
  }
  for (const u of users.values()) u.positions.sort((a, b) => b.lastBlock - a.lastBlock);

  const settled = markets.filter((m) => m.outcome !== Outcome.Unresolved).length;
  return {
    holdings,
    users,
    resolutionTx,
    platform: { markets: markets.length, volume, positions, predictors: users.size, settled, claims: claimCount, claimedVolume },
  };
}

export type LeaderRow = UserStats & { rank: number; winRate: number };

/**
 * Ranking: realized net winnings on settled markets. Volume or raw win counts would reward wash
 * staking or spamming minimum bets; net P&L can only rise by being right (PRD §13).
 * Only wallets with at least one won or lost market are ranked.
 */
export function leaderboard(users: Map<string, UserStats>): LeaderRow[] {
  return [...users.values()]
    .filter((u) => u.wins + u.losses > 0)
    .map((u) => ({ ...u, winRate: u.wins / (u.wins + u.losses), rank: 0 }))
    .sort((a, b) => (a.net === b.net ? b.winRate - a.winRate || Number(b.volume - a.volume) : a.net > b.net ? -1 : 1))
    .map((u, i) => ({ ...u, rank: i + 1 }));
}
