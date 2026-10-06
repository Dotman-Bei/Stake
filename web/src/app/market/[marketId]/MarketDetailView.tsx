"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { ActionPanel } from "@/components/ActionPanel";
import { MarketVisual, StatusTag } from "@/components/MarketCard";
import { EmptyState } from "@/components/MarketBoard";
import { ArrowLeftIcon } from "@/components/Icons";
import { NotConfiguredError, useActivity, useMarket, useNow } from "@/hooks/useStake";
import { Outcome, TYPE_LABEL, marketStatus, parseEvidence, total, yesPercent } from "@/lib/markets";
import { botLabel, bot, pct, shortAddress, timeLeft, utc } from "@/lib/format";
import { addressUrl, stakeAddress, txUrl } from "@/lib/chains";

function Back() {
  return (
    <Link href="/markets" className="back-button"><ArrowLeftIcon width={18} height={18} /> Back to markets</Link>
  );
}

export function MarketDetailView({ marketId }: { marketId: string }) {
  const id = /^\d+$/.test(marketId) ? Number(marketId) : null;
  const now = useNow();
  const { address } = useAccount();
  const market = useMarket(id);
  const activity = useActivity();

  if (id === null) return <><Back /><EmptyState title="Market not found">Market IDs are whole numbers, like /market/0.</EmptyState></>;
  if (market.isPending || !now) return <><Back /><EmptyState title="Loading market">Reading market #{id} from the STAKE contract.</EmptyState></>;
  if (market.isError) {
    const err = market.error as Error;
    const missing = /UnknownMarket/.test(err.message);
    return (
      <>
        <Back />
        <EmptyState title={missing ? "Market not found" : err instanceof NotConfiguredError ? "Contract not configured" : "Chain unreachable"}>
          {missing ? `There is no market #${id} on this contract.` : err.message}
        </EmptyState>
      </>
    );
  }

  const m = market.data;
  const status = marketStatus(m, now);
  const yes = yesPercent(m);
  const events = (activity.data?.events ?? []).filter((e) => e.marketId === m.id);
  const positions = events.filter((e) => e.type === "position").reverse();
  const resolution = events.find((e) => e.type === "resolved" || e.type === "voided");
  const creation = events.find((e) => e.type === "created");
  const me = address?.toLowerCase();
  const myClaim = events.find((e) => e.type === "claimed" && e.user === me);
  const evidence = parseEvidence(m.resolutionEvidence);
  let params: string = m.resolutionParams;
  try { params = JSON.stringify(JSON.parse(m.resolutionParams), null, 1); } catch { /* show raw */ }

  const link = (href: string | null, text: string) => (href ? <a className="ext" href={href} target="_blank" rel="noreferrer">{text}</a> : text);

  return (
    <div className="detail">
      <div className="detail-head">
        <Back />
        <div className="detail-hero">
          <MarketVisual market={m} large />
          <div style={{ minWidth: 0 }}>
            <div className="card-tags">
              <span className="tag">{TYPE_LABEL[m.marketType]}</span>
              <StatusTag status={status} />
              <span className="tag id">#{m.id}</span>
            </div>
            <h1>{m.question}</h1>
          </div>
        </div>

        <section className="detail-stats" aria-label="Market stats">
          <div>
            <div className="label">Total pool</div>
            <div className="value mono-num">{botLabel(total(m))}</div>
            <div className="sub">{m.yesCount + m.noCount} predictors</div>
          </div>
          <div>
            <div className="label">YES pool</div>
            <div className="value mono-num accent-text">{botLabel(m.totalYes)}</div>
            <div className="sub">{pct(total(m) ? yes : 0)} · {m.yesCount} wallets</div>
          </div>
          <div>
            <div className="label">NO pool</div>
            <div className="value mono-num">{botLabel(m.totalNo)}</div>
            <div className="sub">{pct(total(m) ? 100 - yes : 0)} · {m.noCount} wallets</div>
          </div>
          <div>
            <div className="label">{status === "upcoming" ? "Opens" : "Closes"}</div>
            <div className="value mono-num">{status === "upcoming" ? timeLeft(m.openTime, now) : timeLeft(m.closeTime, now)}</div>
            <div className="sub">{utc(status === "upcoming" ? m.openTime : m.closeTime)}</div>
          </div>
        </section>
      </div>

      <div className="detail-body">
        <section className="section">
          <span className="label">Market</span>
          <p>{m.description || "No description."}</p>
        </section>

        <section className="section">
          <span className="label">Resolution</span>
          <dl className="kv">
            <dt>Status</dt>
            <dd>
              {status === "resolved" ? `Resolved ${m.outcome === Outcome.Yes ? "YES" : "NO"}` : status === "invalid" ? "Invalid: full refunds" : status === "closed" ? "Closed, awaiting resolver" : "Open until close"}
            </dd>
            <dt>Source</dt><dd>{m.resolutionSource}</dd>
            <dt>Parameters</dt><dd><code>{params}</code></dd>
            {evidence && "observed" in evidence && (
              <>
                <dt>Observed</dt>
                <dd className="mono-num">{String(evidence.observed)}{evidence.ref ? ` · ${String(evidence.ref)}` : ""}</dd>
                {evidence.op !== undefined && !("invalid" in evidence) && (
                  <>
                    <dt>Condition</dt>
                    <dd>
                      value {String(evidence.op)} {String(evidence.threshold)}:{" "}
                      <span className={m.outcome === Outcome.Yes ? "accent-text" : ""}>{m.outcome === Outcome.Yes ? "met → YES" : "not met → NO"}</span>
                    </dd>
                  </>
                )}
              </>
            )}
            {m.resolutionEvidence && (!evidence || !("observed" in evidence) || "invalid" in evidence) && (
              <><dt>Evidence</dt><dd><code>{m.resolutionEvidence}</code></dd></>
            )}
            {m.resolvedAt > 0 && <><dt>Settled at</dt><dd>{utc(m.resolvedAt)}</dd></>}
            {m.resolvedAt > 0 && <><dt>Settled by</dt><dd>{link(addressUrl(m.resolvedBy), shortAddress(m.resolvedBy))}</dd></>}
            {resolution && <><dt>Settlement tx</dt><dd>{link(txUrl(resolution.tx), shortAddress(resolution.tx))}</dd></>}
            <dt>Fee</dt><dd>{m.feeBps / 100}% of the losing pool{m.fee > 0n ? ` · ${botLabel(m.fee, 4)} charged` : ""}</dd>
          </dl>
        </section>

        <section className="section">
          <span className="label">On-chain record</span>
          <dl className="kv">
            <dt>Contract</dt><dd>{stakeAddress ? link(addressUrl(stakeAddress), stakeAddress) : "—"}</dd>
            <dt>Market ID</dt><dd>{m.id}</dd>
            <dt>Created</dt><dd>{utc(m.createdAt)}{creation ? <> · {link(txUrl(creation.tx), "creation tx")}</> : null}</dd>
            <dt>Stake limits</dt><dd className="mono-num">{bot(m.minStake, 4)} min per stake · {bot(m.maxStake)} max per wallet</dd>
          </dl>
        </section>

        <section className="section" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0 }}>
          <span className="label" style={{ paddingLeft: 28 }}>Positions</span>
          {activity.isError ? (
            <div className="ledger-empty">Position history is unavailable right now (indexer offline). Pool totals above are read directly from the contract.</div>
          ) : positions.length === 0 ? (
            <div className="ledger-empty">{activity.isPending ? "Loading positions…" : "No positions yet. Be the first."}</div>
          ) : (
            <div className="ledger-wrap">
              <table className="ledger">
                <thead><tr><th>Predictor</th><th>Side</th><th className="num">Amount</th><th className="num opt">Block</th><th>Tx</th></tr></thead>
                <tbody>
                  {positions.map((p) => p.type === "position" && (
                    <tr key={`${p.tx}-${p.logIndex}`}>
                      <td><Link href={`/profile?address=${p.user}`}>{shortAddress(p.user)}</Link>{p.user === me ? " (you)" : ""}</td>
                      <td className={p.side === 1 ? "pos" : ""}>{p.side === 1 ? "YES" : "NO"}</td>
                      <td className="num">{bot(p.amount, 4)} BOT</td>
                      <td className="num opt">{p.block}</td>
                      <td>{link(txUrl(p.tx), shortAddress(p.tx))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <aside className="detail-rail" aria-label="Stake on this market">
        <div className="rail-sticky">
          {stakeAddress && <ActionPanel market={m} now={now} claimTx={myClaim?.tx ?? null} />}
        </div>
      </aside>
    </div>
  );
}
