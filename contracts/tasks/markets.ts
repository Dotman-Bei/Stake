import { task, types } from "hardhat/config";
import fs from "node:fs";
import path from "node:path";

/**
 * Operator tooling for the authorized market creator (PRD §8).
 *
 * Every template produces a deterministic `resolutionParams` JSON document that the
 * resolver service (`/resolver`) evaluates at close. The schema is documented in README
 * "Resolution system".
 */

type Template = "bot-price" | "crypto-price" | "chain-txs" | "address-txs" | "erc20-supply";

const OPS: Record<string, string> = { ">": "above", ">=": "at or above", "<": "below", "<=": "at or below" };
const COUNT_OPS: Record<string, string> = { ">": "more than", ">=": "at least", "<": "fewer than", "<=": "at most" };
const TYPE = { BotPrice: 0, CryptoPrice: 1, EcosystemMetric: 2, EcosystemEvent: 3 } as const;

function utcLabel(ts: number) {
  const d = new Date(ts * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const day = d.toISOString().slice(0, 10);
  return `${hh}:${mm} UTC on ${day}`;
}

function loadDeployment(chainId: bigint) {
  const file = path.join(__dirname, "..", "deployments", `${chainId}.json`);
  if (!fs.existsSync(file)) throw new Error(`No deployment record for chain ${chainId}. Deploy first or pass --contract.`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as { address: string };
}

task("stake:create", "Create a STAKE market from a template")
  .addParam("template", "bot-price | crypto-price | chain-txs | address-txs | erc20-supply")
  .addParam("threshold", "Threshold value (USD price, count or token units)")
  .addOptionalParam("op", "Comparison: > >= < <=", ">")
  .addOptionalParam("minutes", "Minutes until close", 60, types.int)
  .addOptionalParam("asset", "CoinGecko id for crypto-price (e.g. bitcoin, ethereum)", "bitcoin")
  .addOptionalParam("symbol", "Display symbol for crypto-price", "BTC")
  .addOptionalParam("target", "Address for address-txs / token for erc20-supply")
  .addOptionalParam("label", "Human label for address-txs / erc20-supply", "")
  .addOptionalParam("decimals", "Token decimals for erc20-supply", 18, types.int)
  .addOptionalParam("dataChain", "Chain ID the on-chain metric is read from (default: BOT mainnet 677)", 677, types.int)
  .addOptionalParam("min", "Minimum stake per deposit in BOT", "0.1")
  .addOptionalParam("max", "Maximum position in BOT", "100")
  .addOptionalParam("contract", "StakeMarkets address (defaults to deployments/<chainId>.json)")
  .addFlag("dryRun", "Print the market without sending a transaction")
  .setAction(async (args, hre) => {
    const { ethers } = hre;
    const template = args.template as Template;
    const op = args.op as string;
    if (!OPS[op]) throw new Error(`Unsupported op ${op}`);
    if (!(Number(args.threshold) >= 0)) throw new Error("threshold must be a non-negative number");

    const latest = await ethers.provider.getBlock("latest");
    const closeTime = Number(latest!.timestamp) + Number(args.minutes) * 60;
    const when = utcLabel(closeTime);
    const word = OPS[op];
    const t = args.threshold as string;

    let marketType: number;
    let question: string;
    let description: string;
    let source: string;
    let params: Record<string, unknown>;

    switch (template) {
      case "bot-price":
        marketType = TYPE.BotPrice;
        question = `Will BOT be ${word} $${t} at ${when}?`;
        source = "BOT Chain explorer stats API: scan.botchain.ai/api/v2/stats (coin_price)";
        description = `Resolves YES if the BOT/USD coin_price reported by the BOT Chain explorer, sampled at close, is ${word} ${t}. A sample taken more than 10 minutes after close resolves INVALID (refund).`;
        params = { kind: "price", feed: "blockscout", url: "https://scan.botchain.ai/api/v2/stats", field: "coin_price", op, threshold: t, maxDelaySec: 600 };
        break;
      case "crypto-price":
        marketType = TYPE.CryptoPrice;
        question = `Will ${args.symbol} be ${word} $${t} at ${when}?`;
        source = `CoinGecko simple price API: ${args.asset}/usd`;
        description = `Resolves YES if CoinGecko's ${args.symbol}/USD price sampled at close is ${word} ${t}. A sample taken more than 10 minutes after close resolves INVALID (refund).`;
        params = { kind: "price", feed: "coingecko", id: args.asset, op, threshold: t, maxDelaySec: 600 };
        break;
      case "chain-txs":
        marketType = TYPE.EcosystemMetric;
        question = `Will BOT Chain total transactions be ${word} ${Number(t).toLocaleString("en-US")} at ${when}?`;
        source = "BOT Chain explorer stats API: scan.botchain.ai/api/v2/stats (total_transactions)";
        description = `Resolves YES if total_transactions reported by the BOT Chain mainnet explorer, sampled at close, is ${word} ${t}. A sample taken more than 10 minutes after close resolves INVALID (refund).`;
        params = { kind: "explorerStat", url: "https://scan.botchain.ai/api/v2/stats", field: "total_transactions", op, threshold: t, maxDelaySec: 600 };
        break;
      case "address-txs":
        if (!args.target) throw new Error("--target address required");
        marketType = TYPE.EcosystemEvent;
        question = `Will ${args.label || args.target} have sent ${COUNT_OPS[op]} ${t} transactions by ${when}?`;
        source = `eth_getTransactionCount(${args.target}) on chain ${args.dataChain} at the first block at/after close`;
        description = `Resolves YES if the account nonce of ${args.target} on chain ${args.dataChain}, read at the first block whose timestamp is at or after close, is ${word} ${t}. Anyone can re-check this on-chain.`;
        params = { kind: "txCount", chainId: args.dataChain, address: args.target, op, threshold: t };
        break;
      case "erc20-supply":
        if (!args.target) throw new Error("--target token address required");
        marketType = TYPE.EcosystemMetric;
        question = `Will ${args.label || "the token"} supply be ${word} ${t} at ${when}?`;
        source = `ERC-20 totalSupply() of ${args.target} on chain ${args.dataChain} at the first block at/after close`;
        description = `Resolves YES if totalSupply() of ${args.target} (${args.decimals} decimals) on chain ${args.dataChain}, read at the first block whose timestamp is at or after close, is ${word} ${t}. Anyone can re-check this on-chain.`;
        params = { kind: "erc20Supply", chainId: args.dataChain, token: args.target, decimals: args.decimals, op, threshold: t };
        break;
      default:
        throw new Error(`Unknown template ${template}`);
    }

    const create = {
      marketType,
      question,
      description,
      resolutionSource: source,
      resolutionParams: JSON.stringify(params),
      openTime: 0,
      closeTime,
      minStake: ethers.parseEther(args.min),
      maxStake: ethers.parseEther(args.max),
    };

    console.log(JSON.stringify({ ...create, minStake: args.min, maxStake: args.max }, null, 2));
    if (args.dryRun) return;

    const { chainId } = await ethers.provider.getNetwork();
    const address = args.contract ?? loadDeployment(chainId).address;
    const contract = await ethers.getContractAt("StakeMarkets", address);
    const tx = await contract.createMarket(create);
    const receipt = await tx.wait();
    const event = receipt!.logs
      .map((l) => { try { return contract.interface.parseLog(l); } catch { return null; } })
      .find((e) => e?.name === "MarketCreated");
    console.log(`market #${event?.args.marketId} created in tx ${receipt!.hash}`);
  });

task("stake:cancel", "Owner: void a market so every staker is refunded")
  .addParam("id", "Market ID", undefined, types.int)
  .addParam("reason", "Reason recorded on-chain")
  .addOptionalParam("contract", "StakeMarkets address")
  .setAction(async (args, hre) => {
    const { chainId } = await hre.ethers.provider.getNetwork();
    const address = args.contract ?? loadDeployment(chainId).address;
    const contract = await hre.ethers.getContractAt("StakeMarkets", address);
    const tx = await contract.cancelMarket(args.id, args.reason);
    console.log(`cancel tx ${(await tx.wait())!.hash}`);
  });

task("stake:withdraw-fees", "Owner: send accrued fees to the treasury")
  .addOptionalParam("contract", "StakeMarkets address")
  .setAction(async (args, hre) => {
    const { chainId } = await hre.ethers.provider.getNetwork();
    const address = args.contract ?? loadDeployment(chainId).address;
    const contract = await hre.ethers.getContractAt("StakeMarkets", address);
    console.log(`accrued ${hre.ethers.formatEther(await contract.accruedFees())} BOT`);
    const tx = await contract.withdrawFees();
    console.log(`withdraw tx ${(await tx.wait())!.hash}`);
  });
