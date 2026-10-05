# PRD.md — STAKE

## 1. Product Overview

**Product Name:** STAKE

**Category:** Prediction Market

**Target Chain:** BOT Chain

**Project Goal:** Build and ship a real, deployable prediction-market application on BOT Chain that is strong enough to qualify for the BOT Labs incubation programme.

**Core Product Idea:**

STAKE is a fast, simple prediction-market platform focused on short-duration YES/NO markets, especially markets tied to the BOT Chain ecosystem and measurable crypto/market events.

Examples:

- Will BOT price be above a specified level at the end of the round?
- Will a BOT Chain ecosystem metric exceed a specified threshold before the deadline?
- Will a selected BOT ecosystem project reach a defined transaction/activity milestone?
- Will a supported crypto asset be above/below a specified price at settlement?

The first version must remain intentionally simple. It should prove the complete prediction-market loop end-to-end rather than attempting to become a full Polymarket-style platform.

---

# 2. Problem

Existing prediction markets can be complicated for users who only want to make quick, simple predictions.

STAKE should make the core experience:

1. Discover a market.
2. Understand the question and deadline immediately.
3. Choose YES or NO.
4. Stake BOT.
5. Wait for the market to close.
6. Receive a transparent on-chain result.
7. Claim winnings if the prediction is correct.

The product should optimize for frequent, low-value interactions where BOT Chain's speed and low transaction costs are useful.

---

# 3. Product Vision

Become a simple prediction layer for the BOT Chain ecosystem.

Longer term, STAKE should evolve from a small binary prediction application into infrastructure for:

- BOT ecosystem prediction markets
- crypto market predictions
- community-created markets
- AI-generated market suggestions
- forecasting reputation
- recurring micro-markets
- ecosystem engagement

The first release must NOT attempt to implement all of these.

---

# 4. Incubation Strategy

The project must be built according to the BOT Chain Builder / BOT Labs incubation requirements.

The following principles are mandatory:

### 4.1 Real Product, Not a Hackathon Throwaway

Prioritize:

- Deployed product over prototype
- Working demo over slides
- Real users over presentation claims
- Measurable on-chain activity
- A credible path from MVP to scale

The end goal is the BOT Labs incubation opportunity, not merely completion of a hackathon submission.

### 4.2 BOT Chain Must Be Load-Bearing

STAKE must NOT be a normal web app with blockchain added only for wallet connection.

The blockchain must be essential to the product.

The on-chain layer must handle core financial state and settlement such as:

- Market creation/configuration
- User positions
- Stake amounts
- Market closing
- Resolution state
- Payout eligibility
- Claiming winnings
- Market activity/history

A user should be able to verify the critical parts of the market lifecycle on BOT Chain.

### 4.3 BOT-Native Differentiation

STAKE should take advantage of BOT Chain characteristics instead of behaving like a generic Ethereum/L2 dApp.

Prioritize:

- Short-duration markets
- Frequent market activity
- Small-value prediction positions
- Fast transaction confirmation
- Low transaction costs
- BOT ecosystem-native markets
- Frequent on-chain interaction

The product should be defensible as:

> "A fast, low-cost prediction market designed around the BOT Chain ecosystem and BOT Chain's fast, low-fee execution."

### 4.4 Do Not Invent a Token

STAKE does not need a new project token for the MVP.

Use BOT and/or the supported settlement asset defined by the implementation plan.

Do not create a token merely to make the project appear more serious.

If tokenomics are introduced in a later phase, there must be a real product reason and a documented economic model.

### 4.5 Deployment Requirement

The project must ultimately have:

- Deployed smart contracts
- Verified contracts
- Working frontend
- Working end-to-end market flow
- Public repository
- README
- 2–4 minute demo video
- Mainnet deployment or a clearly executable mainnet deployment plan

Development should begin on testnet where appropriate, then move to BOT Chain mainnet after verification and testing.

### 4.6 Evidence of Usage

The build should intentionally collect evidence of:

- Unique users
- Wallet connections
- Markets participated in
- Number of positions
- Transaction count
- Total prediction volume
- Successful settlements
- Successful payout claims

Even a small number of real users is valuable. The team should aim to recruit real testers rather than presenting only simulated usage.

### 4.7 Milestone-Based Development

Development must be broken into measurable milestones.

Suggested milestones:

**M1 — Working MVP**
- Contracts deployed
- Market creation working
- YES/NO positions working
- Market close/resolution working
- Payout claim working
- Frontend connected end-to-end

