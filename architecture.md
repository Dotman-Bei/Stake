# architecture.md — how STAKE is built

Last updated: 2026-10-06. See `prd.md` for *what* and *why*; this file covers *how* and *where*.

---

## 1. System overview

```
                    ┌──────────────────────────────────────────────┐
 creator wallet ───▶│  StakeMarkets.sol  (BOT Chain, one contract) │◀─── user wallets: stake(), claim()
 (CLI or UI)        │  markets · positions · pools · outcome ·     │
                    │  evidence · claims · fees                    │
 resolver service ─▶│  resolve(id, outcome, evidence)              │◀─── anyone: voidStaleMarket()
 (/resolver, Node)  └───────────────┬──────────────────────────────┘
                                    │ eth_call (state)   eth_getLogs (events)
                    ┌───────────────▼──────────────────────────────┐
                    │  web/ (Next.js 15 on Vercel)                 │
                    │  browser: wagmi/viem read state + send txs   │
                    │  server:  /api/activity (event index cache)  │
                    │           /api/metrics  (usage metrics)      │
                    └──────────────────────────────────────────────┘
 resolver reads sources: BOT Chain explorer API · CoinGecko · BOT Chain RPC (at-block reads)
```

Three packages, no monorepo tooling. Each has its own `package.json` and lockfile:

| Package | Stack | Runs where |
|---|---|---|
| `contracts/` | Hardhat 2.29, Solidity 0.8.28 (evm `paris`, optimizer 200), OpenZeppelin 5, ethers v6 tests | Deployed to BOT Chain |
| `resolver/` | Node 22, TypeScript (ESM), viem 2, run with `tsx` | Linux server (Ubuntu 24.04) as the systemd service `stake-resolver` since 2026-10-07. See `deploy/vps/`. |
| `web/` | Next.js 15.5 (App Router), React 19, wagmi 2, viem 2, TanStack Query 5, hand-written CSS (no Tailwind) | Vercel (root dir `web`) |

Supporting folders: `brand/` (logo SVGs plus generator), `.github/workflows/ci.yml` (tests and build on push).

---

## 2. Smart contract: `contracts/contracts/StakeMarkets.sol`

Inherits `Ownable2Step`, `ReentrancyGuard`, `Pausable` (OpenZeppelin 5).

**Enums:**
- `MarketType {BotPrice, CryptoPrice, EcosystemMetric, EcosystemEvent}`
- `Side {None, Yes, No}`
- `Outcome {Unresolved, Yes, No, Invalid}`
- `Status {Upcoming, Open, Closed, Resolved, Invalid}` (derived)

**Market struct:** `totalYes, totalNo, minStake, maxStake, openTime, closeTime, createdAt, resolvedAt, yesCount,
noCount, feeBps, marketType, outcome, creator, resolvedBy, fee, question, description, resolutionSource,
resolutionParams, resolutionEvidence`.

**Position struct:** `side, claimed, amount`, keyed by `(marketId, user)`.

| Function | Who | Notes |
|---|---|---|
| `createMarket(CreateParams)` | `isCreator` | `openTime=0` opens immediately. Duration between 1 min and 30 days; open delay ≤ 30 days. Text limits: question 200, description 1000, source 200, params 500 bytes. |
| `stake(id, side)` payable | anyone | `openTime ≤ now < closeTime`. One side per wallet. `msg.value ≥ minStake`. Wallet total ≤ `maxStake`. |
| `resolve(id, outcome, evidence)` | `isResolver` | After close, within `closeTime + 3 days`. Once only. A win for an empty side becomes `Invalid`. Fee = `losing × feeBps / 10000`. |
| `voidStaleMarket(id)` | anyone | After `closeTime + RESOLUTION_GRACE` (3 days) → `Invalid` |
| `cancelMarket(id, reason)` | owner | Any unresolved market → `Invalid` (refunds only) |
| `claim(id)` | position holder | Winner: `amount × (total − fee) / winningPool`. Invalid: full refund. Checks-effects-interactions, `nonReentrant`. |
| `setCreator / setResolver / setFeeBps (≤500) / setTreasury / withdrawFees / pause / unpause` | owner | `pause` blocks creation and staking only, never resolution or claims |
| Views: `marketCount, getMarket, getMarkets(start, count≤50), getPosition, status, claimable` | — | `getMarkets` exists because testnet has **no Multicall3** |

**Events:** `MarketCreated, PositionTaken, MarketResolved, MarketVoided, Claimed, CreatorUpdated, ResolverUpdated,
FeeUpdated, TreasuryUpdated, FeesWithdrawn`. The web indexer depends on the first five.

**Tests:** 38, in `contracts/test/*.test.ts` with fixtures in `test/fixtures.ts`. Test-only contracts
`contracts/contracts/test/ReentrantClaimer.sol` and `RejectingReceiver`.

**Tooling:**

