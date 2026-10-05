/**
 * Resolution parameter schema (stored on-chain in `Market.resolutionParams`) and the
 * deterministic comparison used to turn an observed value into an outcome.
 */

export type Op = ">" | ">=" | "<" | "<=";

export type PriceParams = {
  kind: "price";
  feed: "blockscout" | "coingecko";
  url?: string; // blockscout stats endpoint
  field?: string; // blockscout field, e.g. coin_price
  id?: string; // coingecko id, e.g. bitcoin
  op: Op;
  threshold: string;
  maxDelaySec: number;
};

export type ExplorerStatParams = {
  kind: "explorerStat";
  url: string;
  field: string;
  op: Op;
  threshold: string;
  maxDelaySec: number;
};

export type TxCountParams = { kind: "txCount"; chainId: number; address: `0x${string}`; op: Op; threshold: string };

export type Erc20SupplyParams = {
  kind: "erc20Supply";
  chainId: number;
  token: `0x${string}`;
  decimals: number;
  op: Op;
  threshold: string;
};

export type ResolutionParams = PriceParams | ExplorerStatParams | TxCountParams | Erc20SupplyParams;

const OPS: readonly Op[] = [">", ">=", "<", "<="];
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DECIMAL = /^\d+(\.\d+)?$/;

/** Parses and validates params. Throws on anything ambiguous: the market must then resolve INVALID. */
export function parseParams(raw: string): ResolutionParams {
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(raw);
  } catch {
    throw new Error("resolutionParams is not valid JSON");
  }
  if (!OPS.includes(p.op as Op)) throw new Error(`unsupported op ${String(p.op)}`);
  if (typeof p.threshold !== "string" || !DECIMAL.test(p.threshold)) throw new Error("threshold must be a decimal string");

  switch (p.kind) {
    case "price":
      if (p.feed === "blockscout" && (typeof p.url !== "string" || typeof p.field !== "string")) throw new Error("blockscout feed needs url and field");
      if (p.feed === "coingecko" && typeof p.id !== "string") throw new Error("coingecko feed needs id");
      if (p.feed !== "blockscout" && p.feed !== "coingecko") throw new Error(`unsupported feed ${String(p.feed)}`);
      return { ...(p as PriceParams), maxDelaySec: Number(p.maxDelaySec ?? 600) };
    case "explorerStat":
      if (typeof p.url !== "string" || typeof p.field !== "string") throw new Error("explorerStat needs url and field");
      return { ...(p as ExplorerStatParams), maxDelaySec: Number(p.maxDelaySec ?? 600) };
    case "txCount":
      if (typeof p.address !== "string" || !ADDRESS.test(p.address)) throw new Error("txCount needs a valid address");
      if (!Number.isInteger(p.chainId)) throw new Error("txCount needs chainId");
      return p as TxCountParams;
    case "erc20Supply":
      if (typeof p.token !== "string" || !ADDRESS.test(p.token)) throw new Error("erc20Supply needs a valid token");
      if (!Number.isInteger(p.chainId) || !Number.isInteger(p.decimals)) throw new Error("erc20Supply needs chainId and decimals");
      return p as Erc20SupplyParams;
    default:
      throw new Error(`unsupported kind ${String(p.kind)}`);
  }
}

const SCALE = 18;

/** Converts a non-negative decimal string to a fixed-point bigint (18 dp), truncating extra digits. */
export function toFixed(value: string): bigint {
  const v = value.trim();
  if (!DECIMAL.test(v)) throw new Error(`not a non-negative decimal: ${value}`);
  const [int, frac = ""] = v.split(".");
  return BigInt(int + frac.slice(0, SCALE).padEnd(SCALE, "0"));
}

/** Exact decimal comparison (no floating point). */
export function compare(observed: string, op: Op, threshold: string): boolean {
  const a = toFixed(observed);
  const b = toFixed(threshold);
  switch (op) {
    case ">": return a > b;
    case ">=": return a >= b;
    case "<": return a < b;
    case "<=": return a <= b;
  }
}

/** Formats an integer amount with `decimals` into a decimal string. */
export function formatUnits(value: bigint, decimals: number): string {
  const s = value.toString().padStart(decimals + 1, "0");
  const int = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

/** Numbers from JSON APIs can arrive in exponent form; normalise to a plain decimal string. */
export function numberToDecimal(n: number | string): string {
  if (typeof n === "string") {
    if (DECIMAL.test(n.trim())) return n.trim();
    n = Number(n);
  }
  if (!Number.isFinite(n) || n < 0) throw new Error(`invalid observed value ${n}`);
  return n.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 18 });
}