**M2 — First Real Users**
- Recruit at least 10 real testers
- Record on-chain activity
- Fix major usability/security issues
- Publish build log/content

**M3 — Ecosystem Growth**
- Increase number of active users
- Add more BOT ecosystem market templates
- Improve market creation/resolution tooling
- Establish repeat usage

**M4 — Incubation Expansion**
- Community-created markets
- Additional market categories
- Forecasting/reputation features
- More ecosystem integrations

Only build later milestones after the MVP is stable.

### 4.8 Community Foundation

As part of the build, contribute to the BOT ecosystem through:

- Build updates
- Documentation
- Tutorials
- Feedback on BOT Chain developer experience
- Bug reports where appropriate
- Community participation
- Public build logs

The project should demonstrate that the team can contribute users and value to the wider ecosystem.

---

# 5. Target Users

### Primary User

Crypto users who want to make simple, short-duration predictions using BOT.

### Secondary Users

BOT Chain community members who want markets about:

- BOT price
- BOT ecosystem activity
- ecosystem projects
- ecosystem milestones
- measurable on-chain events

### Future User Groups

- Community market creators
- Professional forecasters
- AI forecasting agents
- BOT ecosystem projects

These future groups are NOT required for MVP.

---

# 6. MVP Scope

The MVP must support a simple binary prediction market.

## Core Market Model

Every MVP market has:

- Market ID
- Question
- Description
- YES option
- NO option
- Stake asset
- Minimum stake
- Maximum stake
- Open time
- Close time
- Resolution status
- Final outcome
- Total YES stake
- Total NO stake
- Resolver/configuration reference
- Created timestamp

## Core User Flow

```text
Connect Wallet
        ↓
Browse Markets
        ↓
Open Market
        ↓
Read Question + Deadline
        ↓
Choose YES or NO
        ↓
Enter Stake Amount
        ↓
Confirm BOT transaction
        ↓
Position Recorded On-Chain
        ↓
Market Closes
        ↓
Market Resolves
        ↓
Winner Determined
        ↓
User Claims Payout
```

---

# 7. Market Types

The MVP should support a small set of predefined market templates.

### Type A — BOT Price

Example:

> Will BOT be above $X at 8:00 PM UTC?

### Type B — Crypto Price

Example:

> Will BTC be above $X at 8:00 PM UTC?

### Type C — BOT Ecosystem Metric

Example:

> Will a specified BOT ecosystem metric exceed X before the deadline?

### Type D — BOT Ecosystem Event

Example:

> Will a defined measurable ecosystem event occur before the deadline?

The implementation must only include markets that have a clear, deterministic resolution source.

Do not support ambiguous questions in the MVP.

---

# 8. Market Creation

MVP market creation should be restricted to an authorized operator/admin account.

Do NOT make unrestricted user-created markets in the first version.

An authorized creator must provide:

- Question
- Market type
- Resolution source
- Resolution parameters
- Open time
- Close time
- Stake asset
- Min stake
- Max stake

The contract must validate basic market parameters.

Future versions may introduce permissionless community-created markets.

---

# 9. Resolution System

Resolution is a critical part of STAKE.

The implementation must define a reliable resolution mechanism before production deployment.

For MVP, use an explicit resolver architecture rather than pretending the smart contract can directly know arbitrary real-world outcomes.

Possible MVP resolver approaches:

- Trusted resolver using a secure backend/oracle integration
- BOT-supported data source
- External oracle/data feed where suitable
- On-chain measurable event verification

The final resolver choice must be documented in the technical implementation plan.

### Requirements

- Every market must declare its resolution source.
- Resolution must only happen once.
- Resolution must happen after the market closes.
- The final result must be recorded on-chain.
- The resolver must be access-controlled.
- Invalid or failed resolution states must be handled safely.
- The system must prevent a second settlement.

Do not build a complicated decentralized dispute system for MVP unless required by the selected data source.

---

# 10. Payout Model

MVP should use a simple pari-mutuel style model unless the technical design identifies a safer/simple alternative.

Conceptually:

```text
Total Pool
= YES Stakes + NO Stakes

Winning Side Pool
= Stakes placed on the winning side

Each winning position
receives a proportional share of the distributable pool
minus any explicitly documented protocol fee.
```

Example:

```text
YES Pool: 70 BOT
NO Pool: 30 BOT
Total Pool: 100 BOT

If YES wins:
YES participants share the distributable 100 BOT
proportionally according to their YES stake.
```

