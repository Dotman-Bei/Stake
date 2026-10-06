import { test } from "node:test";
import assert from "node:assert/strict";
import { imageFor } from "./marketImage";

const m = (marketType: number, params: object | string) => ({
  marketType,
  resolutionParams: typeof params === "string" ? params : JSON.stringify(params),
});

test("maps each market to an ecosystem or coin image", () => {
  assert.equal(imageFor(m(0, { kind: "price", feed: "blockscout" }))?.src, "/markets/bot-token.png");
  assert.equal(imageFor(m(1, { kind: "price", feed: "coingecko", id: "bitcoin" }))?.src, "/markets/btc.png");
  assert.equal(imageFor(m(1, { kind: "price", feed: "coingecko", id: "ethereum" }))?.src, "/markets/eth.png");
  assert.equal(imageFor(m(1, { kind: "price", feed: "coingecko", id: "solana" }))?.src, "/markets/sol.png");
  assert.equal(imageFor(m(2, { kind: "erc20Supply", token: "0xD5452816194a3784dBa983426cCe7c122F4abd30" }))?.src, "/markets/bot-token.png");
  assert.equal(imageFor(m(2, { kind: "erc20Supply", token: "0x0000000000000000000000000000000000000001" }))?.src, "/markets/bot-dex.png");
  assert.equal(imageFor(m(2, { kind: "explorerStat" }))?.src, "/markets/bot-data.png");
  assert.equal(imageFor(m(3, { kind: "txCount" }))?.src, "/markets/bot-data.png");
});

test("unknown coins fall back to the bar visual; bad params use the type default", () => {
  assert.equal(imageFor(m(1, { kind: "price", feed: "coingecko", id: "dogecoin" })), null);
  assert.equal(imageFor(m(0, "not json"))?.src, "/markets/bot-token.png");
  assert.equal(imageFor(m(1, "not json")), null);
});
