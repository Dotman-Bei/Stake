import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { BOT, FEE_BPS, HOUR, MarketType, Side, Status, deployFixture, marketParams, openMarketFixture } from "./fixtures";

describe("StakeMarkets — deployment & roles", () => {
  it("grants initial roles and fee config", async () => {
    const { stake, owner, creator, resolver, treasury } = await loadFixture(deployFixture);
    expect(await stake.owner()).to.equal(owner.address);
    expect(await stake.isCreator(creator.address)).to.equal(true);
    expect(await stake.isResolver(resolver.address)).to.equal(true);
    expect(await stake.treasury()).to.equal(treasury.address);
    expect(await stake.feeBps()).to.equal(FEE_BPS);
  });

  it("rejects zero addresses and an excessive fee at deploy", async () => {
    const [a] = await ethers.getSigners();
    const F = await ethers.getContractFactory("StakeMarkets");
    await expect(F.deploy(a.address, ethers.ZeroAddress, a.address, a.address, 0)).to.be.revertedWithCustomError(F, "ZeroAddress");
    await expect(F.deploy(a.address, a.address, a.address, a.address, 501)).to.be.revertedWithCustomError(F, "FeeTooHigh");
  });

  it("restricts admin functions to the owner", async () => {
    const { stake, outsider } = await loadFixture(deployFixture);
    const s = stake.connect(outsider);
    await expect(s.setCreator(outsider.address, true)).to.be.revertedWithCustomError(stake, "OwnableUnauthorizedAccount");
    await expect(s.setResolver(outsider.address, true)).to.be.revertedWithCustomError(stake, "OwnableUnauthorizedAccount");
    await expect(s.setFeeBps(10)).to.be.revertedWithCustomError(stake, "OwnableUnauthorizedAccount");
    await expect(s.setTreasury(outsider.address)).to.be.revertedWithCustomError(stake, "OwnableUnauthorizedAccount");
    await expect(s.withdrawFees()).to.be.revertedWithCustomError(stake, "OwnableUnauthorizedAccount");
    await expect(s.pause()).to.be.revertedWithCustomError(stake, "OwnableUnauthorizedAccount");
    await expect(s.cancelMarket(0, "x")).to.be.revertedWithCustomError(stake, "UnknownMarket");
  });

  it("lets the owner manage roles and caps the fee", async () => {
    const { stake, owner, outsider } = await loadFixture(deployFixture);
    await expect(stake.connect(owner).setCreator(outsider.address, true)).to.emit(stake, "CreatorUpdated").withArgs(outsider.address, true);
    await expect(stake.connect(owner).setResolver(outsider.address, true)).to.emit(stake, "ResolverUpdated").withArgs(outsider.address, true);
    await expect(stake.connect(owner).setFeeBps(501)).to.be.revertedWithCustomError(stake, "FeeTooHigh");
    await expect(stake.connect(owner).setFeeBps(250)).to.emit(stake, "FeeUpdated").withArgs(250);
  });

  it("uses two-step ownership transfer", async () => {
    const { stake, owner, outsider } = await loadFixture(deployFixture);
    await stake.connect(owner).transferOwnership(outsider.address);
    expect(await stake.owner()).to.equal(owner.address);
    await stake.connect(outsider).acceptOwnership();
    expect(await stake.owner()).to.equal(outsider.address);
  });
});

