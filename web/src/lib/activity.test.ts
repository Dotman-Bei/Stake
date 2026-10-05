import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEther } from "viem";
import { aggregate, fromWire, leaderboard, toWire, type ActivityEvent } from "./activity";
import { Outcome, type Market } from "./markets";

const E = parseEther;
const mk = (id: number, over: Partial<Market>): Market => ({
  id, totalYes: 0n, totalNo: 0n, minStake: 1n, maxStake: E("100"), openTime: 0, closeTime: 100, createdAt: 0, resolvedAt: 0,
  yesCount: 0, noCount: 0, feeBps: 100, marketType: 0, outcome: 0, creator: "0x", resolvedBy: "0x", fee: 0n,
  question: `q${id}`, description: "", resolutionSource: "", resolutionParams: "", resolutionEvidence: "", ...over,
});

const pos = (marketId: number, user: string, side: number, amount: bigint, block: number): ActivityEvent =>
  ({ type: "position", marketId, user, side, amount, block, tx: `0x${block}`, logIndex: 0 });

test("aggregates wins, losses, refunds and claims per wallet", () => {
  const fee = (E("30") * 100n) / 10_000n;
  const markets = [
    mk(0, { totalYes: E("70"), totalNo: E("30"), outcome: Outcome.Yes, fee }),
    mk(1, { totalYes: E("5"), outcome: Outcome.Invalid }),
    mk(2, { totalNo: E("2"), closeTime: 10_000 }),
  ];
  const events: ActivityEvent[] = [
    pos(0, "0xa", 1, E("50"), 1), pos(0, "0xb", 2, E("30"), 2), pos(0, "0xc", 1, E("20"), 3),
    pos(1, "0xa", 1, E("5"), 4), pos(2, "0xb", 2, E("2"), 5),
    { type: "resolved", marketId: 0, outcome: 1, fee, block: 6, tx: "0xr", logIndex: 0 },
    { type: "claimed", marketId: 0, user: "0xa", amount: E("71"), refund: false, block: 7, tx: "0xc1", logIndex: 0 },
  ];
  const agg = aggregate(events, markets, 500);
  const a = agg.users.get("0xa")!;
  assert.equal(a.wins, 1);
  assert.equal(a.refunds, 1);
  assert.equal(a.claimed, E("71"));
  assert.equal(a.unclaimed, E("5")); // refund from market 1 not yet claimed
  assert.ok(a.net > 0n);
  const b = agg.users.get("0xb")!;
  assert.equal(b.losses, 1);
  assert.equal(b.open, 1);
  assert.equal(b.net, -E("30"));
  assert.equal(agg.platform.volume, E("107"));
  assert.equal(agg.platform.predictors, 3);
  assert.equal(agg.platform.settled, 2);
  assert.equal(agg.resolutionTx.get(0), "0xr");

  const lb = leaderboard(agg.users);
  assert.deepEqual(lb.map((r) => r.address), ["0xa", "0xc", "0xb"]);
  assert.equal(lb[0].rank, 1);
});

test("wire round trip preserves bigints and lowercases users", () => {
  const e = pos(3, "0xABC", 2, 12345678901234567890n, 9);
  const back = fromWire(JSON.parse(JSON.stringify(toWire(e))));
  assert.equal(back.type === "position" && back.amount, 12345678901234567890n);
  assert.equal(back.type === "position" && back.user, "0xabc");
});
