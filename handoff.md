# handoff.md — where we stopped and what to do next

**Last updated:** 2026-10-07 (about 11:45 UTC) · **Branch:** `main` · **Repo:** https://github.com/Dotman-Bei/Stake

> New agent? Read in this order: `handoff.md` (this file) → `prd.md` → `architecture.md` → `memory.md`
> (rules and gotchas) → `project-plan.md`. Original PRD: `STAKE_PRD.md`. The original design spec `frontend.md` was removed by the user; see `git show f79fdc9:frontend.md`.

---

## 1. Current state, in one paragraph

STAKE is fully built: contract, resolver and web app. All tests pass (contracts 38, resolver 12, web 13, plus
typechecks). The contract is **deployed and verified on BOT Chain testnet** at
`0x8E5e9B96efb446D3F3538971a5C7767a9DDcF779` (chain 968). The frontend is **live on Vercel** at
https://stake-nine-umber.vercel.app. **No real user has staked yet.** The last user-driven work was a new logo
(split S), a light-blue accent, a navy second colour, market images, and a responsiveness/performance pass. All
of it is committed and pushed. The five context docs were added on 2026-10-06 and then **re-verified against the
code and live chain** in a second session on a Linux server (see §4).

## 2. What is running right now (and where)

| Thing | Where | Notes |
|---|---|---|
| Web app | Vercel | Always on. Env: `NEXT_PUBLIC_STAKE_NETWORK=testnet`, `NEXT_PUBLIC_STAKE_CONTRACT=0x8E5e…F779`, `NEXT_PUBLIC_STAKE_DEPLOY_BLOCK=25807866` |
| Resolver (old) | The user's Windows PC (`resolver/`, `npx tsx src/index.ts`, logs to `%TEMP%/stake-resolver.log`) | **Evidently stopped before 2026-10-06 15:51 UTC.** Don't restart it while the server one runs. |
| **Resolver (live since 2026-10-07 11:39 UTC)** | Linux server `/root/Stake/Stake` (Ubuntu 24.04, Node 22, NTP synced) | The user added `resolver/.env` (mode 600) on 2026-10-06 ~10:50 UTC. Checked: the key maps to `0xAF9d…A8aA`, `isResolver` = true, 9.8 tBOT for gas, and an `npm run once` pass ran clean. Runs as a detached `nohup` process, logging to `/var/log/stake-resolver.log`. **No auto-restart yet** (see §4). |
| Local dev server | The user's PC, `http://localhost:3000` (`web/.env.local` points at testnet) | Optional; not needed now that Vercel is live |

## 3. Testnet markets (all 0.01–10 tBOT, 1% fee)

| # | Market | Close (UTC) | State | Needs resolver near close? |
|---|---|---|---|---|
| 0–3 | BOT, BTC, ETH, chain-tx markets | 2026-10-05 | **Refunded (INVALID):** the resolver ran hours late while the PC slept | — |
| 4 | WBOT supply > 1,267,000 | 2026-10-06 15:51 | **Resolved YES** 2026-10-07 11:39 UTC (observed 1,268,686; tx `0x3bb3394b…3561f`) | — |
| 5 | BOT > $12.36 | 2026-10-07 12:00 | Open | **Yes (±10 min)** |
| 6 | BTC > $86,000 | 2026-10-07 14:00 | Open | **Yes** |
| 7 | ETH > $2,700 | 2026-10-07 15:00 | Open | **Yes** |
| 8 | SOL < $120 | 2026-10-07 16:00 | Open | **Yes** |
| 9 | BOT Chain total txs > 22,320,000 | 2026-10-07 18:00 | Open | **Yes** |

## 4. Where we stopped exactly

**Latest session (2026-10-06 ~03:15–03:30 UTC, Linux server):** the user asked to make the repo portable between AI
agents. The five docs already existed, so this session **verified** them instead of rewriting:
- Tests re-run from a clean `npm ci`: contracts **38 passing**, resolver typecheck clean and **12/12**, web **13/13**, and `next build` OK.
- Live chain matches the docs. `eth_chainId` = 968. `marketCount` = 10. `/api/metrics`: 10 created, 4 refunded, 0 positions, 0 predictors.
- Only `memory.md`, `handoff.md` and `project-plan.md` were edited. No application code was touched.
- **Pushing from the server works** via the deploy key `~/.ssh/id_stake_ed25519`, added on GitHub on 2026-10-07. The command is in `memory.md` → Gotchas.

