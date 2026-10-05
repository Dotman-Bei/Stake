import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEther } from "viem";
import { Outcome, filterMarkets, marketStatus, quotePayout, settledPayout, toneFor, yesPercent, type Market } from "./markets";
import { bot, multiple, timeLeft } from "./format";

const base: Market = {
  id: 0, totalYes: parseEther("70"), totalNo: parseEther("30"), minStake: 1n, maxStake: 10n ** 30n,
  openTime: 100, closeTime: 200, createdAt: 100, resolvedAt: 0, yesCount: 2, noCount: 1, feeBps: 100,
  marketType: 0, outcome: 0, creator: "0x", resolvedBy: "0x", fee: 0n,
  question: "Will BOT be above $12.50?", description: "", resolutionSource: "", resolutionParams: "", resolutionEvidence: "",
};

test("status follows the on-chain lifecycle", () => {
  assert.equal(marketStatus(base, 50), "upcoming");
  assert.equal(marketStatus(base, 150), "live");
  assert.equal(marketStatus(base, 200), "closed");
  assert.equal(marketStatus({ ...base, outcome: Outcome.Yes }, 250), "resolved");
  assert.equal(marketStatus({ ...base, outcome: Outcome.Invalid }, 250), "invalid");
});

test("settled payout matches the contract formula", () => {
  const fee = (parseEther("30") * 100n) / 10_000n;
  const m = { ...base, outcome: Outcome.Yes, fee };
  assert.equal(settledPayout(m, 1, parseEther("50")), (parseEther("50") * (parseEther("100") - fee)) / parseEther("70"));
  assert.equal(settledPayout(m, 2, parseEther("30")), 0n);
  assert.equal(settledPayout({ ...m, outcome: Outcome.Invalid }, 2, parseEther("30")), parseEther("30"));
});

test("quote includes the new stake in the pool", () => {
  const q = quotePayout(base, 2, parseEther("10"));
  // NO pool becomes 40, YES 70; fee 1% of 70 = 0.7 → 10 * 109.3 / 40
  assert.equal(q, (parseEther("10") * (parseEther("110") - parseEther("0.7"))) / parseEther("40"));
  assert.equal(quotePayout(base, 1, 0n), 0n);
});

test("yes percent and tone are stable", () => {
  assert.equal(yesPercent(base), 70);
  assert.equal(yesPercent({ totalYes: 0n, totalNo: 0n }), 50);
  assert.equal(toneFor("abc"), toneFor("abc"));
});

test("tab filters", () => {
  const markets = [base, { ...base, id: 1, closeTime: 10_000 }, { ...base, id: 2, outcome: Outcome.No }];
  assert.deepEqual(filterMarkets(markets, "active", 150, new Set()).map((m) => m.id), [0, 1]);
  assert.deepEqual(filterMarkets(markets, "closing", 150, new Set()).map((m) => m.id), [0]);
  assert.deepEqual(filterMarkets(markets, "resolved", 150, new Set()).map((m) => m.id), [2]);
  assert.deepEqual(filterMarkets(markets, "mine", 150, new Set([1])).map((m) => m.id), [1]);
  assert.deepEqual(filterMarkets(markets, "active", 150, new Set(), "nothing").length, 0);
});

test("formatting", () => {
  assert.equal(bot(parseEther("1234.5678")), "1,234.56");
  assert.equal(bot(1n), "<0.01");
  assert.equal(bot(0n), "0");
  assert.equal(timeLeft(100, 100), "Closed");
  assert.equal(timeLeft(3600 + 120, 0), "1h 2m");
  assert.equal(multiple(parseEther("1.5"), parseEther("1")), "1.50x");
});
