import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { BOT, FEE_BPS, GRACE, Outcome, Side, Status, openMarketFixture } from "./fixtures";

/** Market #0 with YES 70 (alice 50, carol 20) vs NO 30 (bob), moved past close. */
async function closedMarketFixture() {
  const ctx = await openMarketFixture();
  const { stake, alice, bob, carol, marketId, params } = ctx;
  await stake.connect(alice).stake(marketId, Side.Yes, { value: BOT(50) });
  await stake.connect(carol).stake(marketId, Side.Yes, { value: BOT(20) });
  await stake.connect(bob).stake(marketId, Side.No, { value: BOT(30) });
  await time.increaseTo(params.closeTime);
  return ctx;
}

const expectedPayout = (stakeAmt: bigint, total: bigint, winning: bigint, losing: bigint) => {
  const fee = (losing * FEE_BPS) / 10_000n;
  return (stakeAmt * (total - fee)) / winning;
};

describe("StakeMarkets — resolution", () => {
  it("only the resolver can resolve, and only after close", async () => {
    const ctx = await loadFixture(openMarketFixture);
    await expect(ctx.stake.connect(ctx.resolver).resolve(ctx.marketId, Outcome.Yes, "")).to.be.revertedWithCustomError(ctx.stake, "MarketNotClosed");
    await time.increaseTo(ctx.params.closeTime);
    await expect(ctx.stake.connect(ctx.outsider).resolve(ctx.marketId, Outcome.Yes, "")).to.be.revertedWithCustomError(ctx.stake, "NotResolver");
    await expect(ctx.stake.connect(ctx.creator).resolve(ctx.marketId, Outcome.Yes, "")).to.be.revertedWithCustomError(ctx.stake, "NotResolver");
  });

  it("records the outcome, evidence, resolver and fee on-chain", async () => {
    const { stake, resolver, marketId } = await loadFixture(closedMarketFixture);
    const evidence = '{"observed":"12.61","at":1760000000}';
    const fee = (BOT(30) * FEE_BPS) / 10_000n;
    await expect(stake.connect(resolver).resolve(marketId, Outcome.Yes, evidence))
      .to.emit(stake, "MarketResolved").withArgs(marketId, Outcome.Yes, resolver.address, fee, evidence);
    const m = await stake.getMarket(marketId);
    expect(m.outcome).to.equal(Outcome.Yes);
    expect(m.resolutionEvidence).to.equal(evidence);
    expect(m.resolvedBy).to.equal(resolver.address);
    expect(m.fee).to.equal(fee);
    expect(await stake.accruedFees()).to.equal(fee);
    expect(await stake.status(marketId)).to.equal(Status.Resolved);
  });

  it("prevents a second settlement", async () => {
    const { stake, resolver, owner, marketId } = await loadFixture(closedMarketFixture);
    await stake.connect(resolver).resolve(marketId, Outcome.Yes, "");
    await expect(stake.connect(resolver).resolve(marketId, Outcome.No, "")).to.be.revertedWithCustomError(stake, "AlreadySettled");
    await expect(stake.connect(owner).cancelMarket(marketId, "late")).to.be.revertedWithCustomError(stake, "AlreadySettled");
  });

  it("rejects Unresolved as an outcome and oversize evidence", async () => {
    const { stake, resolver, marketId } = await loadFixture(closedMarketFixture);
    await expect(stake.connect(resolver).resolve(marketId, Outcome.Unresolved, "")).to.be.revertedWithCustomError(stake, "InvalidOutcome");
    await expect(stake.connect(resolver).resolve(marketId, Outcome.Yes, "x".repeat(501))).to.be.revertedWithCustomError(stake, "InvalidText");
  });

  it("converts a win for an empty side into Invalid (full refunds)", async () => {
    const ctx = await loadFixture(openMarketFixture);
    await ctx.stake.connect(ctx.alice).stake(ctx.marketId, Side.Yes, { value: BOT(5) });
    await time.increaseTo(ctx.params.closeTime);
    await expect(ctx.stake.connect(ctx.resolver).resolve(ctx.marketId, Outcome.No, ""))
      .to.emit(ctx.stake, "MarketResolved").withArgs(ctx.marketId, Outcome.Invalid, ctx.resolver.address, 0, "");
    await expect(ctx.stake.connect(ctx.alice).claim(ctx.marketId)).to.changeEtherBalance(ctx.alice, BOT(5));
  });

  it("closes the resolver window after the grace period", async () => {
    const { stake, resolver, params, marketId } = await loadFixture(closedMarketFixture);
    await time.increaseTo(params.closeTime + GRACE + 1);
    await expect(stake.connect(resolver).resolve(marketId, Outcome.Yes, "")).to.be.revertedWithCustomError(stake, "ResolutionWindowOver");
  });
});