The exact fee model must be explicitly documented before implementation.

Avoid complicated liquidity-provider or AMM mechanics in MVP.

---

# 11. Claiming Winnings

After resolution:

- A winning user can claim.
- A losing position cannot claim a payout.
- A winning position can only be claimed once.
- The contract must track claimed status.
- Double claims must be impossible.

The frontend must show:

- Position
- Result
- Stake
- Expected payout
- Claim status
- Claim transaction

---

# 12. User Profile

The application should maintain an on-chain-derived user history.

The profile should show:

- Connected wallet
- Total markets entered
- Wins
- Losses
- Total amount staked
- Total payouts
- Current claimable winnings
- Recent positions

No centralized financial balance should be treated as the source of truth.

---

# 13. Leaderboard

The MVP should include a simple leaderboard.

Possible ranking metrics:

- Total prediction volume
- Number of wins
- Win rate
- Net winnings

The exact primary ranking metric should be chosen to avoid encouraging misleading behavior.

The leaderboard should be based on verifiable activity.

Where possible, derive results from indexed on-chain data rather than manually maintained values.

---

# 14. Market Discovery

Users should be able to see:

- Active markets
- Closing soon
- Recently resolved
- My positions

Each market card/list item should expose:

- Question
- YES/NO participation
- Current pool information
- Closing time
- Market status

MVP should avoid complex filtering/search unless it is required for usability.

---

# 15. Frontend Requirements

No visual or design requirements are defined in this PRD.

**When frontend implementation begins, the building agent MUST read and follow `frontend.md`.**

`frontend.md` is the source of truth for:

- Visual design
- Layout
- Components
- Styling
- Responsive behavior
- Interaction patterns
- Typography
- Visual hierarchy
- Frontend polish

Do not invent separate design rules in this PRD.

---

# 16. Standard Pages and Routes

The MVP will have **5 standard pages/routes**.

### 1. Home

**Route:** `/`

Purpose:

- Explain STAKE
- Show featured/active markets
- Show key platform stats
- Provide wallet entry point
- Direct users into markets

### 2. Markets

**Route:** `/markets`

Purpose:

- List active markets
- Show closing-soon markets
- Show recently resolved markets
- Open a specific market

### 3. Market Detail

**Route:** `/market/[marketId]`

Purpose:

- Show market question
- Show deadline
- Show YES/NO pool data
- Allow user to choose a side
- Allow user to stake
- Show user's existing position
- Show market status
- Show resolution information
- Show claim action after settlement

### 4. Leaderboard

**Route:** `/leaderboard`

Purpose:

- Rank users
- Show prediction performance
- Link to user profiles

### 5. Profile

**Route:** `/profile`

Purpose:

- Show connected user's prediction history
- Show wins/losses
- Show stake/payout totals
- Show claimable winnings
- Show recent positions

### Route Summary

```text
/                         Home
/markets                  Markets
/market/[marketId]        Market Detail
/leaderboard              Leaderboard
/profile                  Profile
```

**Total standard pages: 5**

Wallet connection, transaction confirmation, staking forms, claim flows, loading states, errors and result states should be handled within these routes rather than creating unnecessary standalone pages.

---

# 17. Smart Contract Architecture

The MVP should keep contracts minimal.

Suggested architecture:

### Market Contract

Responsible for:

- Market creation
- Market configuration
- YES/NO stakes
- Market closing
- Market resolution
- Payout calculation
- Claiming payouts

### Optional Registry / Config Contract

Only create this if there is a clear need for reusable configuration such as:

- Authorized market creators
- Authorized resolvers
- Supported assets
- Protocol fee configuration

Do not split functionality into many contracts without a reason.

---

# 18. Security Requirements

Follow the BOT Chain Builder security baseline.

The implementation must include:

- Checks-effects-interactions
- Access control on admin/resolver functions
- No unbounded loops
- Reentrancy protection where applicable
- Input validation
- Market lifecycle validation
- Protection against duplicate settlement
- Protection against duplicate payout claims
- Safe handling of zero-value/invalid positions
- Explicit resolver permissions
- Explicit admin permissions
- Clear failure states

For DeFi/prediction functionality, specifically consider:

- Oracle manipulation
- Stale data
- Incorrect resolution
- Resolver compromise
- Time manipulation assumptions
- Economic attacks
- Market parameter abuse
- Unexpected token behavior

A threat model must be included in the final README.

---

# 19. BOT Chain Configuration

