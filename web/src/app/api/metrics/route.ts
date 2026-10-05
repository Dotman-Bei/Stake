import { NextResponse } from "next/server";
import { getActivity, readAllMarkets } from "@/lib/indexer";
import { aggregate } from "@/lib/activity";
import { MarketType, toMarket, type RawMarket } from "@/lib/markets";
import { activeChain, stakeAddress } from "@/lib/chains";
import { formatEther } from "viem";

export const dynamic = "force-dynamic";

/**
 * On-chain usage metrics for incubation reporting (PRD §4.6, §24). Every number is derived from
 * contract state and event logs only; nothing is estimated or entered by hand.
 */
export async function GET() {
  if (!stakeAddress) return NextResponse.json({ error: "contract-not-configured" }, { status: 503 });
  try {
    const [activity, raw] = await Promise.all([getActivity(), readAllMarkets()]);
    const markets = raw.map((r, i) => toMarket(i, r as RawMarket));
    const now = Math.floor(Date.now() / 1000);
    const agg = aggregate(activity.events, markets, now);
    const users = [...agg.users.values()];
    const ecosystemIds = new Set(markets.filter((m) => m.marketType !== MarketType.CryptoPrice).map((m) => m.id));
    const ecosystemUsers = new Set<string>();
    for (const [id, holders] of agg.holdings) if (ecosystemIds.has(id)) for (const u of holders.keys()) ecosystemUsers.add(u);

    const contractTxs = new Set(activity.events.map((e) => e.tx)).size;
    return NextResponse.json({
      chainId: activeChain.id,
      contract: stakeAddress,
      blocks: { from: activity.fromBlock, to: activity.toBlock },
      generatedAt: new Date().toISOString(),
      onchain: {
        marketsCreated: markets.length,
        marketsResolved: markets.filter((m) => m.outcome === 1 || m.outcome === 2).length,
        marketsRefunded: markets.filter((m) => m.outcome === 3).length,
        positionsCreated: agg.platform.positions,
        predictionVolumeBOT: formatEther(agg.platform.volume),
        payoutClaims: agg.platform.claims,
        claimedBOT: formatEther(agg.platform.claimedVolume),
        contractTransactionsWithEvents: contractTxs,
      },
      usage: {
        uniquePredictors: agg.platform.predictors,
        averageStakeBOT: agg.platform.positions ? formatEther(agg.platform.volume / BigInt(agg.platform.positions)) : "0",
        averageMarketsPerUser: users.length ? users.reduce((s, u) => s + u.marketsEntered, 0) / users.length : 0,
        repeatPredictors: users.filter((u) => u.marketsEntered > 1).length,
      },
      ecosystem: {
        botEcosystemMarkets: ecosystemIds.size,
        usersInBotEcosystemMarkets: ecosystemUsers.size,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "rpc-unavailable", detail: (err as Error).message.slice(0, 200) }, { status: 502 });
  }
}