| Command / file | Purpose |
|---|---|
| `scripts/deploy.ts` | Deploys and writes `deployments/<chainId>.json` (address, deployBlock, constructor args) |
| `scripts/export-abi.ts` | Writes `web/src/lib/abi.ts` and `resolver/src/abi.ts`. **Re-run after any ABI change.** |
| `scripts/seed-local.ts` | Sample data. Refuses any chain except 31337. |
| `npx hardhat stake:create --network botTestnet --template <t> --threshold <n> [--op ">"] [--close-at ISO \| --minutes N] [--asset id --symbol SYM] [--target 0x.. --label ..] [--min 0.01 --max 10] [--dry-run]` | Templates: `bot-price, crypto-price, chain-txs, address-txs, erc20-supply` |
| `stake:cancel --id N --reason ".."` | Owner cancel |
| `stake:withdraw-fees` | Owner fee withdrawal |
| `hardhat.config.ts` | Networks `botTestnet` (968) and `botMainnet` (677), env-overridable. Etherscan `customChains` point at Blockscout (`<explorer>/api`). |

---

## 3. Resolution params schema (stored on-chain as JSON in `resolutionParams`)

| `kind` | Fields | Read |
|---|---|---|
| `price` + `feed: "blockscout"` | `url, field` (e.g. `coin_price`), `op, threshold, maxDelaySec` | Sampled at close |
| `price` + `feed: "coingecko"` | `id` (e.g. `bitcoin`), `op, threshold, maxDelaySec` | Sampled at close |
| `explorerStat` | `url, field` (e.g. `total_transactions`), `op, threshold, maxDelaySec` | Sampled at close |
| `txCount` | `chainId, address, op, threshold` | `eth_getTransactionCount` at the first block with timestamp ≥ close |
| `erc20Supply` | `chainId, token, decimals, op, threshold` | `totalSupply()` at the first block ≥ close |

`op` is one of `> >= < <=`. `threshold` is a decimal string, compared exactly as 18-decimal fixed point.
Templates generating these live in **two places that must stay in sync**: `contracts/tasks/markets.ts` (CLI) and
`web/src/lib/templates.ts` (UI).

---

## 4. Resolver: `resolver/`

| File | Role |
|---|---|
| `src/config.ts` | Env: `STAKE_CHAIN_ID`, `STAKE_RPC_URL`, `STAKE_CONTRACT` (or `../contracts/deployments/<id>.json`), `RESOLVER_PRIVATE_KEY` (with or without `0x`), `POLL_SECONDS=15`, `GIVE_UP_MARGIN_SECONDS=3600`, `DATA_RPC_<chainId>` |
| `src/index.ts` | Each tick: read `marketCount`, page `getMarkets`. For each unresolved market past close and inside the grace window: `decide()`, then `simulateContract`, then `writeContract`. `--once` runs a single tick. |
| `src/decide.ts` | Pure decision. Bad params → INVALID. Sampled feed more than `maxDelaySec` from close → INVALID. Source error → wait, until `giveUpAt` (grace end minus 1 h) → INVALID. Otherwise YES or NO with JSON evidence (≤ 500 bytes). |
| `src/sources.ts` | Adapters plus `blockAtOrAfter` (binary search, about 20 s on mainnet) |
| `src/params.ts` | Schema validation, exact decimal compare |
| `test/` | 12 tests (`npm test`) |

**Operational constraint:** sampled feeds need the resolver running **within 10 minutes of each close**.

**Deployment:** `deploy/vps/setup.sh` installs `deploy/vps/stake-resolver.service`. The unit has `Restart=always`, `RestartSec=10` and `ConditionPathExists=resolver/.env`, and it starts at boot. Logs go to journald (`journalctl -u stake-resolver`).

---

## 5. Web app: `web/`

**Routes** (`src/app`). Each `page.tsx` is a thin server wrapper (metadata) around a client `*View.tsx`.

| Route | View | Data |
|---|---|---|
| `/` | `HomeView.tsx` | Hero, platform stats strip, featured live markets |
| `/markets?tab=&q=` | `markets/MarketsView.tsx` | Tabs: active, closing, resolved, mine, bot, crypto, ecosystem. Search via `q`. Creator-only `CreateMarketPanel`. |
| `/market/[marketId]` | `market/[marketId]/MarketDetailView.tsx` | Grid areas `head / rail / body`. The rail (`ActionPanel`) drops between head and body below 1180 px. |
| `/leaderboard` | `leaderboard/LeaderboardView.tsx` | Ranked by realized net P&L |
| `/profile?address=` | `profile/ProfileView.tsx` | Defaults to the connected wallet. Claimable amounts are verified on-chain with `claimable()`. |
| `GET /api/activity` | `api/activity/route.ts` | Decoded events (bigints as strings) |
| `GET /api/metrics` | `api/metrics/route.ts` | PRD §24 on-chain metrics JSON |

**Key modules:**