describe("StakeMarkets — market creation", () => {
  it("creates a market with validated params and emits MarketCreated", async () => {
    const { stake, creator } = await loadFixture(deployFixture);
    const p = await marketParams();
    await expect(stake.connect(creator).createMarket(p))
      .to.emit(stake, "MarketCreated")
      .withArgs(0, creator.address, MarketType.BotPrice, p.question, await time.latest() + 1, p.closeTime, p.minStake, p.maxStake, FEE_BPS);
    const m = await stake.getMarket(0);
    expect(m.question).to.equal(p.question);
    expect(m.resolutionSource).to.equal(p.resolutionSource);
    expect(m.feeBps).to.equal(FEE_BPS);
    expect(await stake.marketCount()).to.equal(1);
    expect(await stake.status(0)).to.equal(Status.Open);
  });

  it("only authorized creators can create", async () => {
    const { stake, outsider } = await loadFixture(deployFixture);
    await expect(stake.connect(outsider).createMarket(await marketParams())).to.be.revertedWithCustomError(stake, "NotCreator");
  });

  it("rejects invalid timing", async () => {
    const { stake, creator } = await loadFixture(deployFixture);
    const now = await time.latest();
    const c = stake.connect(creator);
    await expect(c.createMarket(await marketParams({ openTime: now - 10 }))).to.be.revertedWithCustomError(stake, "InvalidTimes");
    await expect(c.createMarket(await marketParams({ closeTime: now + 30 }))).to.be.revertedWithCustomError(stake, "InvalidTimes");
    await expect(c.createMarket(await marketParams({ closeTime: now + 31 * 24 * HOUR }))).to.be.revertedWithCustomError(stake, "InvalidTimes");
    await expect(c.createMarket(await marketParams({ openTime: now + 31 * 24 * HOUR, closeTime: now + 32 * 24 * HOUR }))).to.be.revertedWithCustomError(stake, "InvalidTimes");
  });

  it("rejects invalid stake limits and text", async () => {
    const { stake, creator } = await loadFixture(deployFixture);
    const c = stake.connect(creator);
    await expect(c.createMarket(await marketParams({ minStake: 0 }))).to.be.revertedWithCustomError(stake, "InvalidStakeLimits");
    await expect(c.createMarket(await marketParams({ minStake: BOT(2), maxStake: BOT(1) }))).to.be.revertedWithCustomError(stake, "InvalidStakeLimits");
    await expect(c.createMarket(await marketParams({ question: "" }))).to.be.revertedWithCustomError(stake, "InvalidText");
    await expect(c.createMarket(await marketParams({ question: "x".repeat(201) }))).to.be.revertedWithCustomError(stake, "InvalidText");
    await expect(c.createMarket(await marketParams({ resolutionSource: "" }))).to.be.revertedWithCustomError(stake, "InvalidText");
    await expect(c.createMarket(await marketParams({ resolutionParams: "" }))).to.be.revertedWithCustomError(stake, "InvalidText");
  });

  it("reports Upcoming before a delayed open", async () => {
    const { stake, creator } = await loadFixture(deployFixture);
    const now = await time.latest();
    await stake.connect(creator).createMarket(await marketParams({ openTime: now + HOUR, closeTime: now + 2 * HOUR }));
    expect(await stake.status(0)).to.equal(Status.Upcoming);
  });

  it("snapshots the fee per market", async () => {
    const { stake, owner, creator } = await loadFixture(deployFixture);
    await stake.connect(creator).createMarket(await marketParams());
    await stake.connect(owner).setFeeBps(300);
    await stake.connect(creator).createMarket(await marketParams());
    expect((await stake.getMarket(0)).feeBps).to.equal(FEE_BPS);
    expect((await stake.getMarket(1)).feeBps).to.equal(300);
  });

  it("paginates markets with a bounded page size", async () => {
    const { stake, creator } = await loadFixture(deployFixture);
    for (let i = 0; i < 3; i++) await stake.connect(creator).createMarket(await marketParams());
    expect((await stake.getMarkets(0, 2)).length).to.equal(2);
    expect((await stake.getMarkets(2, 10)).length).to.equal(1);
    expect((await stake.getMarkets(5, 10)).length).to.equal(0);
    await expect(stake.getMarkets(0, 0)).to.be.revertedWithCustomError(stake, "InvalidPage");
    await expect(stake.getMarkets(0, 51)).to.be.revertedWithCustomError(stake, "InvalidPage");
    await expect(stake.getMarket(9)).to.be.revertedWithCustomError(stake, "UnknownMarket");
  });
});

