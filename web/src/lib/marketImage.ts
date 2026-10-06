/**
 * Square market image (frontend.md §6.5: "a square image, or without one a fallback visual").
 * Chosen from the market's on-chain resolution params, so no extra contract field is needed.
 * Assets are self-hosted in /public/markets:
 *   bot-*.png  BOT Chain official site (botchain.ai/icons): token, on-chain data platform, DEX
 *   btc/eth    CoinGecko coin images
 */
import { MarketType, type Market } from "./markets";

export type MarketImage = { src: string; alt: string };

const BOT_TOKEN: MarketImage = { src: "/markets/bot-token.png", alt: "BOT token" };
const BOT_DATA: MarketImage = { src: "/markets/bot-data.png", alt: "BOT Chain on-chain data" };
const BOT_DEX: MarketImage = { src: "/markets/bot-dex.png", alt: "BOT Chain token" };

const COINS: Record<string, MarketImage> = {
  bitcoin: { src: "/markets/btc.png", alt: "Bitcoin" },
  ethereum: { src: "/markets/eth.png", alt: "Ethereum" },
  solana: { src: "/markets/sol.png", alt: "Solana" },
};

/** WBOT on BOT Chain mainnet (official docs). Supply markets on it show the BOT mark. */
const WBOT = "0xd5452816194a3784dba983426cce7c122f4abd30";

export function imageFor(m: Pick<Market, "marketType" | "resolutionParams">): MarketImage | null {
  let p: Record<string, unknown> = {};
  try {
    p = JSON.parse(m.resolutionParams) ?? {};
  } catch {
    /* fall through to the type default */
  }

  if (p.kind === "price" && p.feed === "coingecko") return COINS[String(p.id)] ?? null;
  if (p.kind === "price") return BOT_TOKEN;
  if (p.kind === "erc20Supply") return String(p.token).toLowerCase() === WBOT ? BOT_TOKEN : BOT_DEX;
  if (p.kind === "explorerStat" || p.kind === "txCount") return BOT_DATA;

  switch (m.marketType) {
    case MarketType.BotPrice: return BOT_TOKEN;
    case MarketType.EcosystemMetric:
    case MarketType.EcosystemEvent: return BOT_DATA;
    default: return null;
  }
}
