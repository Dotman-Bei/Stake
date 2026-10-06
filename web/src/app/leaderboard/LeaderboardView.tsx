"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { BoardHeader, EmptyState } from "@/components/MarketBoard";
import { feedState } from "@/hooks/useStake";
import { useBoard } from "@/hooks/useBoard";
import { leaderboard } from "@/lib/activity";
import { bot, pct, shortAddress } from "@/lib/format";

export function LeaderboardView() {
  const { address } = useAccount();
  const { markets, activity, agg } = useBoard();
  const feed = activity.isError ? { live: false, label: "Indexer unavailable" } : feedState(markets);
  const rows = agg ? leaderboard(agg.users) : [];
  const me = address?.toLowerCase();

  return (
    <>
      <BoardHeader eyebrow="Ranked by realized net winnings" title="Leaderboard" feed={feed} />
      <section className="section">
        <p className="muted" style={{ color: "var(--g200)", maxWidth: "80ch" }}>
          Net winnings = payouts minus stakes on settled markets. Volume and raw win counts are shown but don&apos;t rank, so
          staking large or spamming minimum bets can&apos;t buy a place. Every figure is derived from STAKE contract events on-chain;
          refunded markets don&apos;t count.
        </p>
      </section>

      {markets.isPending || activity.isPending ? (
        <EmptyState title="Loading rankings">Indexing positions and settlements from the chain.</EmptyState>
      ) : markets.isError || activity.isError ? (
        <EmptyState title={feed.label}>{((markets.error ?? activity.error) as Error)?.message}</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState title="No settled predictions yet">Rankings appear once the first markets resolve. Positions in open markets count after settlement.</EmptyState>
      ) : (
        <div className="ledger-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>Rank</th><th>Predictor</th><th className="num">Net winnings</th><th className="num">Wins</th>
                <th className="num opt">Losses</th><th className="num">Win rate</th><th className="num opt">Volume</th><th className="num opt">Markets</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.address}>
                  <td className="rank mono-num">{String(r.rank).padStart(2, "0")}</td>
                  <td><Link href={`/profile?address=${r.address}`}>{shortAddress(r.address)}</Link>{r.address === me ? " (you)" : ""}</td>
                  <td className={`num ${r.net > 0n ? "pos" : r.net < 0n ? "neg" : ""}`}>{r.net > 0n ? "+" : r.net < 0n ? "−" : ""}{bot(r.net < 0n ? -r.net : r.net, 4)} BOT</td>
                  <td className="num">{r.wins}</td>
                  <td className="num opt">{r.losses}</td>
                  <td className="num">{pct(r.winRate * 100)}</td>
                  <td className="num opt">{bot(r.volume)} BOT</td>
                  <td className="num opt">{r.marketsEntered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