describe("StakeMarkets — staking", () => {
  it("records YES and NO positions on-chain", async () => {
    const { stake, alice, bob, marketId } = await loadFixture(openMarketFixture);
    await expect(stake.connect(alice).stake(marketId, Side.Yes, { value: BOT(7) }))
      .to.emit(stake, "PositionTaken").withArgs(marketId, alice.address, Side.Yes, BOT(7), BOT(7), BOT(7), 0);
    await stake.connect(bob).stake(marketId, Side.No, { value: BOT(3) });

    const m = await stake.getMarket(marketId);
    expect(m.totalYes).to.equal(BOT(7));
    expect(m.totalNo).to.equal(BOT(3));
    expect(m.yesCount).to.equal(1);
    expect(m.noCount).to.equal(1);
    const pos = await stake.getPosition(marketId, alice.address);
    expect(pos.side).to.equal(Side.Yes);
    expect(pos.amount).to.equal(BOT(7));
    expect(await ethers.provider.getBalance(await stake.getAddress())).to.equal(BOT(10));
  });

  it("allows topping up the same side without double-counting participants", async () => {
    const { stake, alice, marketId } = await loadFixture(openMarketFixture);
    await stake.connect(alice).stake(marketId, Side.Yes, { value: BOT(1) });
    await stake.connect(alice).stake(marketId, Side.Yes, { value: BOT(2) });
    expect((await stake.getPosition(marketId, alice.address)).amount).to.equal(BOT(3));
    expect((await stake.getMarket(marketId)).yesCount).to.equal(1);
  });

  it("locks a wallet to one side per market", async () => {
    const { stake, alice, marketId } = await loadFixture(openMarketFixture);
    await stake.connect(alice).stake(marketId, Side.Yes, { value: BOT(1) });
    await expect(stake.connect(alice).stake(marketId, Side.No, { value: BOT(1) })).to.be.revertedWithCustomError(stake, "SideLocked");
  });

  it("enforces min per deposit and max per position", async () => {
    const { stake, alice, marketId } = await loadFixture(openMarketFixture);
    await expect(stake.connect(alice).stake(marketId, Side.Yes, { value: BOT("0.09") })).to.be.revertedWithCustomError(stake, "StakeTooSmall");
    await expect(stake.connect(alice).stake(marketId, Side.Yes, { value: 0 })).to.be.revertedWithCustomError(stake, "StakeTooSmall");
    await stake.connect(alice).stake(marketId, Side.Yes, { value: BOT(99) });
    await expect(stake.connect(alice).stake(marketId, Side.Yes, { value: BOT(2) })).to.be.revertedWithCustomError(stake, "StakeTooLarge");
  });

  it("rejects an invalid side and unknown markets", async () => {
    const { stake, alice, marketId } = await loadFixture(openMarketFixture);
    await expect(stake.connect(alice).stake(marketId, Side.None, { value: BOT(1) })).to.be.revertedWithCustomError(stake, "InvalidSide");
    await expect(stake.connect(alice).stake(42, Side.Yes, { value: BOT(1) })).to.be.revertedWithCustomError(stake, "UnknownMarket");
  });

  it("rejects stakes before open and at/after close", async () => {
    const { stake, creator, alice } = await loadFixture(deployFixture);
    const now = await time.latest();
    await stake.connect(creator).createMarket(await marketParams({ openTime: now + HOUR, closeTime: now + 2 * HOUR }));
    await expect(stake.connect(alice).stake(0, Side.Yes, { value: BOT(1) })).to.be.revertedWithCustomError(stake, "MarketNotOpen");
    await time.increaseTo(now + 2 * HOUR);
    await expect(stake.connect(alice).stake(0, Side.Yes, { value: BOT(1) })).to.be.revertedWithCustomError(stake, "MarketNotOpen");
    expect(await stake.status(0)).to.equal(Status.Closed);
  });

  it("rejects plain BOT transfers to the contract", async () => {
    const { stake, alice } = await loadFixture(deployFixture);
    await expect(alice.sendTransaction({ to: await stake.getAddress(), value: BOT(1) })).to.be.reverted;
  });

  it("pause blocks creation and staking only", async () => {
    const { stake, owner, creator, alice, marketId } = await loadFixture(openMarketFixture);
    await stake.connect(owner).pause();
    await expect(stake.connect(alice).stake(marketId, Side.Yes, { value: BOT(1) })).to.be.revertedWithCustomError(stake, "EnforcedPause");
    await expect(stake.connect(creator).createMarket(await marketParams())).to.be.revertedWithCustomError(stake, "EnforcedPause");
    await stake.connect(owner).unpause();
    await stake.connect(alice).stake(marketId, Side.Yes, { value: BOT(1) });
  });
});