describe("StakeMarkets — voiding", () => {
  it("anyone can void a stale market only after the grace window", async () => {
    const { stake, outsider, params, marketId } = await loadFixture(closedMarketFixture);
    await expect(stake.connect(outsider).voidStaleMarket(marketId)).to.be.revertedWithCustomError(stake, "ResolutionWindowActive");
    await time.increaseTo(params.closeTime + GRACE + 1);
    await expect(stake.connect(outsider).voidStaleMarket(marketId)).to.emit(stake, "MarketVoided").withArgs(marketId, outsider.address, "resolution window expired");
    expect(await stake.status(marketId)).to.equal(Status.Invalid);
  });

  it("owner can cancel an open market and everyone is refunded", async () => {
    const ctx = await loadFixture(openMarketFixture);
    const { stake, owner, alice, bob, outsider, marketId } = ctx;
    await stake.connect(alice).stake(marketId, Side.Yes, { value: BOT(4) });
    await stake.connect(bob).stake(marketId, Side.No, { value: BOT(6) });
    await expect(stake.connect(outsider).cancelMarket(marketId, "bad source")).to.be.revertedWithCustomError(stake, "OwnableUnauthorizedAccount");
    await stake.connect(owner).cancelMarket(marketId, "bad source");
    await expect(stake.connect(alice).stake(marketId, Side.Yes, { value: BOT(1) })).to.be.revertedWithCustomError(stake, "MarketNotOpen");
    await expect(stake.connect(alice).claim(marketId)).to.emit(stake, "Claimed").withArgs(marketId, alice.address, BOT(4), true);
    await expect(stake.connect(bob).claim(marketId)).to.changeEtherBalance(bob, BOT(6));
    expect(await stake.accruedFees()).to.equal(0);
  });
});

describe("StakeMarkets — claims & payouts", () => {
  it("pays winners proportionally, minus the fee on the losing pool", async () => {
    const { stake, resolver, alice, carol, marketId } = await loadFixture(closedMarketFixture);
    await stake.connect(resolver).resolve(marketId, Outcome.Yes, "");
    const a = expectedPayout(BOT(50), BOT(100), BOT(70), BOT(30));
    const c = expectedPayout(BOT(20), BOT(100), BOT(70), BOT(30));
    expect(await stake.claimable(marketId, alice.address)).to.equal(a);
    await expect(stake.connect(alice).claim(marketId)).to.changeEtherBalance(alice, a);
    await expect(stake.connect(carol).claim(marketId)).to.emit(stake, "Claimed").withArgs(marketId, carol.address, c, false);
    expect(a + c).to.be.lte(BOT(100) - (BOT(30) * FEE_BPS) / 10_000n);
  });

  it("losing positions cannot claim", async () => {
    const { stake, resolver, bob, marketId } = await loadFixture(closedMarketFixture);
    await stake.connect(resolver).resolve(marketId, Outcome.Yes, "");
    expect(await stake.claimable(marketId, bob.address)).to.equal(0);
    await expect(stake.connect(bob).claim(marketId)).to.be.revertedWithCustomError(stake, "NotAWinner");
  });

  it("double claims are impossible", async () => {
    const { stake, resolver, alice, marketId } = await loadFixture(closedMarketFixture);
    await stake.connect(resolver).resolve(marketId, Outcome.Yes, "");
    await stake.connect(alice).claim(marketId);
    expect((await stake.getPosition(marketId, alice.address)).claimed).to.equal(true);
    expect(await stake.claimable(marketId, alice.address)).to.equal(0);
    await expect(stake.connect(alice).claim(marketId)).to.be.revertedWithCustomError(stake, "AlreadyClaimed");
  });

  it("cannot claim before settlement or without a position", async () => {
    const { stake, resolver, alice, outsider, marketId } = await loadFixture(closedMarketFixture);
    await expect(stake.connect(alice).claim(marketId)).to.be.revertedWithCustomError(stake, "NotSettled");
    await stake.connect(resolver).resolve(marketId, Outcome.No, "");
    await expect(stake.connect(outsider).claim(marketId)).to.be.revertedWithCustomError(stake, "NothingToClaim");
  });

  it("a one-sided winning market returns stakes with no fee", async () => {
    const ctx = await loadFixture(openMarketFixture);
    await ctx.stake.connect(ctx.alice).stake(ctx.marketId, Side.Yes, { value: BOT(3) });
    await time.increaseTo(ctx.params.closeTime);
    await ctx.stake.connect(ctx.resolver).resolve(ctx.marketId, Outcome.Yes, "");
    expect(await ctx.stake.accruedFees()).to.equal(0);
    await expect(ctx.stake.connect(ctx.alice).claim(ctx.marketId)).to.changeEtherBalance(ctx.alice, BOT(3));
  });

  it("stays solvent: all claims plus fees never exceed the pool", async () => {
    const { stake, resolver, owner, treasury, alice, carol, marketId } = await loadFixture(closedMarketFixture);
    await stake.connect(resolver).resolve(marketId, Outcome.Yes, "");
    const a = await stake.claimable(marketId, alice.address);
    const c = await stake.claimable(marketId, carol.address);
    await stake.connect(alice).claim(marketId);
    await stake.connect(carol).claim(marketId);
    const fees = await stake.accruedFees();
    await expect(stake.connect(owner).withdrawFees()).to.changeEtherBalance(treasury, fees);
    // Only rounding dust (< one wei per winner) may remain.
    const left = await ethers.provider.getBalance(await stake.getAddress());
    expect(left).to.equal(BOT(100) - a - c - fees);
    expect(left).to.be.lt(2n);
    await expect(stake.connect(owner).withdrawFees()).to.be.revertedWithCustomError(stake, "NothingToClaim");
  });

  it("claims still work while paused", async () => {
    const { stake, owner, resolver, alice, marketId } = await loadFixture(closedMarketFixture);
    await stake.connect(resolver).resolve(marketId, Outcome.Yes, "");
    await stake.connect(owner).pause();
    await expect(stake.connect(alice).claim(marketId)).to.emit(stake, "Claimed");
  });
});

