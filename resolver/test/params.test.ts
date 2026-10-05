import { test } from "node:test";
import assert from "node:assert/strict";
import { compare, formatUnits, numberToDecimal, parseParams, toFixed } from "../src/params";

test("exact decimal comparison avoids float error", () => {
  assert.equal(compare("0.3", ">", "0.29999999999999999"), true);
  assert.equal(compare("12.5", ">", "12.5"), false);
  assert.equal(compare("12.5", ">=", "12.5"), true);
  assert.equal(compare("12.4999", "<", "12.5"), true);
  assert.equal(compare("85000", "<=", "85000.0"), true);
});

test("toFixed rejects negative and non-numeric input", () => {
  assert.throws(() => toFixed("-1"));
  assert.throws(() => toFixed("1e5"));
  assert.throws(() => toFixed("abc"));
  assert.equal(toFixed("1"), 10n ** 18n);
});

test("formatUnits renders token amounts", () => {
  assert.equal(formatUnits(1500000000000000000n, 18), "1.5");
  assert.equal(formatUnits(42n, 0), "42");
  assert.equal(formatUnits(5n, 3), "0.005");
});

test("numberToDecimal normalises exponent notation", () => {
  assert.equal(numberToDecimal(1e-7), "0.0000001");
  assert.equal(numberToDecimal("12.360957737639056754"), "12.360957737639056754");
  assert.throws(() => numberToDecimal(-3));
  assert.throws(() => numberToDecimal(Number.NaN));
});

test("parseParams validates each kind", () => {
  const price = parseParams('{"kind":"price","feed":"coingecko","id":"bitcoin","op":">","threshold":"85000"}');
  assert.equal(price.kind, "price");
  assert.equal((price as { maxDelaySec: number }).maxDelaySec, 600);

  parseParams('{"kind":"txCount","chainId":677,"address":"0x0000000000000000000000000000000000000001","op":">=","threshold":"10"}');
  parseParams('{"kind":"erc20Supply","chainId":677,"token":"0xD5452816194a3784dBa983426cCe7c122F4abd30","decimals":18,"op":">","threshold":"1"}');
  parseParams('{"kind":"explorerStat","url":"https://scan.botchain.ai/api/v2/stats","field":"total_transactions","op":">","threshold":"1"}');

  assert.throws(() => parseParams("not json"));
  assert.throws(() => parseParams('{"kind":"price","feed":"coingecko","op":"==","threshold":"1","id":"x"}'));
  assert.throws(() => parseParams('{"kind":"price","feed":"coingecko","op":">","threshold":"1e3","id":"x"}'));
  assert.throws(() => parseParams('{"kind":"price","feed":"binance","op":">","threshold":"1"}'));
  assert.throws(() => parseParams('{"kind":"txCount","chainId":677,"address":"0x12","op":">","threshold":"1"}'));
  assert.throws(() => parseParams('{"kind":"weather","op":">","threshold":"1"}'));
});
