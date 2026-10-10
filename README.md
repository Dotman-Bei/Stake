# STAKE

**A fast, low-cost prediction market built for the BOT Chain ecosystem.**

STAKE runs short-duration YES/NO markets on BOT price, crypto prices and measurable BOT Chain activity. You stake native BOT on a side, the market closes on a fixed deadline, an access-controlled resolver writes the outcome and its evidence on-chain, and winners claim their share of the pool. Market creation, positions, settlement, payout eligibility and claims all live in one verifiable contract on BOT Chain.

> **Working on this repo, human or AI agent?** Start with [`handoff.md`](handoff.md), then [`prd.md`](prd.md),
> [`architecture.md`](architecture.md), [`memory.md`](memory.md) and [`project-plan.md`](project-plan.md).

---

## Status

| Milestone | State |
|---|---|
| M1 Foundation: repo, contracts, frontend, verified BOT Chain config, wallet connection, deploy pipeline, tests | **Done** |
| M2 Market engine: creation, staking, positions, state transitions, tests | **Done** (38 contract tests) |
| M3 Resolution and payout: resolver service, settlement, payout, claims, security and failure-path tests | **Done** (12 resolver tests) |
| M4 Frontend: Home, Markets, Market Detail, Leaderboard, Profile, stake and claim flows | **Done**, verified end to end on a local chain; [deployed on Vercel](https://stake-nine-umber.vercel.app) |
| M5 Testnet deployment and contract verification | **Testnet: deployed and verified** (see below). Mainnet: not yet ([plan below](#deployment-plan-testnet--mainnet)) |
| M6 Real users | **Not started.** No usage has been claimed or simulated on BOT Chain |

### BOT Chain mainnet deployment

| | |
|---|---|
| Contract | [`0xBf263D8333f21aA55504Adb6404b0a493fb9D838`](https://scan.botchain.ai/address/0xBf263D8333f21aA55504Adb6404b0a493fb9D838#code) (source verified) |
| Network | BOT Chain mainnet, chain 677 |
| Deploy block | 26193710 ([tx](https://scan.botchain.ai/tx/0x13e53bdb80f0a0765fa7d01ca8b17f622ed2135e4bfd6ccb01285e6c68abc8a1)) |
| Launch limits | 0.01–5 BOT per wallet per market, 1% fee on the losing pool |

The record is in [`contracts/deployments/677.json`](contracts/deployments/677.json). The testnet deployment below is retired.

### BOT Chain testnet deployment (retired)

**Live app: https://stake-nine-umber.vercel.app** (BOT Chain testnet; get test BOT from the [faucet](https://faucet.botchain.ai/basic))

| | |
|---|---|
| Contract | [`0x5394eE5dD8b31e1058393918a305E6408d5117E2`](https://scan.bohr.life/address/0x5394eE5dD8b31e1058393918a305E6408d5117E2#code) (source verified; redeployed 2026-10-07 for a fresh market list. The previous contract `0x8E5e9B96efb446D3F3538971a5C7767a9DDcF779` is retired.) |
| Network | BOT Chain testnet, chain 968 |
| Deploy block | 26019797 ([tx](https://scan.bohr.life/tx/0xdda27430ad43c62a4724d58c79f2a7fb606c324973c17f25f5373b0318f1b50d)) |
| Owner / creator / resolver / treasury | `0xAF9d11E465511076C8A53fA06AE7Eb84FF40A8aA` (single wallet for testnet) |
| Fee | 1% of the losing pool |

The full record is in [`contracts/deployments/968.json`](contracts/deployments/968.json).

---

## How it works

```
 operator ──createMarket()──▶ ┌─────────────────────────────┐ ◀──stake(id, YES|NO) + BOT── users
                              │   StakeMarkets.sol (BOT Chain)│
 resolver ──resolve(id, out,  │   markets · positions · pools │ ──claim(id)──▶ winners / refunds
            evidence)───────▶ │   outcome · evidence · claims │
 anyone ───voidStaleMarket()─▶└──────────────┬──────────────┘
                                             │ events
                          ┌──────────────────▼─────────────────┐
                          │ web/ (Next.js): reads contract state│  /api/activity  event index (cache)
                          │ directly; indexes events for lists, │  /api/metrics   on-chain usage metrics
                          │ profiles and the leaderboard        │
                          └─────────────────────────────────────┘
 resolver/ (Node): polls closed markets, reads each market's declared source, submits resolve()
```

**Lifecycle:** `Upcoming → Open → Closed (awaiting result) → Resolved YES/NO | Invalid (refund)`

- **Open/close are time-based.** Stakes are accepted while `openTime ≤ now < closeTime`, and no transaction is needed to close a market.
- **One side per wallet per market.** A wallet can top up its side. `minStake` applies to each deposit and `maxStake` to the wallet's total position.
- **Resolution happens once, after close**, from an authorized resolver, within a 3-day grace window.
- **Liveness fallback:** if the resolver misses that window, *anyone* can call `voidStaleMarket` and every staker is refunded.
- **Claims happen once per position.** The contract marks the claim before sending BOT (checks-effects-interactions) and claims are `nonReentrant`.

### Fee model

The fee is set in basis points, defaults to **1% (100 bps)**, is capped at 5% in code, and is fixed per market at creation. **It is charged on the losing pool only**, so a winner never gets back less than their stake.

```
fee            = losingPool × feeBps / 10 000
payout(stake)  = stake × (totalPool − fee) / winningPool        (rounded down)
```

Example: YES 70 BOT, NO 30 BOT, YES wins, 1% fee. The fee is 0.3 BOT. A 50 BOT YES position receives 50 × 99.7 / 70 = **71.21 BOT**.

Edge cases:

| Case | Result |
|---|---|
| Nobody staked on the winning side | Resolves **INVALID**: everyone is refunded and no fee is taken. |
| Nobody staked on the losing side | Winners get their stake back and the fee is zero. |
| Rounding dust | Leftover dust (under one wei per winner) stays in the contract. |

Fees accrue in `accruedFees` and can only be sent to the configured treasury (`withdrawFees`). They never touch user stakes.

### Resolution system

The MVP uses a **trusted, access-controlled resolver** (PRD §9). The contract does not pretend to know off-chain facts. Every market declares its source in `resolutionSource` and machine-readable `resolutionParams`. The resolver writes the observed value as JSON `evidence` on-chain, so anyone can re-check it.

| Template | Market type | Source | Read at |
|---|---|---|---|
| `bot-price` | BOT price | BOT Chain explorer stats API `coin_price` (`scan.botchain.ai/api/v2/stats`) | sampled at close |
| `crypto-price` | Crypto price | CoinGecko simple price API (`{id}/usd`) | sampled at close |
| `chain-txs` | Ecosystem metric | BOT Chain explorer `total_transactions` | sampled at close |
| `erc20-supply` | Ecosystem metric | `totalSupply()` of a BOT Chain token | **first block at/after close**, re-checkable on-chain |
| `address-txs` | Ecosystem event | `eth_getTransactionCount(account)` (nonce) | **first block at/after close**, re-checkable on-chain |

Resolver rules (`resolver/src/decide.ts`):

- **Exact decimal comparison**, with no floating point.
- **Stale-data guard:** sampled feeds must be observed within `maxDelaySec` (600s) of close. Anything later resolves **INVALID** (refund) rather than guessing.
- **Bad or ambiguous params resolve INVALID.**
- **Unavailable sources:** the resolver retries until one hour before the grace window ends, then resolves INVALID.
- **Simulate first:** every transaction is simulated before sending. `AlreadySettled` is treated as done.

Market questions are **generated from templates**, never typed as free text, so a market cannot say one thing and resolve on another. The same templates exist in the operator CLI (`contracts/tasks/markets.ts`) and the creator UI (`web/src/lib/templates.ts`).

### Leaderboard ranking

Rank is by **realized net winnings on settled markets** (payouts minus stakes). Ranking by volume would reward wash staking, and ranking by win count would reward spamming minimum bets. Net P&L only rises by being right. Win rate, volume and market count are shown but don't rank. Refunded markets don't count.

### Data architecture

- **Contract state is authoritative.** Pools, positions, outcomes and `claimable()` are read straight from the contract. The Profile page verifies every claimable amount on-chain before offering a claim.
- **`/api/activity`** is an incremental in-memory index of contract events, used for lists, history, the leaderboard and stats. It is rebuilt from the deploy block on restart and is never treated as a balance.
- **`/api/metrics`** returns the PRD §24 on-chain metrics as JSON for incubation reporting: markets created/resolved/refunded, positions, volume, claims, unique and repeat predictors, and ecosystem-market users. Every number is derived from logs and state.

---

## Repository layout

```
contracts/   Hardhat + Solidity 0.8.28 + OpenZeppelin 5
  contracts/StakeMarkets.sol        the market engine (single contract)
  test/                             38 tests: lifecycle, payouts, double-claim, reentrancy, access control
  scripts/deploy.ts                 deploys and writes deployments/<chainId>.json
  scripts/export-abi.ts             writes the ABI into web/ and resolver/
  scripts/seed-local.ts             local-chain sample data (refuses to run on any other chain)
  tasks/markets.ts                  operator CLI: stake:create · stake:cancel · stake:withdraw-fees
resolver/    Node + viem settlement service (12 tests)
web/         Next.js 15 + wagmi + viem frontend; design system in web/src/app/globals.css (see prd.md §6)
STAKE_PRD.md                        original product spec
```

---

## BOT Chain configuration

Verified on **2026-10-05** against the [official developer docs](https://dev-docs.botchain.ai/docs/Developers/quick-guide/), [Chainlist #677](https://chainlist.org/chain/677) and live `eth_chainId` calls. **Re-verify before every deployment.** All values can be overridden through `.env`.

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | 677 (`0x2a5`) | 968 (`0x3c8`) |
| RPC | https://rpc.botchain.ai | https://rpc.bohr.life |
| WebSocket | wss://ws-rpc.botchain.ai | — |
| Explorer (Blockscout) | https://scan.botchain.ai | https://scan.bohr.life |
| Faucet | — (BOT via the official DEX) | https://faucet.botchain.ai/basic |
| Native token | BOT (18 decimals) | BOT |

Note: Multicall3 is deployed on mainnet but **not on testnet**, so STAKE reads through a bounded, paginated `getMarkets` view instead of relying on multicall.

---

## Running locally

Requires Node 20+.

```bash
# 1. contracts
cd contracts && npm install
npx hardhat test                       # 38 passing
npx hardhat node                       # keep running in a separate terminal
npm run deploy:local && npm run seed:local

# 2. frontend
cd ../web && npm install
cat > .env.local <<EOF
NEXT_PUBLIC_STAKE_NETWORK=local
NEXT_PUBLIC_STAKE_CONTRACT=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_STAKE_DEPLOY_BLOCK=1
EOF
npm run dev                            # http://localhost:3000

# 3. resolver (the Hardhat #0 key is the local resolver)
cd ../resolver && npm install && npm test
STAKE_CHAIN_ID=31337 STAKE_RPC_URL=http://127.0.0.1:8545 \
RESOLVER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 npm start
```

Import a Hardhat test account into your browser wallet and add the local network (chain 31337, `http://127.0.0.1:8545`) to stake and claim from the UI.

---

## Deployment plan (testnet → mainnet)

1. **Re-verify network values** from the official docs and Chainlist, and update `.env` if anything changed.
2. **Create separate keys** for owner (deployer), creator, resolver and treasury. The resolver should be a dedicated low-balance hot wallet. The owner should move to a multisig before mainnet (`transferOwnership` + `acceptOwnership`, two-step).
3. **Testnet:** fund the deployer at the faucet, then:
   ```bash
   cd contracts && cp .env.example .env    # fill DEPLOYER_PRIVATE_KEY, STAKE_*_ADDRESS
   npm run deploy:testnet
   npx hardhat verify --network botTestnet <address> <owner> <creator> <resolver> <treasury> <feeBps>
   npm run export-abi
   ```
4. **Open markets:** `npx hardhat stake:create --network botTestnet --template bot-price --threshold 12.5 --minutes 60`, or use **Create market** in the UI with the creator wallet.
5. **Run the resolver** on an always-on host. On Ubuntu with Node 22, from a clone of this repo:
   ```bash
   cp resolver/.env.example resolver/.env    # add RESOLVER_PRIVATE_KEY, then chmod 600
   sudo ./deploy/vps/setup.sh                # npm ci + systemd unit (Restart=always, starts at boot)
   journalctl -u stake-resolver -f           # logs
   ```
   Run exactly one resolver per key. The script refuses to start the service while another resolver process is running.
6. **Deploy the frontend** (e.g. Vercel, root `web/`) with `NEXT_PUBLIC_STAKE_NETWORK=testnet`, `NEXT_PUBLIC_STAKE_CONTRACT` and `NEXT_PUBLIC_STAKE_DEPLOY_BLOCK`.
7. **Recruit 10+ real testers** (M2) and track activity through `/api/metrics`. Fix what they hit.
8. **Mainnet:** repeat steps 3–6 with `botMainnet`. Start with low `maxStake` limits and raise them as usage proves stable.

---

## Threat model

| Threat | Impact | Mitigation | Residual risk |
|---|---|---|---|
| **Resolver key compromise / dishonest resolver** | Wrong outcome on a market (theft of the losing pool for the attacker's side) | Resolver is a separate, revocable role (`setResolver`). Evidence is public and re-checkable. The owner can `cancelMarket` an unresolved market to refund it. | **Primary trust assumption of the MVP.** A resolved outcome is final and can't be reversed on-chain. Keep the key isolated and caps low. Decentralized or optimistic resolution is future work. |
| **Resolver offline** | Funds stuck | `voidStaleMarket` lets anyone refund after close + 3 days | Funds can be delayed by up to 3 days. |
| **Oracle manipulation** | Skewed price at sample time | Short markets on liquid feeds (CoinGecko aggregate). On-chain metrics read at a fixed block. Low `maxStake` caps make manipulation uneconomic. | The BOT price comes from the explorer's `coin_price`, which has thin liquidity behind it. Keep BOT-price caps small. |
| **Stale data** | Resolution on an old value | `maxDelaySec` window around close, otherwise INVALID (refund) | — |
| **Ambiguous / incorrect market parameters** | Disputed outcomes | Template-only questions. Params are validated by the resolver (bad params → INVALID). The contract validates times, limits and text lengths. Owner can cancel. | Operator error inside a valid template, e.g. a wrong threshold. |
| **Time manipulation** | Late stakes after the outcome is known | Staking closes at `closeTime` using block time. BOT Chain blocks are about 0.7s apart, so validator skew is seconds. Sampled feeds allow ±10 min. | Markets shorter than a few minutes are discouraged (`MIN_DURATION` = 1 min). |
| **Last-second information edge** | Informed stakers bet just before close | Pari-mutuel pools; `maxStake` per wallet | Inherent to time-based close. A future version may add a stake cut-off before close. |
| **Reentrancy on claim / fee withdrawal** | Double payout | `nonReentrant`, state set before the transfer, tested with an attacker contract | — |
| **Double settlement / double claim** | Insolvency | `outcome` written once (`AlreadySettled`); `claimed` flag (`AlreadyClaimed`); tested | — |
| **Unexpected token behaviour** | Accounting errors | Native BOT only: no ERC-20 transfer hooks or fee-on-transfer tokens. Direct BOT transfers to the contract are rejected. | — |
| **Unbounded loops / gas DoS** | Stuck functions | No loops over users. `getMarkets` page size is capped at 50. | — |
| **Admin abuse** | Censorship, fee changes | Fee capped at 5% and fixed per market. Owner can only refund (`cancelMarket`), never redirect stakes. `pause` blocks new markets and stakes but **never claims or resolution**. | The owner can cancel any unresolved market. Move ownership to a multisig before mainnet. |
| **Receiver that rejects BOT** | Claim fails | The claim reverts whole (`TransferFailed`) and stays claimable later. Tested. | — |
| **Wash activity inflating rankings** | Misleading leaderboard | Ranking by realized net P&L, not volume | A wallet can trade against itself, but that only moves P&L between its own wallets, minus fees. |
| **Indexer drift** | Wrong history in the UI | The index is a cache. Claimable amounts are verified with `claimable()` before claiming. | — |

---

## Known limitations

- **Testnet only so far.** Mainnet deployment follows the plan above once testnet usage is stable.
- **Trusted resolver.** See the threat model.
- **The BOT price source is the explorer's `coin_price`.** It is the most BOT-native feed available. A DEX-pool, at-block price adapter would be stronger and is the next resolver improvement.
- **CoinGecko and explorer values are point-in-time samples**, not historical candles. Exchange APIs (Binance, Coinbase, Kraken) were unreachable from the build environment, so they were not used.
- **In-memory index.** On serverless hosts it is rebuilt per instance from logs. A persistent indexer is needed once log volume grows.
- **Off-chain metrics are not collected yet.** Views, returning users and retention need privacy-respecting analytics. On-chain metrics are live at `/api/metrics`.
- **`address-txs` counts transactions sent by an account (its nonce).** It suits EOAs. A contract's nonce only counts the contracts it creates.

---

## Security checklist (PRD §18)

Checks-effects-interactions ✔ · access control on admin, creator and resolver functions ✔ · no unbounded loops ✔ · reentrancy guards ✔ · input validation ✔ · lifecycle validation ✔ · duplicate-settlement protection ✔ · duplicate-claim protection ✔ · zero-value and invalid position handling ✔ · explicit resolver and admin permissions ✔ · custom errors for every failure state ✔

An independent review is still recommended before mainnet with meaningful limits.

---

## License

MIT
