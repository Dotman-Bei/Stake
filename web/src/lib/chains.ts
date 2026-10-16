import { defineChain, type Address } from "viem";

/**
 * BOT Chain networks.
 *
 * Values verified 2026-10-05 against https://dev-docs.botchain.ai/docs/Developers/quick-guide/,
 * https://chainlist.org/chain/677 and live eth_chainId calls (0x2a5 / 0x3c8).
 * Re-verify before each deployment (PRD §19); NEXT_PUBLIC_STAKE_RPC overrides the RPC.
 */
export const botMainnet = defineChain({
  id: 677,
  name: "BOT Chain",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.botchain.ai"], webSocket: ["wss://ws-rpc.botchain.ai"] } },
  blockExplorers: { default: { name: "BOTScan", url: "https://scan.botchain.ai" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

export const botTestnet = defineChain({
  id: 968,
  name: "BOT Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.bohr.life"] } },
  blockExplorers: { default: { name: "BOTScan Testnet", url: "https://scan.bohr.life" } },
  testnet: true,
});

export const localChain = defineChain({
  id: 31337,
  name: "Local Hardhat",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
  testnet: true,
});

export const FAUCET_URL = "https://faucet.botchain.ai/basic";
export const DOCS_URL = "https://dev-docs.botchain.ai/docs/Developers/quick-guide/";
/** Official BOT Chain site and mainnet explorer (verified 2026-10-16: both return 200). */
export const BOTCHAIN_SITE_URL = "https://www.botchain.ai";
export const BOTCHAIN_EXPLORER_URL = "https://scan.botchain.ai";

const network = process.env.NEXT_PUBLIC_STAKE_NETWORK ?? "testnet";
const base = network === "mainnet" ? botMainnet : network === "local" ? localChain : botTestnet;
const rpcOverride = process.env.NEXT_PUBLIC_STAKE_RPC;

export const activeChain = rpcOverride
  ? defineChain({ ...base, rpcUrls: { ...base.rpcUrls, default: { http: [rpcOverride] } } })
  : base;

export const rpcUrl = activeChain.rpcUrls.default.http[0];
export const explorerUrl = activeChain.blockExplorers?.default.url ?? null;

const contractEnv = process.env.NEXT_PUBLIC_STAKE_CONTRACT;
export const stakeAddress: Address | null =
  contractEnv && /^0x[0-9a-fA-F]{40}$/.test(contractEnv) ? (contractEnv as Address) : null;
export const deployBlock = BigInt(process.env.NEXT_PUBLIC_STAKE_DEPLOY_BLOCK || "0");

export const txUrl = (hash: string) => (explorerUrl ? `${explorerUrl}/tx/${hash}` : null);
export const addressUrl = (addr: string) => (explorerUrl ? `${explorerUrl}/address/${addr}` : null);
