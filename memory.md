# memory.md — decisions, gotchas and working agreements

Durable knowledge an agent needs before touching this repo. Add to it when you learn something non-obvious;
delete entries that become wrong. Last updated: 2026-10-06.

---

## Working agreements with the user

- **Push only when the user says "push".** Commit freely in small conventional commits (PRD §27), but don't push without being asked. The user says "push" explicitly.
- **Explain in plain language.** The user is building toward BOT Labs incubation and isn't asking for jargon. Times: give UTC plus Nigeria time (UTC+1); the user is in Nigeria.
- **Never handle private keys in chat or logs.** The user pastes keys into the gitignored `.env` files. Don't print them, and don't put a key in Vercel or any `NEXT_PUBLIC_*` variable.
- **Don't change working parts unnecessarily.** Inspect first, then make minimal targeted edits.
- **Never fake usage, metrics or test results** (PRD hard rule). Report failures honestly.
- **Keep the five context docs current** (`prd.md`, `architecture.md`, `project-plan.md`, `memory.md`, `handoff.md`) after any significant change, and always update `handoff.md` at the end of a session.

## Key decisions (why things are the way they are)

- **One contract, native BOT, pari-mutuel, fee on the losing pool only.** Details in `prd.md` §5.
- **Trusted, access-controlled resolver** plus public evidence, a 3-day grace period, then anyone-can-void. The PRD allows a trusted resolver for the MVP.
- **`getMarkets(start, count)` paginated view:** BOT testnet has **no Multicall3**, so don't use wagmi `useReadContracts` or multicall on testnet. Use `Promise.all(readContract)`.
- **Leaderboard = realized net P&L,** to avoid rewarding wash volume.
- **Questions come only from templates.** `contracts/tasks/markets.ts` and `web/src/lib/templates.ts` duplicate the logic and **must stay in sync** (wording, `fmt()` thousands separators, `$` prefix on prices).
- **Price sources:** CoinGecko and the BOT explorer stats API. Binance, Coinbase and Kraken were unreachable from the build machine (HTTP 000).
- **Design system is `frontend.md`**, with approved deviations listed in `prd.md` §6. Accent is **`#5cd0ff`**, not lime. The second colour is **navy**, not teal. Logo is the **split S** (`brand/`). Use `.accent-text` (the old `.lime` class was renamed).
- **Next.js, not Vite**, because the PRD requires real routes.

## Gotchas (learned the hard way)

- **Import the injected connector from `@wagmi/core`**, not `wagmi/connectors`. The latter pulls optional SDKs (`@x402/evm`, Coinbase) and breaks `next build`.
- **TypeScript is pinned to ~5.8** in `contracts/`. TS 7 breaks `ts-node` and Hardhat.
- **The user's deployer key has no `0x` prefix.** Hardhat accepts it. The resolver normalizes it in `config.ts`; viem alone would crash.
- **`next build` overwrites `web/.next`**, which breaks a running `next dev`. Stop the dev server, delete `.next`, and restart after building.
- **Windows background processes:** one `npx tsx src/index.ts` appears as **3 node processes** (npx → tsx → child). That's one resolver, not three. Stopping a harness task can leave orphans: check ports or processes before restarting, and never run two resolvers with the same key (nonce clashes).
- **Headless Chrome `--window-size` has a ~500 px minimum width.** For phone screenshots use Playwright's `chrome-headless-shell` (`~/AppData/Local/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-win64/chrome-headless-shell.exe`).
- **Sampled-feed markets refund if the resolver is late (>600 s after close).** This happened to testnet markets #0–#3 while the PC was asleep. It's working as designed, but schedule closes when the resolver host is up.
- **The `address-txs` template uses the nonce**, which only counts transactions an EOA sends. For contracts it only counts contract creations.
- **Hardhat `stake:create --minutes`** is relative to the latest block. Prefer `--close-at 2026-10-07T12:00:00Z` for round times.
- **The GitHub Actions API returns 404 unauthenticated** (repo likely private), so CI status hasn't been confirmed from here.
- **Serverless indexer:** `/api/activity` on Vercel rebuilds its in-memory event cache on every cold start (50k-block chunks from the deploy block). It gets slower as testnet blocks accumulate (~130k/day).

## Verified external facts (re-verify before mainnet: PRD §19)

| Fact | Value | Verified |
|---|---|---|
| BOT mainnet chain ID / RPC / explorer | 677 / `https://rpc.botchain.ai` / `https://scan.botchain.ai` | 2026-10-05 (docs, Chainlist, `eth_chainId` = 0x2a5) |
| BOT testnet chain ID / RPC / explorer / faucet | 968 / `https://rpc.bohr.life` / `https://scan.bohr.life` / `https://faucet.botchain.ai/basic` | 2026-10-05 (`eth_chainId` = 0x3c8) |
| Explorers | Blockscout (`/api/v2/stats`, verification at `<explorer>/api`) | 2026-10-05 |
| Gas price (testnet) | 20 gwei. Deploy ≈ 3.3M gas ≈ 0.07 tBOT | 2026-10-05 |
| WBOT (mainnet) | `0xD5452816194a3784dBa983426cCe7c122F4abd30` | GuardDog docs + on-chain `totalSupply` |
| Official docs | https://dev-docs.botchain.ai/docs/Developers/quick-guide/ | |
