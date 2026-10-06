# prd.md — STAKE product requirements (living summary)

> **Source of truth:** [`STAKE_PRD.md`](STAKE_PRD.md) is the original, complete PRD and wins on any conflict
> about *product* scope. [`frontend.md`](frontend.md) is the original design spec. This file condenses both,
> records how each requirement is met, and logs every decision that refines or deviates from them.
> Read this first, then open the originals for detail.

Last updated: 2026-10-06

---

## 1. What STAKE is

**STAKE is a fast, low-cost prediction market built for the BOT Chain ecosystem.**

Users stake native **BOT** on short-duration **YES/NO** markets about BOT price, crypto prices and measurable
BOT Chain activity. After the market closes, an access-controlled resolver writes the outcome and its evidence
on-chain, and winners claim a pari-mutuel share of the pool. All financial state lives in one smart contract on
BOT Chain (an EVM Layer 1, ~0.7 s blocks, near-zero fees).

**Goal:** a real, deployed product that qualifies for the **BOT Labs incubation programme**: deployed and
verified contracts, a working frontend, real users and measurable on-chain activity, not a hackathon demo.

## 2. Core user flow (PRD §6)

Connect wallet → browse markets → open a market → read question + deadline → choose YES/NO → enter stake →
confirm BOT transaction → position recorded on-chain → market closes → market resolves → winner claims payout.

## 3. Hard rules from the PRD (do not violate)

1. **The blockchain is load-bearing:** markets, positions, stakes, resolution, payout eligibility and claims are on-chain.
2. **No new token.** Settle in native BOT.
3. **Operator-only market creation** for the MVP. No permissionless markets.
4. **Only deterministic markets:** every market declares a resolution source; no ambiguous questions.
5. **Resolution happens once, after close, and is access-controlled.** Double settlement and double claims must be impossible.
6. **Never hardcode remembered BOT Chain config.** Verify chain IDs, RPCs and explorers from official sources.
7. **Never fake usage, metrics, users, transactions or test results.**
8. **Commit continuously** with small conventional commits (PRD §27, target 50+).
9. **The 5 standard routes only:** `/`, `/markets`, `/market/[marketId]`, `/leaderboard`, `/profile`.
10. **MVP non-goals:** AMM, order books, leverage, multichain, a project token, DAO, permissionless markets, dispute systems, a native mobile app.

## 4. Requirement status

| PRD area | Requirement | Status | Where |
|---|---|---|---|
| §6 Market model | id, question, description, sides, stake asset, min/max, open/close, status, outcome, pools, resolver ref, created | ✅ | `contracts/contracts/StakeMarkets.sol` `Market` struct |
| §7 Market types | BOT price, crypto price, ecosystem metric, ecosystem event | ✅ 4 types, 5 templates | `contracts/tasks/markets.ts`, `web/src/lib/templates.ts` |
| §8 Creation | authorized creator only; validated params | ✅ | `createMarket`, `onlyCreator` |
| §9 Resolution | declared source, once, after close, on-chain, access-controlled, safe failure | ✅ | `resolve`, `voidStaleMarket`, `cancelMarket`, `/resolver` |
| §10 Payout | pari-mutuel, documented fee | ✅ 1% of the losing pool | README "Fee model" |
| §11 Claims | winners claim once; losers can't | ✅ tested | `claim`, `claimable` |
| §12 Profile | wallet, entered, wins, losses, staked, payouts, claimable, recent | ✅ | `/profile` |
| §13 Leaderboard | verifiable ranking | ✅ ranked by realized net P&L | `/leaderboard`, `web/src/lib/activity.ts` |
| §14 Discovery | active, closing soon, resolved, my positions | ✅ plus BOT/Crypto/Ecosystem tabs | `/markets` |
| §16 Routes | 5 routes | ✅ | `web/src/app` |
| §17 Contracts | minimal | ✅ one contract | `StakeMarkets.sol` |
| §18 Security | CEI, access control, no unbounded loops, reentrancy guards, validation, threat model | ✅ | contract + README "Threat model" |
| §19 Config | verified from official sources | ✅ verified 2026-10-05 | `contracts/hardhat.config.ts`, `web/src/lib/chains.ts` |
| §21 Data | on-chain authoritative; index = cache | ✅ | `web/src/lib/indexer.ts` |
| §24 Metrics | on-chain usage metrics | ✅ on-chain metrics only | `GET /api/metrics` |
| §26 DoD | deployed and verified contracts | ✅ testnet / ❌ mainnet | `contracts/deployments/968.json` |
| §26 DoD | frontend deployed | ✅ https://stake-nine-umber.vercel.app | Vercel |
| §26 DoD | demo video, real users, mainnet | ❌ not done | see `project-plan.md` |

