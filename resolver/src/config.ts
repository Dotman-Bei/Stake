import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineChain, type Address, type Hex } from "viem";

const here = path.dirname(fileURLToPath(import.meta.url));

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. See resolver/.env.example`);
  return v;
}

/** Accepts keys with or without the 0x prefix (wallet exports differ). */
function normalizeKey(raw: string): Hex {
  const k = raw.trim().replace(/^["']|["']$/g, "");
  const hex = k.startsWith("0x") ? k : `0x${k}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) throw new Error("RESOLVER_PRIVATE_KEY must be 64 hex characters");
  return hex as Hex;
}

const chainId = Number(required("STAKE_CHAIN_ID"));
const rpcUrl = required("STAKE_RPC_URL");

/** Contract address from env, falling back to the deploy record written by contracts/scripts/deploy.ts. */
function contractAddress(): Address {
  if (process.env.STAKE_CONTRACT) return process.env.STAKE_CONTRACT as Address;
  const file = path.join(here, "..", "..", "contracts", "deployments", `${chainId}.json`);
  if (!fs.existsSync(file)) throw new Error(`Set STAKE_CONTRACT or deploy first (${file} not found)`);
  return JSON.parse(fs.readFileSync(file, "utf8")).address as Address;
}

/**
 * Chains that on-chain metric markets may read from. Defaults are the BOT Chain RPCs verified on
 * 2026-10-05 against dev-docs.botchain.ai and live eth_chainId calls; override with DATA_RPC_<id>.
 */
const dataRpcs: Record<number, string> = {
  677: process.env.DATA_RPC_677 ?? "https://rpc.botchain.ai",
  968: process.env.DATA_RPC_968 ?? "https://rpc.bohr.life",
};
for (const [k, v] of Object.entries(process.env)) {
  const m = k.match(/^DATA_RPC_(\d+)$/);
  if (m && v) dataRpcs[Number(m[1])] = v;
}
dataRpcs[chainId] ??= rpcUrl;

export const config = {
  chain: defineChain({
    id: chainId,
    name: `stake-${chainId}`,
    nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  }),
  rpcUrl,
  contract: contractAddress(),
  privateKey: normalizeKey(required("RESOLVER_PRIVATE_KEY")),
  pollSeconds: Number(process.env.POLL_SECONDS ?? 15),
  /** Resolve INVALID this many seconds before the contract's 3-day grace window ends. */
  giveUpMarginSeconds: Number(process.env.GIVE_UP_MARGIN_SECONDS ?? 3600),
  /** Fixed fee in gwei. BOT Chain base fee is 0 and eth_gasPrice swings 20↔50 gwei, so pin it (0 = node default). */
  gasPriceGwei: Number(process.env.GAS_PRICE_GWEI ?? 20),
  dataRpcs,
};
