# AGENTS.md

Instructions for any AI coding agent working in this repo.

**Read before doing anything, in this order:**

1. [`handoff.md`](handoff.md): where we stopped, what is running, and what to do next
2. [`prd.md`](prd.md): what STAKE is, requirements status, approved deviations
3. [`architecture.md`](architecture.md): how it is built and where everything lives
4. [`memory.md`](memory.md): working agreements, decisions and gotchas (**read the rules**)
5. [`project-plan.md`](project-plan.md): milestones and backlog

Originals: [`STAKE_PRD.md`](STAKE_PRD.md) (product source of truth), [`frontend.md`](frontend.md) (design source of truth).

**Non-negotiables (details in `memory.md`):**
- Never commit or print private keys.
- Never fake usage, metrics or test results.
- Commit in small conventional commits; push only when the user asks.
- Don't rewrite working code unnecessarily.
- Update `handoff.md`, and any affected context doc, after every significant change.