**Resolver now runs on the Linux server (2026-10-07 11:39 UTC).** At 11:37 UTC, #4 was found unresolved ~20 h after
close, so the PC resolver had evidently stopped. With 23 min to the #5 close, the user asked to start the resolver here.
It runs as a detached `nohup` process (`cd resolver && nohup ./node_modules/.bin/tsx src/index.ts >> /var/log/stake-resolver.log 2>&1 &`).
It is **not a systemd service**: it does not restart on a crash or reboot. Check it with `pgrep -af "tsx src/index.ts"` and
`tail -f /var/log/stake-resolver.log`. Stop it with `pkill -f "tsx src/index.ts"`. **Don't start the PC resolver again** while this one runs.

**Resolver move (2026-10-06 ~10:50 UTC):** the user chose this Linux server as the resolver host and added the key.
Remaining work: run it continuously. The plan is `deploy/vps/stake-resolver.service` (systemd, `Restart=always`,
`ConditionPathExists=.env`) plus `deploy/vps/setup.sh`. Claude Code's auto-mode permission check blocked
writing/installing the service, so it needs the user's explicit permission rule, or the user runs the install themselves.
After it starts here, **the user must stop the PC resolver** (never two resolvers with the same key).

**Still open from the session before:** the question about **moving to a VPS**. The proposed plan:
- Run the resolver on a VPS (Ubuntu 24.04, Node 22, systemd or pm2, auto-restart, NTP-synced clock).
- Optionally host the web app there too (fixes the indexer cold-start issue). Otherwise keep it on Vercel.
- Move the resolver role to a dedicated low-balance wallet, so the owner key never sits on a server.

**The user has not answered yet:** (a) which VPS provider, and (b) whether the website stays on Vercel. The Linux
server above already meets the requirements and may be the answer to (a). Confirm with the user.

## 5. Next steps (do in order)

1. **Ask or confirm the VPS answers above**, then prepare in-repo:
   - `deploy/vps/setup.sh` (installs Node 22 and git, clones, `npm ci` in `resolver/`)
   - `deploy/vps/stake-resolver.service` (systemd, `Restart=always`)
   - a short README section with the steps
   - a simple health signal (e.g. last-tick timestamp in the logs or a tiny HTTP endpoint)

   The user puts the key into `resolver/.env` on the server themselves. **Once the VPS resolver runs, stop the PC resolver** (never two at once).
2. **Before 2026-10-07 11:50 UTC**, make sure exactly one resolver is running somewhere that stays up through 18:10 UTC, or markets #5–#9 refund.
3. Optional but recommended: `setResolver(<new wallet>, true)` from the owner, update `resolver/.env` on the VPS, then `setResolver(old, false)`.
4. Do a **real stake and claim on testnet** through the live site with a browser wallet (faucet tBOT), to confirm the full flow on-chain.
5. Keep fresh markets open (`npx hardhat stake:create --network botTestnet ... --close-at <ISO>`), at times the resolver host is up.
6. Continue the backlog in `project-plan.md` (testers, persistent indexer, demo video, mainnet).

## 6. How to verify the repo quickly

```bash
cd contracts && npm ci && npx hardhat test        # 38 passing
cd ../resolver && npm ci && npm test              # 12 pass
cd ../web && npm ci && npm test && npm run build  # 13 pass, build OK
curl https://stake-nine-umber.vercel.app/api/metrics   # live on-chain metrics
```

Secrets are not in the repo. `contracts/.env` and `resolver/.env` exist only on the user's PC. Copy
`*/.env.example` and ask the user to fill in keys.

## 7. Session log (newest first)

- **2026-10-07:**
  - Found the PC resolver down.
  - Started the resolver on the Linux server; #4 resolved YES.
  - Deploy key added on GitHub; doc commits pushed from the server.
- **2026-10-06 (Linux server, ~03:30 UTC):**
  - Verified the context docs against code, tests and the live chain.
  - Recorded the two-machine setup and the push gotcha.
  - Created the deploy key `id_stake_ed25519` (not yet added on GitHub).
- **2026-10-06:**
  - Added the portable context docs.
  - Deployed to Vercel and linked it in the README.
  - New split-S logo system (`brand/`).
  - Responsive and performance pass.
  - Light-blue accent and navy second colour.
  - Market images.
  - Five markets closing 2026-10-07.
  - `--close-at` task option.
  - Resolver accepts keys without `0x`.
- **2026-10-05:**
  - Full build (contracts, resolver, web).
  - Local end-to-end run.
  - Testnet deploy and verification.
  - First five markets; #0–#3 refunded because the PC slept.
  - Pushed to GitHub.