describe("StakeMarkets — security", () => {
  it("blocks re-entrancy during claim", async () => {
    const ctx = await loadFixture(openMarketFixture);
    const Attacker = await ethers.getContractFactory("ReentrantClaimer");
    const attacker = await Attacker.deploy(await ctx.stake.getAddress());
    await attacker.enter(ctx.marketId, Side.Yes, { value: BOT(10) });
    await ctx.stake.connect(ctx.bob).stake(ctx.marketId, Side.No, { value: BOT(10) });
    await time.increaseTo(ctx.params.closeTime);
    await ctx.stake.connect(ctx.resolver).resolve(ctx.marketId, Outcome.Yes, "");

    await attacker.attack();
    expect(await attacker.reentryAttempts()).to.equal(1);
    expect(await attacker.reentrySucceeded()).to.equal(false);
    const expected = expectedPayout(BOT(10), BOT(20), BOT(10), BOT(10));
    expect(await ethers.provider.getBalance(await attacker.getAddress())).to.equal(expected);
  });

  it("reverts cleanly (and keeps the claim open) when the receiver rejects BOT", async () => {
    const ctx = await loadFixture(openMarketFixture);
    const R = await ethers.getContractFactory("RejectingReceiver");
    const receiver = await R.deploy();
    const target = await ctx.stake.getAddress();
    await receiver.enter(target, ctx.marketId, Side.Yes, { value: BOT(1) });
    await time.increaseTo(ctx.params.closeTime);
    await ctx.stake.connect(ctx.resolver).resolve(ctx.marketId, Outcome.Yes, "");
    await expect(receiver.claim(target, ctx.marketId)).to.be.revertedWithCustomError(ctx.stake, "TransferFailed");
    expect((await ctx.stake.getPosition(ctx.marketId, await receiver.getAddress())).claimed).to.equal(false);
  });

  it("a revoked resolver loses access immediately", async () => {
    const { stake, owner, resolver, marketId } = await loadFixture(closedMarketFixture);
    await stake.connect(owner).setResolver(resolver.address, false);
    await expect(stake.connect(resolver).resolve(marketId, Outcome.Yes, "")).to.be.revertedWithCustomError(stake, "NotResolver");
  });
});
