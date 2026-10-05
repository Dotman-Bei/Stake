import { formatEther } from "viem";

/** BOT amount with at most `dp` decimals, trailing zeros trimmed. */
export function bot(value: bigint, dp = 2): string {
  const [int, frac = ""] = formatEther(value).split(".");
  const intFmt = BigInt(int).toLocaleString("en-US");
  const f = frac.slice(0, dp).replace(/0+$/, "");
  if (!f && value > 0n && int === "0") return `<0.${"0".repeat(dp - 1)}1`;
  return f ? `${intFmt}.${f}` : intFmt;
}

export const botLabel = (value: bigint, dp = 2) => `${bot(value, dp)} BOT`;

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** "2h 14m", "38s", "3d 4h" until `ts`, or "Closed". */
export function timeLeft(ts: number, now: number): string {
  let s = ts - now;
  if (s <= 0) return "Closed";
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function utc(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

export const pct = (n: number) => `${Math.round(n)}%`;

/** Payout multiple like "1.42x" for a quote. */
export function multiple(payout: bigint, stake: bigint): string {
  if (stake === 0n) return "—";
  return `${(Number((payout * 100n) / stake) / 100).toFixed(2)}x`;
}

/** Two-character initials for an address avatar. */
export const initials = (a: string) => a.slice(2, 4).toUpperCase();
