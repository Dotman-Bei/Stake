"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { stakeMarketsAbi } from "@/lib/abi";
import { stakeAddress } from "@/lib/chains";
import { describeError } from "@/lib/errors";
import { TEMPLATES, buildDraft, type Op, type TemplateKey } from "@/lib/templates";
import { useNow } from "@/hooks/useStake";
import { TxNotice, type TxState } from "./TxNotice";

/** Collapsible creation band (frontend.md §6.3). Only rendered for wallets with the on-chain creator role. */
export function CreateMarketPanel({ onClose }: { onClose: () => void }) {
  const now = useNow(15_000);
  const client = usePublicClient();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [tx, setTx] = useState<TxState>({ stage: "idle" });
  const [f, setF] = useState({
    template: "bot-price" as TemplateKey, op: ">" as Op, threshold: "", minutes: "60",
    asset: "bitcoin", symbol: "BTC", target: "", label: "", decimals: "18", min: "0.1", max: "100",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const minutes = Number(f.minutes);
  const closeTime = (now || Math.floor(Date.now() / 1000)) + Math.round((Number.isFinite(minutes) ? minutes : 0) * 60);
  const draft = f.threshold
    ? buildDraft({ template: f.template, op: f.op, threshold: f.threshold, closeTime, asset: f.asset, symbol: f.symbol, target: f.target, label: f.label, decimals: Number(f.decimals) })
    : null;
  const draftError = draft && "error" in draft ? draft.error : null;
  const busy = tx.stage === "wallet" || tx.stage === "pending";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stakeAddress || !client) return;
    if (!(minutes >= 1 && minutes <= 30 * 24 * 60)) return setTx({ stage: "error", message: "Duration must be between 1 minute and 30 days." });
    // Rebuild with a fresh close time so the question's deadline matches what is sent.
    const fresh = Math.floor(Date.now() / 1000) + Math.round(minutes * 60);
    const d = buildDraft({ template: f.template, op: f.op, threshold: f.threshold, closeTime: fresh, asset: f.asset, symbol: f.symbol, target: f.target, label: f.label, decimals: Number(f.decimals) });
    if ("error" in d) return setTx({ stage: "error", message: d.error });
    let minStake: bigint, maxStake: bigint;
    try { minStake = parseEther(f.min); maxStake = parseEther(f.max); } catch { return setTx({ stage: "error", message: "Stake limits must be BOT amounts." }); }

    try {
      setTx({ stage: "wallet" });
      const hash = await writeContractAsync({
        address: stakeAddress, abi: stakeMarketsAbi, functionName: "createMarket",
        args: [{ ...d, openTime: 0n, closeTime: BigInt(fresh), minStake, maxStake }],
      });
      setTx({ stage: "pending", hash });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted.");
      setTx({ stage: "done", hash, message: "Market created on-chain." });
      await queryClient.invalidateQueries({ queryKey: ["markets"] });
      setF((s) => ({ ...s, threshold: "" }));
    } catch (err) {
      setTx({ stage: "error", message: describeError(err) });
    }
  }

  return (
    <section className="create-panel" aria-labelledby="create-title">
      <div className="create-panel-intro">
        <div className="label">Operator market</div>
        <h2 id="create-title">Open a market for BOT predictors</h2>
        <p>Templates only: each question is generated from a deterministic resolution source, so every market can be settled and re-checked.</p>
      </div>
      <form className="create-form" onSubmit={submit}>
        <label className="field half">
          <span className="label">Template</span>
          <select value={f.template} onChange={set("template")}>
            {TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">Condition</span>
          <select value={f.op} onChange={set("op")}>
            <option value=">">above (&gt;)</option>
            <option value=">=">at or above (≥)</option>
            <option value="<">below (&lt;)</option>
            <option value="<=">at or below (≤)</option>
          </select>
        </label>
        <label className="field">
          <span className="label">Threshold</span>
          <input inputMode="decimal" placeholder="12.5" value={f.threshold} onChange={set("threshold")} required />
        </label>

        {f.template === "crypto-price" && (
          <>
            <label className="field half"><span className="label">CoinGecko id</span><input value={f.asset} onChange={set("asset")} placeholder="bitcoin" /></label>
            <label className="field half"><span className="label">Symbol</span><input value={f.symbol} onChange={set("symbol")} placeholder="BTC" /></label>
          </>
        )}
        {(f.template === "address-txs" || f.template === "erc20-supply") && (
          <>
            <label className="field half"><span className="label">{f.template === "address-txs" ? "Account address" : "Token address"}</span><input value={f.target} onChange={set("target")} placeholder="0x…" /></label>
            <label className="field"><span className="label">Display name</span><input value={f.label} onChange={set("label")} placeholder="optional" /></label>
            {f.template === "erc20-supply" && <label className="field"><span className="label">Decimals</span><input inputMode="numeric" value={f.decimals} onChange={set("decimals")} /></label>}
          </>
        )}

        <label className="field">
          <span className="label">Closes in (min)</span>
          <input inputMode="numeric" value={f.minutes} onChange={set("minutes")} />
        </label>
        <label className="field">
          <span className="label">Min stake (BOT)</span>
          <input inputMode="decimal" value={f.min} onChange={set("min")} />
        </label>
        <label className="field">
          <span className="label">Max position (BOT)</span>
          <input inputMode="decimal" value={f.max} onChange={set("max")} />
        </label>

        <div className="field full">
          <span className="label">Question preview</span>
          <div className="notice">{draft && !("error" in draft) ? draft.question : "Enter a threshold to generate the question."}</div>
          {draft && !("error" in draft) && <span className="hint">Source: {draft.resolutionSource}</span>}
          {draftError && <span className="hint danger">{draftError}</span>}
        </div>

        <div className="full"><TxNotice tx={tx} /></div>
        <div className="create-form-actions">
          <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="create-button" disabled={busy || !draft || !!draftError}>{busy ? "Creating…" : "Create market"}</button>
        </div>
      </form>
    </section>
  );
}
