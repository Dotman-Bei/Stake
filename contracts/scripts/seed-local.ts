import { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";

/**
 * LOCAL DEVELOPMENT ONLY. Populates a Hardhat node with sample markets and positions so the
 * frontend can be exercised end to end. Refuses to run on any other chain: STAKE never
 * fabricates activity on BOT Chain (PRD §28.11).
 */
async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== 31337n) throw new Error(`seed-local only runs on chain 31337, got ${chainId}`);

  const record = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "31337.json"), "utf8"));
  const stake = await ethers.getContractAt("StakeMarkets", record.address);
  const [operator, , , , ...users] = await ethers.getSigners();
  const now = Number((await ethers.provider.getBlock("latest"))!.timestamp);
  const bot = (n: number) => ethers.parseEther(String(n));

  const markets = [
    { t: 0, q: "Will BOT be above $12.50 at the next hour?", src: "BOT Chain explorer stats API: scan.botchain.ai/api/v2/stats (coin_price)", p: { kind: "price", feed: "blockscout", url: "https://scan.botchain.ai/api/v2/stats", field: "coin_price", op: ">", threshold: "12.5", maxDelaySec: 600 }, mins: 3 },
    { t: 1, q: "Will BTC be above $85,000 in 4 hours?", src: "CoinGecko simple price API: bitcoin/usd", p: { kind: "price", feed: "coingecko", id: "bitcoin", op: ">", threshold: "85000", maxDelaySec: 600 }, mins: 240 },
    { t: 2, q: "Will BOT Chain total transactions be above 22,100,000 by tonight?", src: "BOT Chain explorer stats API: scan.botchain.ai/api/v2/stats (total_transactions)", p: { kind: "explorerStat", url: "https://scan.botchain.ai/api/v2/stats", field: "total_transactions", op: ">", threshold: "22100000", maxDelaySec: 600 }, mins: 600 },
    { t: 1, q: "Will ETH be below $2,600 in 30 minutes?", src: "CoinGecko simple price API: ethereum/usd", p: { kind: "price", feed: "coingecko", id: "ethereum", op: "<", threshold: "2600", maxDelaySec: 600 }, mins: 30 },
    { t: 3, q: "Will the WBOT contract supply exceed 5,000,000 by tomorrow?", src: "ERC-20 totalSupply() of 0xD5452816194a3784dBa983426cCe7c122F4abd30 on chain 677", p: { kind: "erc20Supply", chainId: 677, token: "0xD5452816194a3784dBa983426cCe7c122F4abd30", decimals: 18, op: ">", threshold: "5000000" }, mins: 1440 },
  ];

  for (const m of markets) {
    await (await stake.connect(operator).createMarket({
      marketType: m.t,
      question: m.q,
      description: "Local development market. Resolves from the declared source at close.",
      resolutionSource: m.src,
      resolutionParams: JSON.stringify(m.p),
      openTime: 0,
      closeTime: now + m.mins * 60,
      minStake: bot(0.1),
      maxStake: bot(100),
    })).wait();
  }

  const stakes: [number, number, 1 | 2, number][] = [
    [0, 0, 1, 5], [0, 1, 2, 3], [0, 2, 1, 2],
    [1, 0, 1, 10], [1, 3, 2, 4], [1, 4, 2, 6], [1, 5, 1, 1],
    [2, 1, 1, 8], [2, 2, 2, 2],
    [3, 3, 1, 1.5], [3, 4, 2, 0.5],
  ];
  for (const [id, u, side, amt] of stakes) {
    await (await stake.connect(users[u]).stake(id, side, { value: bot(amt) })).wait();
  }
  console.log(`seeded ${markets.length} markets and ${stakes.length} positions on ${record.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
