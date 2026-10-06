"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { isAddress } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BoardHeader, EmptyState } from "@/components/MarketBoard";
import { TxNotice, type TxState } from "@/components/TxNotice";
import { WalletButton } from "@/components/WalletButton";
import { feedState } from "@/hooks/useStake";
import { useBoard } from "@/hooks/useBoard";
import { stakeMarketsAbi } from "@/lib/abi";
import { activeChain, addressUrl, stakeAddress, txUrl } from "@/lib/chains";
import { describeError } from "@/lib/errors";
import { bot, botLabel, shortAddress } from "@/lib/format";
import type { PositionRow } from "@/lib/activity";
import type { Market } from "@/lib/markets";

const RESULT_LABEL: Record<PositionRow["result"], string> = {
  open: "Open", pending: "Awaiting result", won: "Won", lost: "Lost", refund: "Refund",
};

function ClaimRow({ market, amount, onDone }: { market: Market; amount: bigint; onDone: () => void }) {
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [tx, setTx] = useState<TxState>({ stage: "idle" });
  const busy = tx.stage === "wallet" || tx.stage === "pending";

  async function claim() {
    if (!client || !stakeAddress) return;
    try {
      setTx({ stage: "wallet" });
      const hash = await writeContractAsync({ address: stakeAddress, abi: stakeMarketsAbi, functionName: "claim", args: [BigInt(market.id)] });
      setTx({ stage: "pending", hash });
      const r = await client.waitForTransactionReceipt({ hash });
      if (r.status !== "success") throw new Error("Claim reverted.");
      setTx({ stage: "done", hash, message: "Claimed." });
      onDone();
    } catch (err) {
      setTx({ stage: "error", message: describeError(err) });
    }
  }

  return (
    <div className="claim-row">
      <div>
        <Link href={`/market/${market.id}`}>{market.question}</Link>
        {tx.stage !== "idle" && <div style={{ marginTop: 8 }}><TxNotice tx={tx} /></div>}
      </div>
      <span className="amt mono-num">{botLabel(amount, 4)}</span>
      <button className="create-button" onClick={claim} disabled={busy || tx.stage === "done"}>
        {busy ? "Confirming…" : tx.stage === "done" ? "Claimed" : "Claim"}
      </button>
    </div>
  );
}

