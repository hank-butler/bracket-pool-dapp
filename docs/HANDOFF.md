# Handoff — 2026-02-16 — HB

> **Author:** HB | **Date:** 2026-02-16

## Project Status

The bracket-pool-dapp MVP is feature-complete and all three refund scenarios have been verified end-to-end in the browser on local Anvil. A bug was found and fixed in `DeployLocal.s.sol` (gameCount 67 → 63). Branch `feature/real-teams-2025` is pushed and ready for a PR to `main`.

| Layer | Status | Tests |
|-------|--------|-------|
| Smart Contracts (Foundry) | Complete | 64 tests pass |
| Off-Chain Scorer (TypeScript) | Complete | Pre-existing Node.js version issue (needs Node 16+) |
| Frontend (Next.js + wagmi) | Complete | Pre-existing Node.js version issue (`npm run build` fails, `npm run dev` works) |

## What Was Done This Session

- **Verified all 3 refund scenarios** end-to-end in browser on local Anvil:
  - Pool cancelled by admin — refund panel appeared with "Pool cancelled", refund tx succeeded
  - Insufficient entries after lock time — refund panel appeared with "Not enough entries after lock time", refund tx succeeded
  - Past finalize deadline, no merkle root — refund panel appeared with "Finalization deadline passed without results", refund tx succeeded
- **Fixed `DeployLocal.s.sol`** — was creating pools with `gameCount=67` but frontend bracket structure only supports 63 games (no First Four). Changed to `gameCount=63` (commit `6548f3b`)
- **Updated `docs/handoff-2026-02-16.md`** — marked refund testing done, corrected stale "67 games" architecture reference to "63 games"
- **Pushed branch** `feature/real-teams-2025` to origin (12 commits ahead of `main`)

## What's Next

1. **Install `gh` CLI** — needed for creating PRs from the command line. Run: `sudo apt install gh` then `gh auth login`
2. **Create PR** for `feature/real-teams-2025` → `main` — branch is pushed, PR not yet created
3. **Merge PR #3** (if still open) and/or the new PR
4. **Fix Node.js version** — scorer tests and frontend build require Node 16+. Current system Node is too old. Consider installing via `nvm`
5. **Get WalletConnect project ID** — register at https://cloud.walletconnect.com, set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in `.env.local`
6. **UX improvements** — randomize button is easy to miss (subtle gray text), general polish pass
7. **Testnet deployment (Sepolia)** — deploy factory with `gameCount=63`, create test pool, full E2E test
8. **World Cup 2026 pivot** — Phase B (add `sportId` to contracts), Phase C (shared sports config), Phase D (World Cup bracket picker UI). Design doc at `docs/plans/2025-02-10-world-cup-pivot-design.md`

## Current Branch State

- **Branch:** `feature/real-teams-2025` (12 commits ahead of `main`)
- **Pushed:** Yes, up to date with `origin/feature/real-teams-2025`
- **Open PR:** None yet (PR #3 may be stale — check status)
- **Uncommitted:** Only untracked files (`claude.md`, `docs/handoff-hb-2026-02-11.md`, `docs/screenshots/`) — none related to this session's work

## Local Development Setup

Anvil state resets on restart. To get back to a working state:

```bash
# Terminal 1 — start Anvil
cd contracts
~/.foundry/bin/anvil

# Terminal 2 — deploy contracts
cd contracts
export PATH="$HOME/.foundry/bin:$PATH"
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
# Note the Factory and MockUSDC addresses from output

# Terminal 3 — start frontend
# Update web/.env.local with the factory address from deploy output
cd web
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