Never hardcode remembered BOT Chain configuration values.

Before deployment, the agent MUST fetch and verify the current:

- Mainnet Chain ID
- Mainnet RPC
- WebSocket RPC if needed
- Explorer
- Testnet
- Testnet RPC
- Faucet
- Official deployment guidance

Use official BOT Chain documentation and the current Chainlist entry as sources of truth.

The PRD is intentionally not the source of truth for changing infrastructure values.

---

# 20. Technology Expectations

Use standard EVM tooling.

Suggested stack:

- Solidity
- Hardhat or Foundry
- TypeScript where appropriate
- React/Next.js or another standard frontend framework
- viem/wagmi or equivalent EVM wallet tooling
- An indexing/read layer where useful

The building agent may choose the implementation stack provided that:

1. It remains simple.
2. It is maintainable.
3. It supports BOT Chain correctly.
4. Contracts remain independently verifiable.
5. The architecture does not introduce unnecessary infrastructure.

---

# 21. Data Architecture

On-chain data is authoritative for financial state.

The frontend/backend may maintain indexed/read-optimized data for:

- Market lists
- User history
- Leaderboards
- Aggregated statistics

However:

- Staked amounts must ultimately be verifiable on-chain.
- Resolution must be verifiable on-chain.
- Payout claims must be verifiable on-chain.
- Indexed data must not be treated as a replacement for contract state.

---

# 22. MVP Non-Goals

Do NOT build these into the first release:

- AMM prediction markets
- Complex order books
- Leverage
- Multiple chains
- Project token
- NFT system unless directly useful
- DAO governance
- Permissionless market creation
- Advanced dispute resolution
- Complex social network features
- Mobile native application
- Dozens of oracle integrations
- Complex AI prediction agents
- Advanced copy trading
- Anonymous/encrypted prediction infrastructure

The goal is a reliable, deployed binary prediction-market MVP.

---

# 23. Future Expansion

After the MVP is proven, possible additions include:

### Phase 2

- Community-created markets
- More BOT ecosystem metrics
- More data sources
- Recurring micro-markets
- Better market discovery
- User reputation

### Phase 3

- AI-generated market suggestions
- AI forecasting agents
- Forecaster reputation
- Public forecasting statistics
- Agent-created markets subject to policy constraints

### Phase 4

- Liquidity mechanisms
- Additional market types
- Ecosystem integrations
- Partnerships
- Broader crypto/event markets

Only implement these after sufficient usage validates demand.

---

# 24. Metrics

Track at least:

### Acquisition

- Connected wallets
- New users
- Returning users

### Usage

- Markets viewed
- Markets entered
- Positions created
- Average stake
- Repeat predictions per user

### On-chain

- Total transactions
- Total prediction volume
- Markets created
- Markets resolved
- Payout claims

### Retention

- 7-day returning users
- 30-day returning users
- Average predictions/user
- Repeat market participation

### Ecosystem

- BOT-denominated volume
- BOT Chain transactions generated
- Number of BOT ecosystem markets
- Users interacting with BOT ecosystem-specific markets

These metrics should be available for future incubation reporting.

---

# 25. Milestone Plan

## Milestone 1 — Foundation

Deliver:

- Repository initialized
- Smart-contract project initialized
- Frontend project initialized
- BOT Chain configuration verified
- Wallet connection
- Contract deployment pipeline
- Basic test framework
- CI/checking where useful

## Milestone 2 — Market Engine

Deliver:

- Market creation
- Market configuration
- YES/NO staking
- Position recording
- Market state transitions
- Contract tests

## Milestone 3 — Resolution + Payout

Deliver:

- Resolver integration
- Market settlement
- Payout calculation
- Claim system
- Security tests
- Failure-path tests

## Milestone 4 — Frontend Product

Deliver:

- Home
- Markets
- Market Detail
- Leaderboard
- Profile
- Wallet interaction
- End-to-end market participation
- End-to-end claim flow

The building agent MUST use `frontend.md` when implementing this milestone.

## Milestone 5 — Testing + Mainnet

Deliver:

- Full end-to-end testing
- Contract verification
- Security review
- Testnet testing
- Fixes
- Mainnet deployment
- Production frontend deployment

## Milestone 6 — Usage

Deliver:

- Recruit first real users
- Gather feedback
- Fix usability issues
- Track transactions/usage
- Publish build content
- Publish documentation

---

# 26. Definition of Done

STAKE MVP is considered complete only when all of the following are true:

- [ ] Smart contracts are deployed.
- [ ] Contracts are verified.
- [ ] Frontend is deployed.
- [ ] Wallet connection works.
- [ ] User can enter a market.
- [ ] User can select YES/NO.
- [ ] User can stake.
- [ ] Position is stored on-chain.
- [ ] Market can close.
- [ ] Market can resolve.
- [ ] Winner can claim.
- [ ] Double claiming is impossible.
- [ ] Leaderboard works.
- [ ] User profile/history works.
- [ ] Main routes work.
- [ ] Error states are handled.
- [ ] Tests exist for critical contract logic.
- [ ] README is complete.
- [ ] Threat model is documented.
- [ ] Demo video is prepared.
- [ ] Public repository contains real commit history.
- [ ] Mainnet deployment exists or there is a credible mainnet deployment plan.
- [ ] At least initial real-user testing has been performed.

---

# 27. Git Commit Rules

Git commits are a required part of the development process.

During the build, commit changes continuously instead of waiting until the entire project is finished.

## Commit Frequency

For a normal build, aim for **50+ meaningful commits** across the development process.

Do NOT create 50 meaningless commits just to reach the number. Every commit should represent a real, completed development step.

Make a commit whenever you complete a logical unit of work, such as:

- Creating a new page
- Creating or modifying a component
- Adding a feature
- Implementing an API endpoint
- Adding database functionality
- Adding authentication logic
- Adding validation
- Adding error handling
- Connecting frontend to backend
- Adding a utility/helper
- Adding a configuration
- Refactoring a specific section
- Fixing a bug
- Improving an existing feature
- Adding tests
- Fixing failing tests
- Improving responsiveness
- Fixing accessibility issues
- Updating documentation
- Completing a route
- Completing a major UI section
- Integrating an external service

## Commit Process

After completing each logical development unit:

1. Check the current changes.
2. Verify that the changes work.
3. Stage only the relevant files.
4. Create a descriptive commit.
5. Continue building from the committed state.

Use conventional commit messages where appropriate:

- `feat: add dashboard`
- `feat: add wallet connection`
- `feat: implement transaction history`
- `fix: resolve wallet connection error`
- `refactor: simplify auth middleware`
- `test: add dashboard tests`
- `style: improve mobile layout`
- `docs: update setup instructions`

## Important Rules

- Do NOT wait until the end of the project to commit everything.
- Do NOT make one giant commit containing the entire project.
- Do NOT create fake changes solely to increase the commit count.
- Do NOT repeatedly modify and commit the same thing without a meaningful reason.
- Keep commits small, focused, and logically separated.
- Before moving to the next major feature, make sure the previous feature has been committed.
- If a task contains several independent steps, commit each completed step separately.
- If you encounter and fix a bug during development, commit the fix separately.
- If you make a meaningful refactor, commit it separately.

## Target

For a substantial project, aim for **50+ meaningful commits by the time the build is complete**, distributed naturally throughout development.

The commit history should clearly show the progression of the project from initial setup → individual features → integrations → fixes → testing → polish → final state.

At the end of the build, run `git log` and verify that the history accurately reflects the development process.

---

# 28. Build Rules for the Coding Agent

The building agent must follow these rules throughout implementation:

1. Read this PRD completely before coding.
2. Read `frontend.md` before starting frontend implementation.
3. Do not invent design requirements outside `frontend.md`.
4. Verify current BOT Chain infrastructure values from official sources before deployment.
5. Keep the MVP small and functional.
6. Do not add features just because they sound impressive.
7. Keep blockchain functionality load-bearing.
8. Prefer simple, auditable smart contracts.
9. Test critical financial and settlement logic before mainnet deployment.
10. Commit continuously according to the Git Commit Rules.
11. Never fake usage, metrics, users, transactions or testing results.
12. Document assumptions and known limitations.
13. Preserve a clear path from testnet to mainnet.
14. Keep the architecture extensible without overengineering MVP.
15. Before declaring completion, verify every item in the Definition of Done.

---

# 29. Final Product Positioning

The core message should remain simple:

> **STAKE is a fast, low-cost prediction market built for the BOT Chain ecosystem.**

The MVP wins by being:

- Simple
- Fast
- On-chain
- Verifiable
- BOT-native
- Easy to understand
- Easy to use
- Easy to expand

The project should not attempt to beat larger prediction markets through feature count.

It should prove that **short-duration, low-cost, ecosystem-native prediction markets are a useful product primitive on BOT Chain.**
