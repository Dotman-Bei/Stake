import { compare, parseParams } from "./params";
import { NotYetAvailable, isSampledFeed, type Observation } from "./sources";

export const OUTCOME = { Unresolved: 0, Yes: 1, No: 2, Invalid: 3 } as const;
export type FinalOutcome = 1 | 2 | 3;

export type Decision =
  | { action: "wait"; reason: string }
  | { action: "resolve"; outcome: FinalOutcome; evidence: string };

type Observe = (closeTime: number) => Promise<Observation>;

/**
 * Pure decision step for one closed, unresolved market.
 *
 * - Unparseable params → INVALID (refunds), never a guess.
 * - Sampled feeds (prices, explorer stats) must be observed within `maxDelaySec` after close;
 *   a sample further than that from close (either side) is stale and resolves INVALID.
 * - On-chain reads retry until `giveUpAt`, then resolve INVALID before the contract's grace window ends.
 */
export async function decide(
  rawParams: string,
  closeTime: number,
  now: number,
  giveUpAt: number,
  observeWith: (p: ReturnType<typeof parseParams>) => Observe,
): Promise<Decision> {
  let params;
  try {
    params = parseParams(rawParams);
  } catch (err) {
    return { action: "resolve", outcome: OUTCOME.Invalid, evidence: ev({ invalid: `bad params: ${(err as Error).message}` }) };
  }

  if (isSampledFeed(params) && now - closeTime > params.maxDelaySec) {
    return { action: "resolve", outcome: OUTCOME.Invalid, evidence: ev({ invalid: `stale: resolver ran ${now - closeTime}s after close (max ${params.maxDelaySec}s)` }) };
  }

  let obs: Observation;
  try {
    obs = await observeWith(params)(closeTime);
  } catch (err) {
    if (now >= giveUpAt) {
      return { action: "resolve", outcome: OUTCOME.Invalid, evidence: ev({ invalid: `source unavailable: ${(err as Error).message}` }) };
    }
    const reason = err instanceof NotYetAvailable ? err.message : `source error: ${(err as Error).message}`;
    return { action: "wait", reason };
  }

  if (isSampledFeed(params) && Math.abs(obs.sampledAt - closeTime) > params.maxDelaySec) {
    return { action: "resolve", outcome: OUTCOME.Invalid, evidence: ev({ invalid: `stale sample at ${obs.sampledAt}`, observed: obs.value, ref: obs.ref }) };
  }

  const yes = compare(obs.value, params.op, params.threshold);
  return {
    action: "resolve",
    outcome: yes ? OUTCOME.Yes : OUTCOME.No,
    evidence: ev({ observed: obs.value, op: params.op, threshold: params.threshold, at: obs.sampledAt, ref: obs.ref }),
  };
}

/** Compact JSON evidence, truncated to the contract's 500-byte limit. */
export function ev(o: Record<string, unknown>): string {
  const s = JSON.stringify(o);
  if (Buffer.byteLength(s) <= 500) return s;
  return Buffer.from(s).subarray(0, 490).toString("utf8").replace(/�$/, "") + "...";
}
