import { test } from "node:test";
import assert from "node:assert/strict";
import { OUTCOME, decide, ev } from "../src/decide";
import { NotYetAvailable } from "../src/sources";

const CLOSE = 1_760_000_000;
const price = '{"kind":"price","feed":"coingecko","id":"bitcoin","op":">","threshold":"85000","maxDelaySec":600}';
const nonce = '{"kind":"txCount","chainId":677,"address":"0x0000000000000000000000000000000000000001","op":">=","threshold":"10"}';
const fixed = (value: string, sampledAt = CLOSE + 5) => () => async () => ({ value, sampledAt, ref: "test" });
const failing = (err: Error) => () => async () => { throw err; };

test("resolves YES/NO from the observed value with evidence", async () => {
  const yes = await decide(price, CLOSE, CLOSE + 10, CLOSE + 1000, fixed("85000.01"));
  assert.deepEqual(yes.action === "resolve" && yes.outcome, OUTCOME.Yes);
  const no = await decide(price, CLOSE, CLOSE + 10, CLOSE + 1000, fixed("85000"));
  assert.equal(no.action === "resolve" && no.outcome, OUTCOME.No);
  assert.match(no.action === "resolve" ? no.evidence : "", /"observed":"85000"/);
});

test("bad params resolve INVALID instead of guessing", async () => {
  const d = await decide("{oops", CLOSE, CLOSE + 10, CLOSE + 1000, fixed("1"));
  assert.equal(d.action === "resolve" && d.outcome, OUTCOME.Invalid);
});

test("a late resolver run on a sampled feed resolves INVALID (stale data)", async () => {
  const d = await decide(price, CLOSE, CLOSE + 601, CLOSE + 9999, fixed("90000"));
  assert.equal(d.action === "resolve" && d.outcome, OUTCOME.Invalid);
  assert.match(d.action === "resolve" ? d.evidence : "", /stale/);
});

test("a sample timestamped far from close is stale", async () => {
  const d = await decide(price, CLOSE, CLOSE + 10, CLOSE + 9999, fixed("90000", CLOSE - 3600));
  assert.equal(d.action === "resolve" && d.outcome, OUTCOME.Invalid);
});

test("source errors wait, then resolve INVALID at the give-up time", async () => {
  const waiting = await decide(nonce, CLOSE, CLOSE + 10, CLOSE + 1000, failing(new NotYetAvailable("no block yet")));
  assert.deepEqual(waiting, { action: "wait", reason: "no block yet" });
  const gaveUp = await decide(nonce, CLOSE, CLOSE + 1000, CLOSE + 1000, failing(new Error("rpc down")));
  assert.equal(gaveUp.action === "resolve" && gaveUp.outcome, OUTCOME.Invalid);
});

test("on-chain reads are not subject to sampling delay", async () => {
  const d = await decide(nonce, CLOSE, CLOSE + 86_400, CLOSE + 200_000, fixed("12", CLOSE + 1));
  assert.equal(d.action === "resolve" && d.outcome, OUTCOME.Yes);
});

test("evidence never exceeds the on-chain 500-byte limit", () => {
  assert.ok(Buffer.byteLength(ev({ x: "é".repeat(400) })) <= 500);
});
