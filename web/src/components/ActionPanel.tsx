"use client";

import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useBalance, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { stakeMarketsAbi } from "@/lib/abi";
import { activeChain, stakeAddress, txUrl } from "@/lib/chains";
import { describeError } from "@/lib/errors";
import { Outcome, Side, marketStatus, quotePayout, settledPayout, yesPercent, type Market } from "@/lib/markets";
import { botLabel, bot, multiple, pct, timeLeft, utc } from "@/lib/format";
import { TxNotice, type TxState } from "./TxNotice";
import { WalletButton } from "./WalletButton";

const DEFAULT_GRACE = 3 * 24 * 3600;

export function ActionPanel({ market, now, claimTx }: { market: Market; now: number; claimTx: string | null }) {
  const { address, isConnected, chainId } = useAccount();
  const client = usePublicClient();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [side, setSide] = useState<1 | 2 | null>(null);
  const [amount, setAmount] = useState("");
  const [tx, setTx] = useState<TxState>({ stage: "idle" });

  const contract = { address: stakeAddress!, abi: stakeMarketsAbi } as const;
  const id = BigInt(market.id);
  const enabled = !!address && !!stakeAddress;
  const position = useReadContract({ ...contract, functionName: "getPosition", args: address ? [id, address] : undefined, query: { enabled, refetchInterval: 5_000 } });
  const claimable = useReadContract({ ...contract, functionName: "claimable", args: address ? [id, address] : undefined, query: { enabled, refetchInterval: 5_000 } });
  const grace = useReadContract({ ...contract, functionName: "RESOLUTION_GRACE", query: { enabled: !!stakeAddress, staleTime: Infinity } });
  const balance = useBalance({ address, chainId: activeChain.id, query: { enabled: !!address, refetchInterval: 10_000 } });

  const status = marketStatus(market, now);
  const pos = position.data;
  const held = pos && pos.amount > 0n ? (pos.side as 1 | 2) : null;
  const chosen = held ?? side;
  const wrongChain = isConnected && chainId !== activeChain.id;
  const busy = tx.stage === "wallet" || tx.stage === "pending";
  const graceSec = grace.data !== undefined ? Number(grace.data) : DEFAULT_GRACE;
  const voidableAt = market.closeTime + graceSec;

  let parsed: bigint | null = null;
  try { parsed = amount ? parseEther(amount) : null; } catch { parsed = null; }
  const remaining = market.maxStake - (pos?.amount ?? 0n);
  const amountError =
    amount && parsed === null ? "Enter a BOT amount."
    : parsed !== null && parsed < market.minStake ? `Minimum stake is ${botLabel(market.minStake, 4)}.`
    : parsed !== null && parsed > remaining ? `Max position is ${botLabel(market.maxStake)}; you can add ${botLabel(remaining, 4)}.`
    : parsed !== null && balance.data && parsed > balance.data.value ? "Not enough BOT in this wallet."
    : null;
  const quote = chosen && parsed && !amountError ? quotePayout(market, chosen, parsed) : 0n;

  const step = status === "resolved" || status === "invalid" ? 2 : chosen ? 1 : 0;

  async function send(label: string, write: () => Promise<`0x${string}`>, done: string) {
    if (!client) return;
    try {
      setTx({ stage: "wallet" });
      const hash = await write();
      setTx({ stage: "pending", hash });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`${label} reverted.`);
      setTx({ stage: "done", hash, message: done });
      setAmount("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["market"] }),
        queryClient.invalidateQueries({ queryKey: ["markets"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
        position.refetch(), claimable.refetch(), balance.refetch(),
      ]);
    } catch (err) {
      setTx({ stage: "error", message: describeError(err) });
    }
  }

  const stake = () =>
    send("Stake", () => writeContractAsync({ ...contract, functionName: "stake", args: [id, chosen!], value: parsed! }),
      `Position recorded: ${amount} BOT on ${chosen === Side.Yes ? "YES" : "NO"}.`);
  const claim = () =>
    send("Claim", () => writeContractAsync({ ...contract, functionName: "claim", args: [id] }),
      market.outcome === Outcome.Invalid ? "Refund claimed." : "Winnings claimed.");
  const voidStale = () =>
    send("Void", () => writeContractAsync({ ...contract, functionName: "voidStaleMarket", args: [id] }), "Market voided. Every staker can now claim a refund.");

  const quick = [market.minStake, parseEther("1"), parseEther("5"), parseEther("10")]
    .filter((v, i, a) => v >= market.minStake && v <= market.maxStake && a.indexOf(v) === i);

  return (
    <div className="action-card">
      <div className="stepper" aria-label="Progress">
        {["Side", "Stake", "Claim"].map((s, i) => (
          <span key={s} aria-current={i === step ? "step" : undefined} className={i < step ? "done" : ""}>{String(i + 1).padStart(2, "0")} {s}</span>
        ))}
      </div>

      <div className="action-body">
        {held && pos && (
          <div className="position-box">
            <span className="label">Your position</span>
            <strong className="mono-num">{botLabel(pos.amount, 4)} on {held === Side.Yes ? "YES" : "NO"}</strong>
            <span className="muted" style={{ fontSize: 13, color: "var(--g200)" }}>
              {status === "resolved" || status === "invalid"
                ? settledPayout(market, held, pos.amount) > 0n
                  ? `${pos.claimed ? "Claimed" : "Payout"}: ${botLabel(settledPayout(market, held, pos.amount), 4)}`
                  : "This position did not win."
                : `If ${held === Side.Yes ? "YES" : "NO"} wins now: ${botLabel(quotePayout(market, held, pos.amount, true), 4)}`}
            </span>
          </div>
        )}

        {(status === "live" || status === "upcoming") && (
          <>
            <div>
              <div className="label" style={{ marginBottom: 10 }}>{held ? "Your side (one side per wallet)" : "Choose a side"}</div>
              <div className="side-picker">
                {([1, 2] as const).map((s) => {
                  const share = s === Side.Yes ? yesPercent(market) : 100 - yesPercent(market);
                  return (
                    <button key={s} aria-pressed={chosen === s} disabled={!!held && held !== s} onClick={() => setSide(s)}>
                      <strong>{s === Side.Yes ? "YES" : "NO"}</strong>
                      <span className="mono-num">{pct(share)} · {bot(s === Side.Yes ? market.totalYes : market.totalNo)} BOT</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="stake-amount" style={{ display: "block", marginBottom: 10 }}>Stake amount</label>
              <div className="amount-field">
                <input id="stake-amount" inputMode="decimal" placeholder={formatEther(market.minStake)} value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} disabled={status !== "live"} />
                <span className="unit">BOT</span>
              </div>
              <div className="quick-amounts" style={{ marginTop: 8 }}>
                {quick.map((v) => <button key={v.toString()} onClick={() => setAmount(formatEther(v))} disabled={status !== "live"}>{bot(v, 4)}</button>)}
              </div>
            </div>

            <dl className="quote">
              <div><dt>If {chosen === Side.No ? "NO" : "YES"} wins</dt><dd className="accent-text mono-num">{quote ? botLabel(quote, 4) : "—"}</dd></div>
              <div><dt>Payout multiple</dt><dd className="mono-num">{quote && parsed ? multiple(quote, parsed) : "—"}</dd></div>
              <div><dt>Limits</dt><dd className="mono-num">{bot(market.minStake, 4)} – {bot(market.maxStake)} BOT</dd></div>
              <div><dt>Fee</dt><dd>{market.feeBps / 100}% of losing pool</dd></div>
            </dl>
            <p>Quotes move as others stake; the final split at close decides the payout. Winners never get back less than their stake.</p>

            {amountError && <div className="notice err" role="alert">{amountError}</div>}

            {status === "upcoming" ? (
              <div className="notice">Opens in {timeLeft(market.openTime, now)} ({utc(market.openTime)}).</div>
            ) : !isConnected ? (
              <><div className="notice">Connect a wallet to stake BOT on this market.</div><WalletButton /></>
            ) : wrongChain ? (
              <div className="notice warn">Switch your wallet to {activeChain.name} to stake.</div>
            ) : (
              <button className="create-button block" disabled={busy || !chosen || !parsed || !!amountError} onClick={stake}>
                {busy ? "Confirming…" : chosen && parsed && !amountError ? `Stake ${amount} BOT on ${chosen === Side.Yes ? "YES" : "NO"}` : chosen ? "Enter an amount" : "Choose YES or NO"}
              </button>
            )}
          </>
        )}

        {status === "closed" && (
          <>
            <div className="notice warn">
              Closed {utc(market.closeTime)}. Awaiting the result from the declared source. The resolver must settle by {utc(voidableAt)}; after that anyone can void the market and everyone is refunded.
            </div>
            {now > voidableAt && isConnected && !wrongChain && (
              <button className="create-button block" disabled={busy} onClick={voidStale}>{busy ? "Confirming…" : "Void stale market (refund all)"}</button>
            )}
          </>
        )}

        {(status === "resolved" || status === "invalid") && (
          <>
            <div className={`notice ${status === "invalid" ? "warn" : "ok"}`}>
              {status === "invalid" ? "This market resolved INVALID. Every position is refunded in full." : `Resolved ${market.outcome === Outcome.Yes ? "YES" : "NO"} on ${utc(market.resolvedAt)}.`}
            </div>
            {!isConnected ? (
              <><div className="notice">Connect the wallet you staked with to claim.</div><WalletButton /></>
            ) : wrongChain ? (
              <div className="notice warn">Switch your wallet to {activeChain.name} to claim.</div>
            ) : claimable.data && claimable.data > 0n ? (
              <button className="create-button block" disabled={busy} onClick={claim}>
                {busy ? "Confirming…" : `Claim ${botLabel(claimable.data, 4)}`}
              </button>
            ) : pos?.claimed ? (
              <div className="notice ok">
                Claimed.{" "}
                {claimTx && txUrl(claimTx) && <a className="ext" href={txUrl(claimTx)!} target="_blank" rel="noreferrer">View claim</a>}
              </div>
            ) : held ? (
              <div className="notice">Nothing to claim for this position.</div>
            ) : (
              <div className="notice">This wallet had no position in this market.</div>
            )}
          </>
        )}

        <TxNotice tx={tx} />
      </div>
    </div>
  );
}
