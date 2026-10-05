"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { BoardHeader, EmptyState, MarketGrid } from "@/components/MarketBoard";
import { WalletButton } from "@/components/WalletButton";
import { feedState, useNow } from "@/hooks/useStake";
import { useBoard } from "@/hooks/useBoard";
import { filterMarkets } from "@/lib/markets";
import { bot } from "@/lib/format";
import { activeChain } from "@/lib/chains";

const STEPS = ["Pick a market", "Choose YES or NO", "Stake BOT on-chain", "Claim on settlement"];

export function HomeView() {
  const now = useNow();
  const { isConnected } = useAccount();
  const { markets, activity, agg, participants, mine } = useBoard();
  const feed = feedState(markets);

  const list = markets.data ?? [];
  const active = now ? filterMarkets(list, "active", now, new Set()) : [];
  const featured = (active.length ? active : now ? filterMarkets(list, "resolved", now, new Set()) : []).slice(0, 6);
  const p = agg?.platform;
  const stat = (v: string | number | undefined) => (v === undefined ? "—" : v);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="section-kicker"><b>00</b> / {activeChain.name.toLowerCase()} prediction market</div>
          <h1>STAKE</h1>
          <p className="hero-lede">
            Short YES/NO markets on BOT, crypto prices and BOT Chain activity. Stake BOT, and the result and your payout
            settle on-chain within hours.
          </p>
          <div className="hero-actions">
            <Link href="/markets" className="create-button">Browse markets</Link>
            {!isConnected && <WalletButton />}
            <Link href="/leaderboard" className="ghost-button">Leaderboard</Link>
          </div>
        </div>
        <div className="hero-side">
          <ol className="hero-steps">
            {STEPS.map((s, i) => (
              <li key={s}><span className="num">{String(i + 1).padStart(2, "0")}</span><span className="txt">{s}</span></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="status-strip" aria-label="Platform stats">
        <div>
          <div className="label">Volume</div>
          <div className="value mono-num">{p ? `${bot(p.volume)} BOT` : "—"}</div>
          <div className="sub">staked on-chain</div>
        </div>
        <div>
          <div className="label">Positions</div>
          <div className="value mono-num">{stat(p?.positions)}</div>
          <div className="sub">{p ? `${p.predictors} predictor${p.predictors === 1 ? "" : "s"}` : "indexed from logs"}</div>
        </div>
        <div>
          <div className="label">Markets</div>
          <div className="value mono-num">{stat(p?.markets ?? (markets.data ? markets.data.length : undefined))}</div>
          <div className="sub">{p ? `${p.settled} settled` : "from contract"}</div>
        </div>
        <div>
          <div className="label">Claims</div>
          <div className="value mono-num">{stat(p?.claims)}</div>
          <div className="sub">{p ? `${bot(p.claimedVolume)} BOT paid out` : activity.isError ? "indexer unavailable" : "syncing"}</div>
        </div>
      </section>

      <BoardHeader eyebrow={active.length ? "Featured / live now" : "Featured / recent"} title="Live markets" feed={feed}>
        <Link href="/markets" className="create-button">All markets</Link>
      </BoardHeader>

      {markets.isPending ? (
        <EmptyState title="Loading markets">Reading markets from the STAKE contract on {activeChain.name}.</EmptyState>
      ) : markets.isError ? (
        <EmptyState title={feed.label}>{(markets.error as Error).message}</EmptyState>
      ) : featured.length === 0 ? (
        <EmptyState title="No markets yet">The first markets are on their way. Check back shortly, or read how STAKE works.</EmptyState>
      ) : (
        <>
          <MarketGrid markets={featured} now={now} participants={participants} mine={mine} />
          <div className="board-more"><Link href="/markets" className="ghost-button">View every market</Link></div>
        </>
      )}
    </>
  );
}