| Module | Role |
|---|---|
| `lib/chains.ts` | BOT mainnet/testnet/local chain definitions (verified values) plus env: `NEXT_PUBLIC_STAKE_NETWORK` (`testnet`, `mainnet` or `local`), `NEXT_PUBLIC_STAKE_CONTRACT`, `NEXT_PUBLIC_STAKE_DEPLOY_BLOCK`, optional `NEXT_PUBLIC_STAKE_RPC` |
| `lib/wagmi.ts` | Injected connector from **`@wagmi/core`** (not `wagmi/connectors`, which breaks the build) and EIP-6963 discovery |
| `lib/abi.ts` | Generated; don't edit |
| `lib/markets.ts` | Types, `marketStatus`, payout math (mirrors the contract), tabs/filtering, tone hashing |
| `lib/activity.ts` | Event types and `aggregate()` → holdings, per-user stats, platform totals, `leaderboard()` |
| `lib/indexer.ts` | Server-only incremental `getContractEvents` in 50k-block chunks, **in-memory cache**. Rebuilds from the deploy block on cold start. |
| `lib/templates.ts` | UI market templates (keep in sync with the CLI) |
| `lib/marketImage.ts` | Market → image from params (`public/markets/*.png`) |
| `lib/errors.ts` | Custom revert → plain message |
| `lib/format.ts` | BOT/time/address formatting |
| `hooks/useStake.ts` | `useNow`, `useMarkets` (contract reads every 10 s), `useMarket`, `useActivity` (`/api/activity` every 15 s), `useAggregate`, `feedState` |
| `hooks/useBoard.ts` | Participants and the wallet's own sides per market |

**Components** (`src/components`): `Chrome` (shell plus modal state), `Topbar`, `WalletButton`, `MarketTabs`,
`MarketBoard` (`BoardHeader`, `EmptyState`, `MarketGrid` with a per-card coarse clock), `MarketCard` (memoized;
`MarketVisual` uses `next/image`), `ActionPanel` (stake, claim, void), `CreateMarketPanel`, `HowItWorksModal`
(focus trap), `TxNotice`, `Footer`, `Icons` (`StakeMark`, `StakeWordmark`, icon set).

**Styling:** single file `src/app/globals.css`.
- Tokens are on `:root`: `--accent #5cd0ff`, `--accent-dim` 8%, `--accent-border` 28%, navy `--deep*`, the grey ramp, `--topbar-h` and `--tabs-h` for sticky offsets.
- Breakpoints: 1500 (4 columns), 1280, 1180 (rail stacks), 1040 (2 columns), 980 (top bar wraps), 760 (phone), 380.
- Fonts come from `next/font` (`--font-mono`, `--font-serif`) in `layout.tsx`.

**Tests:** 13, in `src/lib/*.test.ts` (`npm test`, uses `tsx --test`).

---

## 6. Environments and deployments

| | Value |
|---|---|
| BOT testnet | chain **968**, RPC `https://rpc.bohr.life`, explorer `https://scan.bohr.life` (Blockscout), faucet `https://faucet.botchain.ai/basic` |
| BOT mainnet | chain **677**, RPC `https://rpc.botchain.ai`, WSS `wss://ws-rpc.botchain.ai`, explorer `https://scan.botchain.ai` (Multicall3 exists on mainnet only) |
| **Contract (mainnet)** | `0xBf263D8333f21aA55504Adb6404b0a493fb9D838`, chain 677, deploy block `26193710`, **source verified** (deployed 2026-10-10). Record: `contracts/deployments/677.json`. Fee 1%; markets use 0.01–5 BOT limits |
| Contract (testnet, retired 2026-10-10) | `0x5394eE5dD8b31e1058393918a305E6408d5117E2`, deploy block `26019797`, **source verified** (deployed 2026-10-07). Retired v1: `0x8E5e9B96efb446D3F3538971a5C7767a9DDcF779` (block 25807866; record in `contracts/deployments/968-v1.json`) |
| Roles (mainnet and testnet) | owner = creator = resolver = treasury = `0xAF9d11E465511076C8A53fA06AE7Eb84FF40A8aA` |
| Frontend | https://stake-nine-umber.vercel.app (Vercel, root `web`, the three `NEXT_PUBLIC_*` vars above). **Switching to mainnet** on 2026-10-10 (`NEXT_PUBLIC_STAKE_NETWORK=mainnet`) |
| Gas | Pinned to **20 gwei**: `gasPrice` in `hardhat.config.ts` (`BOT_GAS_PRICE_GWEI`), `GAS_PRICE_GWEI` in the resolver. `eth_gasPrice` swings 20↔50 |
| Repo | https://github.com/Dotman-Bei/Stake, branch `main` |

**Secrets (gitignored, never commit):** `contracts/.env` (`DEPLOYER_PRIVATE_KEY`), `resolver/.env`
(`RESOLVER_PRIVATE_KEY`), `web/.env.local` (public values only). Templates: `*/.env.example`.

---

## 7. Commands cheat sheet

```bash
# contracts
cd contracts && npm ci && npx hardhat test
npm run deploy:testnet                      # needs contracts/.env
npx hardhat verify --network botTestnet <addr> <owner> <creator> <resolver> <treasury> <feeBps>
npx hardhat run scripts/export-abi.ts       # after any ABI change
# resolver
cd resolver && npm ci && npm test && npm start   # needs resolver/.env
# web
cd web && npm ci && npm test && npm run dev      # needs web/.env.local
npm run build
# brand
node brand/build.mjs
```
