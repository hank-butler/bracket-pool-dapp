# Handoff — 2026-02-16 — CL

> **Author:** CL | **Date:** 2026-02-16

## Project Status

The bracket-pool-dapp MVP is feature-complete and end-to-end tested on local Anvil. This session replaced placeholder team names with real 2025 March Madness data and simplified from a 67-game bracket to 63 games (dropping First Four play-in picks). A PR is open for review.

| Layer | Status | Tests |
|-------|--------|-------|
| Smart Contracts (Foundry) | Complete | 64 tests pass |
| Off-Chain Scorer (TypeScript) | Complete | 21 tests pass |
| Frontend (Next.js + wagmi) | Complete | Builds cleanly |

## What Was Done This Session

- Replaced placeholder teams ("East 1", "West 12") with real 2025 NCAA Tournament teams (Auburn, Duke, Houston, Florida as 1-seeds) on branch `feature/real-teams-2025`
- Simplified bracket from 67 games to 63 games — dropped First Four play-in picks entirely
- Updated scorer index ranges and point values for 63-game layout (perfect bracket = 1,920 pts)
- Updated BracketPicker component: removed First Four section, uses `TeamInfo.seed` for seed display instead of string parsing
- Added `/update-teams` slash command (`.claude/commands/update-teams.md`) for future Selection Sunday updates — fetches from two sources, cross-references, gets human approval
- Added `/handoff` slash command (`.claude/commands/handoff.md`) for session handoff tracking with author initials
- Added `CLAUDE.md` with project context, commands, and conventions
- Opened PR #3: https://github.com/hank-butler/bracket-pool-dapp/pull/3

## What's Next

1. **Manual browser test of real teams** — run `cd web && npm run dev`, verify bracket shows real team names with seeds, clicking advances teams, randomize fills all 63 games, Final Four and Championship render correctly
2. **Merge PR #3** — after browser verification passes
3. **Update `DeployLocal.s.sol`** — currently creates pool with `gameCount=67`, needs to be `63` to match the new bracket structure
4. **Test refund flow in browser** — `RefundEntry.tsx` is built but untested in browser. Three conditions: pool cancelled, insufficient entries, past finalize deadline
5. **Get WalletConnect project ID** — register at https://cloud.walletconnect.com, set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in `.env.local`
6. **Testnet deployment (Sepolia)** — deploy factory, create test pool with `gameCount=63`, full E2E test
7. **World Cup 2026 pivot** — Phase B (add `sportId` to contracts), Phase C (shared sports config), Phase D (World Cup bracket picker UI). Design doc at `docs/plans/2025-02-10-world-cup-pivot-design.md`

## Current Branch State

- **Branch:** `feature/real-teams-2025` (10 commits ahead of `main`)
- **Open PR:** https://github.com/hank-butler/bracket-pool-dapp/pull/3
- **Uncommitted:** `scorer/output-0xcafac3dd.json` (untracked, not related to this work)

## Local Development Setup

Anvil state resets on restart. To get back to a working state:

```bash
# Terminal 1 — start Anvil
cd ~/madness-app/bracket-pool-dapp/contracts
~/.foundry/bin/anvil

# Terminal 2 — deploy contracts
cd ~/madness-app/bracket-pool-dapp/contracts
export PATH="$HOME/.foundry/bin:$PATH"

# Deploy MockUSDC
forge create test/mocks/MockUSDC.sol:MockUSDC \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# Update contracts/.env with MockUSDC address, then deploy factory
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Terminal 3 — start frontend
cd ~/madness-app/bracket-pool-dapp/web
npm run dev
# Open http://localhost:3000
```

### MetaMask Configuration

- Network: Anvil Local, RPC: `http://127.0.0.1:8545`, Chain ID: `31337`
- Import Anvil account #0 private key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- Use Chrome/Brave (Safari doesn't support wallet extensions)

### Environment Files (not tracked by git)

**`contracts/.env`:**
```
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
USDC_ADDRESS=<deployed MockUSDC address>
TREASURY_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

**`web/.env.local`:**
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=PLACEHOLDER
NEXT_PUBLIC_FACTORY_ADDRESS=<deployed factory address>
```

## Key Architecture Decisions

- **63 games** (Round of 64 through Championship, no First Four), 6 rounds with doubling points (10/20/40/80/160/320)
- **First Four handling** — play-in winners are resolved on the frontend before lock time, not picked by users. Lock time set to Thursday (R64 start)
- **Hash-only storage** — contract stores `keccak256(picks)`, full picks emitted in events
- **5% fee** via `totalPoolValue * 500 / 10000` (Solidity integer division)
- **Merkle tree claims** — scorer generates tree, root posted on-chain, proofs hosted on IPFS
- **Claim deadline** — `finalizeDeadline + 90 days`, then admin can sweep unclaimed funds
- **Tiebreaker** — predicted championship total score, closest wins, ties split evenly
- **Team data** — static config file in `web/src/lib/teams.ts`, updated via `/update-teams` slash command on Selection Sunday
- **Sport-agnostic contracts** — `gameCount` is a parameter, World Cup will use `gameCount=88` with a future `sportId` field