## 5. Product decisions that refine the PRD

| Decision | Choice | Reason |
|---|---|---|
| Settlement asset | Native BOT (`msg.value`) | BOT-native; avoids ERC-20 hooks and fee-on-transfer risk |
| Fee | `feeBps` (default 100 = 1%, cap 500), snapshotted per market, charged **on the losing pool only** | A winner never gets back less than their stake |
| Empty winning side | Resolves INVALID → full refunds | Otherwise the losers' funds would be stuck |
| Position model | One side per wallet per market; top-ups allowed; `minStake` per deposit, `maxStake` per wallet total | Keeps wins/losses unambiguous |
| Market close | Time-based (`closeTime`), no transaction needed | Simpler, no keeper |
| Resolver liveness | After `closeTime + 3 days`, anyone can `voidStaleMarket` → refunds | Funds can't be stuck if the resolver dies |
| Stale-data guard | Sampled feeds must be read within 600 s of close, else INVALID | Never resolve on an old price |
| Leaderboard metric | Realized net winnings on settled markets | Volume rewards wash staking; win count rewards spamming minimum bets |
| Questions | Generated from templates, never free text | No ambiguous markets |
| Data sources | Explorer `coin_price` (BOT), CoinGecko (crypto), explorer `total_transactions`, at-block `totalSupply` / `eth_getTransactionCount` | Exchange APIs were unreachable from the build machine |

## 6. Design requirements (frontend.md) and approved deviations

`frontend.md` describes the "Trench" terminal style: warm near-black canvas, IBM Plex Mono with Instrument Serif
as rare display contrast, square corners, 1px rules, a spreadsheet-like market grid, glass sticky top bar and
tabs, a stepper modal, a second-colour footer, and only 160 ms state transitions.

| Deviation | Why |
|---|---|
| **Next.js App Router** instead of Vite with no router | The PRD needs real routes (`/market/[marketId]`) |
| **Accent `#5cd0ff` (light blue)** instead of lime `#d4ff3e` | User request 2026-10-06; §7 allows swapping the accent |
| **Second colour deep navy** (`#05253d` footer, `#072236` action card, `#0a1622` modal visual) instead of teal | User request, to match the blue |
| Grey ramp lifted (`--g400 #8c8c8c`, `--g600 #808080`) | §9 contrast fixes |
| Serif hero "STAKE" on Home | §6.7/§12 allow a short hero; the PRD needs Home to explain the product |
| 4-column grid at ≥1500 px | §12 allows column counts to change |
| Market images (BOT ecosystem renders, coin logos) instead of only the bar visual | User request; §6.5 describes a square image with the bars as fallback |
| New original logo (split S), see `brand/` | User request; §7 replace map |
| Fonts self-hosted via `next/font` | Performance; §11 allows self-hosting |
| GitHub and "My profile" removed from the footer | User request |

## 7. Out of scope right now

Mainnet deployment, permissionless markets, dispute resolution, AI features, reputation, liquidity mechanisms,
off-chain analytics (views, retention). See `project-plan.md` for ordering.
