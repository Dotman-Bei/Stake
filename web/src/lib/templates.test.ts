import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDraft } from "./templates";

const close = Date.UTC(2026, 9, 5, 20, 0) / 1000;

test("bot-price draft carries matching question and params", () => {
  const d = buildDraft({ template: "bot-price", op: ">", threshold: "12.5", closeTime: close });
  assert.ok(!("error" in d));
  assert.equal(d.question, "Will BOT be above $12.5 at 20:00 UTC on 2026-10-05?");
  assert.deepEqual(JSON.parse(d.resolutionParams), { kind: "price", feed: "blockscout", url: "https://scan.botchain.ai/api/v2/stats", field: "coin_price", op: ">", threshold: "12.5", maxDelaySec: 600 });
});

test("rejects ambiguous or invalid input", () => {
  assert.ok("error" in buildDraft({ template: "bot-price", op: ">", threshold: "1e3", closeTime: close }));
  assert.ok("error" in buildDraft({ template: "address-txs", op: ">", threshold: "5", closeTime: close, target: "0x12" }));
  assert.ok("error" in buildDraft({ template: "crypto-price", op: ">", threshold: "5", closeTime: close, asset: "Bit Coin", symbol: "BTC" }));
});

test("count wording for transaction markets", () => {
  const d = buildDraft({ template: "address-txs", op: ">=", threshold: "100", closeTime: close, target: "0x0000000000000000000000000000000000000001", label: "Router" });
  assert.ok(!("error" in d));
  assert.match(d.question, /^Will Router have sent at least 100 transactions by/);
});
