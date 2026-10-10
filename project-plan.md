# project-plan.md — milestones, status and backlog

Last updated: 2026-10-06 (re-verified: all tests and the build pass). Milestones follow `STAKE_PRD.md` §25. Status here must reflect reality: never mark
something done that wasn't verified.

## Milestones

| # | Milestone | Status | Evidence |
|---|---|---|---|
| M1 | Foundation: repo, contracts project, frontend project, verified BOT Chain config, wallet connection, deploy pipeline, tests, CI | ✅ Done | CI in `.github/workflows/ci.yml` (run status not yet confirmed; the repo may be private) |
| M2 | Market engine: creation, staking, positions, state transitions, tests | ✅ Done | 38 contract tests |
| M3 | Resolution and payout: resolver, settlement, payout, claims, security and failure-path tests | ✅ Done | 12 resolver tests; local end-to-end run (resolve → claim → double-claim rejected) |
| M4 | Frontend product: 5 routes, wallet, stake and claim flows | ✅ Done | Live at https://stake-nine-umber.vercel.app |
| M5 | Testing and mainnet: contract verification, testnet testing, security review, mainnet, production frontend | 🟡 Mostly done | Testnet and **mainnet deployed and verified** (mainnet `0xBf26…D838`, 2026-10-10, 2 markets). A testnet stake settled correctly. **No external security review. Keys not yet split.** |
| M6 | Usage: ≥10 real testers, feedback, build content, docs | ❌ Not started | `/api/metrics` shows 0 predictors |

## Definition of Done (PRD §26)

- [x] Smart contracts deployed (testnet)
- [x] Contracts verified (testnet Blockscout)
- [x] Frontend deployed (Vercel)
- [x] Wallet connection works
- [x] User can enter a market, select YES/NO and stake. Verified on a local chain; **not yet on testnet with a real wallet.**
- [x] Position stored on-chain
- [x] Market can close and resolve (testnet: 4 markets resolved INVALID by the stale-data guard)
- [x] Winner can claim; double claim impossible (tests plus local end-to-end)
- [x] Leaderboard and profile work
- [x] Main routes work; error states handled
- [x] Tests for critical contract logic
- [x] README complete; threat model documented
- [ ] Demo video (2–4 min)
- [x] Public repo with real commit history (74 commits; the repo is currently **private** and must be made public)
- [x] Mainnet deployment (2026-10-10: `0xBf263D8333f21aA55504Adb6404b0a493fb9D838`, verified)
- [ ] Initial real-user testing

## Backlog (priority order)

1. **Move the resolver to an always-on host (VPS).** Blocking: price markets need it within 10 minutes of close. Prepare a setup script, a systemd unit and a health check. *Awaiting the user's choice of provider, and whether the web app stays on Vercel.*
2. **Split roles:** move the resolver role to a dedicated low-balance wallet (`setResolver(new, true)`, then `setResolver(old, false)`). The owner key should never sit on a server. Move ownership to a multisig before mainnet.
3. **First real testnet stake and claim** with a browser wallet on the live site. This verifies the full flow on BOT Chain.
4. **Keep fresh markets open:** create short markets regularly (`stake:create --close-at ...`), at times the resolver host is up.
5. **Recruit ≥10 real testers** (M6) and track `/api/metrics`.
6. **Persistent indexer:** `/api/activity` rebuilds from the deploy block on each serverless cold start and slows as blocks accumulate. Options: cache in Vercel KV or Postgres, or host the web app on the VPS (long-lived process).
7. **Off-chain metrics** (PRD §24 views, returning users): privacy-respecting analytics.
8. **Demo video, build log, docs** (PRD §4.8).
9. **Stronger BOT price source:** a DEX-pool at-block price adapter instead of the explorer `coin_price`.
10. ~~**Mainnet**~~ **Deployed 2026-10-10** (user chose to skip the key split for launch). Still to do: **separate keys** (owner off the server, dedicated resolver wallet), multisig owner, and raise `maxStake` only after a clean run.
11. **Dependency audit:** `npm ci` in `web/` reports 25 vulnerabilities (23 moderate, 2 high) as of 2026-10-06. Review `npm audit` before mainnet. Don't run `npm audit fix --force` blindly: it can bump Next or wagmi majors.
12. Later phases (PRD §23): community markets, more metrics, recurring micro-markets, reputation. Only after usage proves demand.
