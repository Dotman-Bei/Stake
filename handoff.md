# handoff.md — where we stopped and what to do next

**Last updated:** 2026-10-07 (about 12:30 UTC) · **Branch:** `main` · **Repo:** https://github.com/Dotman-Bei/Stake

> New agent? Read in this order: `handoff.md` (this file) → `prd.md` → `architecture.md` → `memory.md`
> (rules and gotchas) → `project-plan.md`. Original PRD: `STAKE_PRD.md`. The original design spec `frontend.md` was removed by the user; see `git show f79fdc9:frontend.md`.

---

## 1. Current state, in one paragraph

STAKE is fully built: contract, resolver and web app. All tests pass (contracts 38, resolver 12, web 13, plus
typechecks). The contract is **deployed and verified on BOT Chain testnet** at
`0x5394eE5dD8b31e1058393918a305E6408d5117E2` (chain 968, deploy block 26019797). It was **redeployed on 2026-10-07** to give a clean market list; the old
contract `0x8E5e9B96efb446D3F3538971a5C7767a9DDcF779` is retired and nothing watches it. The frontend is **live on Vercel** at
https://stake-nine-umber.vercel.app. **No real user has staked yet.** The last user-driven work was a new logo
(split S), a light-blue accent, a navy second colour, market images, and a responsiveness/performance pass. All
of it is committed and pushed. The five context docs were added on 2026-10-06 and then **re-verified against the
code and live chain** in a second session on a Linux server (see §4).

## 2. What is running right now (and where)

| Thing | Where | Notes |
|---|---|---|
| Web app | Vercel | Always on. Env: `NEXT_PUBLIC_STAKE_NETWORK=testnet`, `NEXT_PUBLIC_STAKE_CONTRACT=0x5394eE5dD8b31e1058393918a305E6408d5117E2`, `NEXT_PUBLIC_STAKE_DEPLOY_BLOCK=26019797`. Updated in Vercel and redeployed 2026-10-07; `/api/metrics` confirmed the new contract with 10 markets at 12:22 UTC. |
| Resolver (old) | The user's Windows PC (`resolver/`, `npx tsx src/index.ts`, logs to `%TEMP%/stake-resolver.log`) | **Evidently stopped before 2026-10-06 15:51 UTC.** Don't restart it while the server one runs. |
| **Resolver** | Linux server `/root/Stake/Stake` (Ubuntu 24.04, Node 22, NTP synced), **systemd service `stake-resolver`** since 2026-10-07 12:25 UTC | `Restart=always` and starts at boot (a crash test restarted it in ~10 s). Key is in `resolver/.env` (mode 600; wallet `0xAF9d…A8aA`). Check with `systemctl status stake-resolver` and `journalctl -u stake-resolver -f`. |
| Local dev server | The user's PC, `http://localhost:3000` (`web/.env.local` points at testnet) | Optional; not needed now that Vercel is live |

## 3. Testnet markets on `0x5394…17E2` (all 0.01–10 tBOT, 1% fee, created 2026-10-07 ~12:05 UTC)

Every market needs the resolver running near close, except the WBOT market (#5), which reads its value on-chain at close and can settle late.

| # | Market | Close (UTC) | Type |
|---|---|---|---|
| 0 | BOT > $12.40 | 2026-10-08 12:00 | BOT price (explorer) |
| 1 | BTC > $84,000 | 2026-10-08 14:00 | Crypto (CoinGecko) |
| 2 | ETH > $2,600 | 2026-10-08 16:00 | Crypto |
| 3 | BOT Chain total txs > 22,470,000 | 2026-10-08 18:00 | Ecosystem (explorer) |
| 4 | SOL > $120 | 2026-10-09 12:00 | Crypto |
| 5 | WBOT supply > 1,270,000 | 2026-10-09 18:00 | Ecosystem (at-block) |
| 6 | BNB > $780 | 2026-10-10 14:00 | Crypto (no image; fallback visual) |
| 7 | XRP > $1.50 | 2026-10-11 14:00 | Crypto (no image; fallback visual) |
| 8 | BOT > $13 | 2026-10-12 12:00 | BOT price |
| 9 | BOT Chain total txs > 23,280,000 | 2026-10-14 12:00 | Ecosystem |

Thresholds were set near the 2026-10-07 values: BTC 83,621, ETH 2,577, SOL 117, BNB 767, XRP 1.44, BOT 12.36,
txs 22.29M at about 142k/day, WBOT 1,268,528. Old contract v1 history: #0–#3 refunded, #4 resolved YES, and #5–#9
were left unresolved when the user switched contracts (no stakes, so nothing is at risk). After the 3-day grace
period, anyone can void them.

## 4. Where we stopped exactly

**Latest session (2026-10-06 ~03:15–03:30 UTC, Linux server):** the user asked to make the repo portable between AI
agents. The five docs already existed, so this session **verified** them instead of rewriting:
- Tests re-run from a clean `npm ci`: contracts **38 passing**, resolver typecheck clean and **12/12**, web **13/13**, and `next build` OK.
- Live chain matches the docs. `eth_chainId` = 968. `marketCount` = 10. `/api/metrics`: 10 created, 4 refunded, 0 positions, 0 predictors.
- Only `memory.md`, `handoff.md` and `project-plan.md` were edited. No application code was touched.
- **Pushing from the server works** via the deploy key `~/.ssh/id_stake_ed25519`, added on GitHub on 2026-10-07. The command is in `memory.md` → Gotchas.

**Fresh contract and 10 new markets (2026-10-07 ~12:00 UTC).** The user asked to remove all old markets. On-chain
markets can't be deleted, so the user chose a **fresh contract**: deployed `0x5394…17E2` with the same wallet and fee,
verified it (Blockscout auto-matched), backed up the old record to `contracts/deployments/968-v1.json`, restarted
the resolver (it reads `deployments/968.json`), and created the 10 markets in §3. Deploy and create used the key in
`resolver/.env` (the same wallet as owner and creator), passed as `DEPLOYER_PRIVATE_KEY` for the command only.
`contracts/.env` does not exist on the server.
**Done:** the user updated the Vercel env and redeployed; the live site serves the new contract (checked 12:22 UTC).

**Resolver is now a systemd service (2026-10-07 12:25 UTC).** The user said "go on", so `deploy/vps/setup.sh` and
`deploy/vps/stake-resolver.service` were added and installed. The interim nohup process was stopped by PID, then the
service was started. A `kill -9` test confirmed auto-restart. The nohup notes below are history.

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

1. ~~VPS resolver~~ **Done** (systemd service on the Linux server). Optional: a health signal. The resolver logs nothing on a quiet tick, so a periodic heartbeat line or a tiny HTTP endpoint would help monitoring.
2. **Watch the first settlements:** #0 at 2026-10-08 12:00 UTC, then #1–#3 the same day (`journalctl -u stake-resolver`).
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
  - Resolver installed as a systemd service (`deploy/vps/`); auto-restart verified.
  - Fresh contract `0x5394…17E2` deployed and verified.
  - 10 new markets created (5 ecosystem, 5 crypto, closing Oct 8–14).
  - Resolver switched to the new contract.
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