export function ProfileView() {
  const params = useSearchParams();
  const { address: connected, chainId } = useAccount();
  const queryParam = params.get("address");
  const viewing = (queryParam && isAddress(queryParam) ? queryParam : connected)?.toLowerCase();
  const own = !!connected && viewing === connected.toLowerCase();
  const { markets, activity, agg } = useBoard();
  const queryClient = useQueryClient();
  const feed = activity.isError ? { live: false, label: "Indexer unavailable" } : feedState(markets);

  const user = viewing && agg ? agg.users.get(viewing) : undefined;
  const byId = new Map((markets.data ?? []).map((m) => [m.id, m]));
  const settledIds = (user?.positions ?? []).filter((p) => (p.result === "won" || p.result === "refund") && !p.claimed).map((p) => p.marketId);

  // Claimability is verified against the contract, not the index. Plain reads: Multicall3 is not on every BOT network.
  const client = usePublicClient();
  const claimables = useQuery({
    queryKey: ["claimable", stakeAddress, viewing, settledIds.join(",")],
    enabled: !!client && !!stakeAddress && !!viewing && settledIds.length > 0,
    refetchInterval: 15_000,
    queryFn: () =>
      Promise.all(settledIds.map((id) =>
        client!.readContract({ address: stakeAddress!, abi: stakeMarketsAbi, functionName: "claimable", args: [BigInt(id), viewing as `0x${string}`] }),
      )),
  });
  const verified = settledIds
    .map((id, i) => ({ id, amount: claimables.data?.[i] ?? 0n }))
    .filter((c) => c.amount > 0n);
  const claimableTotal = verified.reduce((s, c) => s + c.amount, 0n);

  if (queryParam && !isAddress(queryParam)) {
    return <><BoardHeader eyebrow="Profile" title="Predictor" /><EmptyState title="Invalid address">That is not a valid 0x wallet address.</EmptyState></>;
  }
  if (!viewing) {
    return (
      <>
        <BoardHeader eyebrow="Profile" title="Your predictions" />
        <div className="empty-state">
          <h2>Connect a wallet</h2>
          <p>Your positions, wins, losses and claimable winnings are read from {activeChain.name}.</p>
          <WalletButton />
        </div>
      </>
    );
  }

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["activity"] });
    claimables.refetch();
  };

  return (
    <>
      <BoardHeader eyebrow={own ? "Profile / connected wallet" : "Profile / predictor"} title={own ? "Your predictions" : "Predictor"} feed={feed} />
      <section className="section" style={{ paddingTop: 18, paddingBottom: 18 }}>
        <div className="address-line">
          <span className="mono-num" style={{ color: "var(--white)" }}>{viewing}</span>
          {addressUrl(viewing) && <a className="ext" href={addressUrl(viewing)!} target="_blank" rel="noreferrer">Explorer</a>}
          {own && chainId !== activeChain.id && <span className="warning">Wallet is on another network</span>}
        </div>
      </section>

      <section className="status-strip" aria-label="Prediction stats">
        <div>
          <div className="label">Markets entered</div>
          <div className="value mono-num">{user?.marketsEntered ?? 0}</div>
          <div className="sub">{user ? `${user.wins} won · ${user.losses} lost · ${user.open} open` : "no positions yet"}</div>
        </div>
        <div>
          <div className="label">Total staked</div>
          <div className="value mono-num">{botLabel(user?.volume ?? 0n)}</div>
          <div className="sub">{user?.refunds ? `${user.refunds} refunded` : "across all markets"}</div>
        </div>
        <div>
          <div className="label">Total payouts</div>
          <div className="value mono-num">{botLabel(user?.claimed ?? 0n)}</div>
          <div className="sub">
            net {user && user.net < 0n ? "−" : "+"}{bot(user ? (user.net < 0n ? -user.net : user.net) : 0n, 4)} BOT settled
          </div>
        </div>
        <div>
          <div className="label">Claimable now</div>
          <div className="value mono-num accent-text">{botLabel(claimableTotal, 4)}</div>
          <div className="sub">verified on-chain</div>
        </div>
      </section>

      {verified.length > 0 && (
        <section aria-label="Claimable winnings">
          <div className="section" style={{ paddingBottom: 14 }}><span className="label" style={{ margin: 0 }}>Claimable winnings and refunds</span></div>
          <div className="claim-list">
            {verified.map((c) => {
              const m = byId.get(c.id);
              if (!m) return null;
              return own ? (
                <ClaimRow key={c.id} market={m} amount={c.amount} onDone={refresh} />
              ) : (
                <div className="claim-row" key={c.id}>
                  <Link href={`/market/${m.id}`}>{m.question}</Link>
                  <span className="amt mono-num">{botLabel(c.amount, 4)}</span>
                  <span className="muted">unclaimed</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="section" style={{ paddingBottom: 14 }}><span className="label" style={{ margin: 0 }}>Recent positions</span></div>
      {markets.isPending || activity.isPending ? (
        <div className="ledger-empty">Loading positions…</div>
      ) : activity.isError ? (
        <div className="ledger-empty">Position history is unavailable right now (indexer offline). Claimable amounts above come straight from the contract.</div>
      ) : !user || user.positions.length === 0 ? (
        <div className="ledger-empty">
          No positions yet. <Link href="/markets" className="accent-text">Browse markets</Link>
        </div>
      ) : (
        <div className="ledger-wrap">
          <table className="ledger">
            <thead>
              <tr><th>Market</th><th>Side</th><th className="num">Stake</th><th>Result</th><th className="num">Payout</th><th>Claim</th><th className="opt">Tx</th></tr>
            </thead>
            <tbody>
              {user.positions.map((p) => {
                const m = byId.get(p.marketId);
                const claimLink = p.claimTx ? txUrl(p.claimTx) : null;
                const posLink = txUrl(p.lastTx);
                return (
                  <tr key={p.marketId}>
                    <td className="wrap"><Link href={`/market/${p.marketId}`}>{m?.question ?? `Market #${p.marketId}`}</Link></td>
                    <td className={p.side === 1 ? "pos" : ""}>{p.side === 1 ? "YES" : "NO"}</td>
                    <td className="num">{bot(p.amount, 4)} BOT</td>
                    <td className={p.result === "won" ? "pos" : p.result === "lost" ? "neg" : ""}>{RESULT_LABEL[p.result]}</td>
                    <td className="num">{p.payout > 0n ? `${bot(p.payout, 4)} BOT` : "—"}</td>
                    <td>
                      {p.claimed ? (claimLink ? <a className="ext" href={claimLink} target="_blank" rel="noreferrer">Claimed</a> : "Claimed")
                        : p.result === "won" || p.result === "refund" ? <span className="accent-text">Unclaimed</span> : "—"}
                    </td>
                    <td className="opt">{posLink ? <a className="ext" href={posLink} target="_blank" rel="noreferrer">{shortAddress(p.lastTx)}</a> : shortAddress(p.lastTx)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
