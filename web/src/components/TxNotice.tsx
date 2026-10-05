import { txUrl } from "@/lib/chains";

export type TxState =
  | { stage: "idle" }
  | { stage: "wallet" }
  | { stage: "pending"; hash: string }
  | { stage: "done"; hash: string; message: string }
  | { stage: "error"; message: string };

/** Inline transaction feedback with an explorer link once a hash exists. */
export function TxNotice({ tx }: { tx: TxState }) {
  if (tx.stage === "idle") return null;
  if (tx.stage === "wallet") return <div className="notice" role="status">Confirm the transaction in your wallet…</div>;
  if (tx.stage === "error") return <div className="notice err" role="alert">{tx.message}</div>;
  const url = txUrl(tx.hash);
  const link = url ? <a className="ext" href={url} target="_blank" rel="noreferrer">View transaction</a> : <code>{tx.hash.slice(0, 18)}…</code>;
  if (tx.stage === "pending") return <div className="notice" role="status">Waiting for BOT Chain confirmation… {link}</div>;
  return <div className="notice ok" role="status">{tx.message} {link}</div>;
}
