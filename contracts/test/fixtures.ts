import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

export const Side = { None: 0, Yes: 1, No: 2 } as const;
export const Outcome = { Unresolved: 0, Yes: 1, No: 2, Invalid: 3 } as const;
export const Status = { Upcoming: 0, Open: 1, Closed: 2, Resolved: 3, Invalid: 4 } as const;
export const MarketType = { BotPrice: 0, CryptoPrice: 1, EcosystemMetric: 2, EcosystemEvent: 3 } as const;

export const FEE_BPS = 100n; // 1%
export const BOT = (n: string | number) => ethers.parseEther(String(n));
export const HOUR = 3600;
export const GRACE = 3 * 24 * HOUR;

export async function deployFixture() {
  const [owner, creator, resolver, treasury, alice, bob, carol, outsider] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("StakeMarkets");
  const stake = await Factory.deploy(owner.address, creator.address, resolver.address, treasury.address, FEE_BPS);
  await stake.waitForDeployment();
  return { stake, owner, creator, resolver, treasury, alice, bob, carol, outsider };
}

export async function marketParams(overrides: Partial<Record<string, unknown>> = {}) {
  const now = await time.latest();
  return {
    marketType: MarketType.BotPrice,
    question: "Will BOT be above $12.50 at 20:00 UTC?",
    description: "Resolves YES if the BOT/USD price sampled at close is strictly above 12.50.",
    resolutionSource: "blockscout:scan.botchain.ai/api/v2/stats#coin_price",
    resolutionParams: '{"kind":"price","feed":"blockscout:BOT","op":">","threshold":"12.5"}',
    openTime: 0,
    closeTime: now + HOUR,
    minStake: BOT("0.1"),
    maxStake: BOT(100),
    ...overrides,
  };
}

/** Deploys and creates market #0, open now, closing in one hour. */
export async function openMarketFixture() {
  const ctx = await deployFixture();
  const params = await marketParams();
  await ctx.stake.connect(ctx.creator).createMarket(params);
  return { ...ctx, params, marketId: 0n };
}
