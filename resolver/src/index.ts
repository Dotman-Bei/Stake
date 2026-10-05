import { createPublicClient, createWalletClient, http, BaseError, ContractFunctionRevertedError } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { stakeMarketsAbi } from "./abi";
import { config } from "./config";
import { OUTCOME, decide } from "./decide";
import { Sources } from "./sources";

const PAGE = 50n;
const once = process.argv.includes("--once");

const account = privateKeyToAccount(config.privateKey);
const transport = http(config.rpcUrl, { timeout: 20_000 });
const publicClient = createPublicClient({ chain: config.chain, transport });
const walletClient = createWalletClient({ chain: config.chain, transport, account });
const sources = new Sources(config.dataRpcs);
const contract = { address: config.contract, abi: stakeMarketsAbi } as const;

const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);

async function tick() {
  const [count, grace, isResolver, head] = await Promise.all([
    publicClient.readContract({ ...contract, functionName: "marketCount" }),
    publicClient.readContract({ ...contract, functionName: "RESOLUTION_GRACE" }),
    publicClient.readContract({ ...contract, functionName: "isResolver", args: [account.address] }),
    publicClient.getBlock({ blockTag: "latest" }),
  ]);
  if (!isResolver) throw new Error(`${account.address} is not an authorized resolver on ${config.contract}`);

  const chainNow = Number(head.timestamp);
  const wallNow = Math.floor(Date.now() / 1000);

  for (let start = 0n; start < count; start += PAGE) {
    const page = await publicClient.readContract({ ...contract, functionName: "getMarkets", args: [start, PAGE] });
    for (let i = 0; i < page.length; i++) {
      const id = start + BigInt(i);
      const m = page[i];
      if (m.outcome !== OUTCOME.Unresolved) continue;
      const close = Number(m.closeTime);
      if (chainNow < close) continue; // contract would reject: not closed on-chain yet
      if (chainNow > close + Number(grace)) continue; // window over: anyone may voidStaleMarket

      const giveUpAt = close + Number(grace) - config.giveUpMarginSeconds;
      const d = await decide(m.resolutionParams, close, Math.max(chainNow, wallNow), giveUpAt, (p) => (ct) => sources.observe(p, ct));
      if (d.action === "wait") {
        log(`#${id} waiting: ${d.reason}`);
        continue;
      }
      await submit(id, d.outcome, d.evidence);
    }
  }
}

async function submit(id: bigint, outcome: 1 | 2 | 3, evidence: string) {
  const label = ["", "YES", "NO", "INVALID"][outcome];
  try {
    const { request } = await publicClient.simulateContract({ ...contract, account, functionName: "resolve", args: [id, outcome, evidence] });
    const hash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    log(`#${id} resolved ${label} in ${hash} (${receipt.status}) evidence=${evidence}`);
  } catch (err) {
    if (err instanceof BaseError) {
      const revert = err.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
      if (revert?.data?.errorName === "AlreadySettled") return log(`#${id} already settled`);
      log(`#${id} resolve ${label} failed: ${revert?.data?.errorName ?? err.shortMessage}`);
    } else {
      log(`#${id} resolve ${label} failed:`, err);
    }
  }
}

async function main() {
  log(`resolver ${account.address} watching ${config.contract} on chain ${config.chain.id}`);
  do {
    try {
      await tick();
    } catch (err) {
      log("tick failed:", err instanceof BaseError ? err.shortMessage : err);
      if (once) process.exitCode = 1;
    }
    if (!once) await new Promise((r) => setTimeout(r, config.pollSeconds * 1000));
  } while (!once);
}

main();
