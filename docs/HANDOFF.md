# Handoff — 2026-02-17 — HB

> **Author:** HB | **Date:** 2026-02-17

## Project Status

The MVP is feature-complete and has been deployed to Sepolia testnet. The factory contract is live and verified on Etherscan. Frontend is configured to point at the Sepolia deployment but has not yet been deployed to Vercel. Branch `feature/real-teams-2025` is still open — PR to `main` has not been created yet.

| Layer | Status | Tests |
|-------|--------|-------|
| Smart Contracts (Foundry) | Complete | 64 tests pass |
| Off-Chain Scorer (TypeScript) | Complete | Pre-existing Node.js version issue (needs Node 16+) |
| Frontend (Next.js + wagmi) | Complete | Pre-existing Node.js version issue (`npm run build` fails, `npm run dev` works) |

## What Was Done This Session

- **Completed Sepolia deployment (Task 3):**
  - Set up Alchemy Sepolia RPC URL and added to `contracts/.env`
  - Created new dedicated MetaMask deployer wallet (separate from Anvil dev key)
  - Funded deployer with Sepolia ETH via Google Cloud faucet
  - Obtained Etherscan API key and WalletConnect Project ID
  - First deploy attempt used stale placeholder USDC address (`0x000...0001`) — caught from broadcast JSON, redeployed with correct Circle Sepolia USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`)
  - **Factory deployed to Sepolia:** `0x93a9e45C2aF7D6b858F54CFd70cD2a677552Cedd` (verified on Etherscan)
  - Updated `web/.env.local` with new factory address and WalletConnect Project ID
- **UI fix (prior to this session):** Randomize button visibility issue resolved — no further action needed

## What's Next

1. **Deploy frontend to Vercel** — repo must be pushed to GitHub first, then connect via Vercel dashboard; set env vars (`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_FACTORY_ADDRESS`) in Vercel project settings
2. **Full Sepolia E2E test** — create a test pool via the deployed frontend, submit entries, run scorer, post Merkle root, claim prize
3. **Create PR** for `feature/real-teams-2025` → `main` — install `gh` CLI if needed (`sudo apt install gh && gh auth login`)
4. **Fix Node.js version** — scorer tests and frontend build require Node 16+; install via `nvm`
5. **Production readiness** — security audit/peer review, mainnet deploy, Gnosis Safe multisig for admin/treasury, verify contracts on mainnet Etherscan
6. **World Cup 2026 pivot** — Phase B (`sportId` in contracts), Phase C (shared sports config), Phase D (World Cup bracket picker UI). Design doc: `docs/plans/2025-02-10-world-cup-pivot-design.md`

## Current Branch State

- **Branch:** `feature/real-teams-2025` (12 commits ahead of `main`)
- **Pushed:** Yes, up to date with `origin/feature/real-teams-2025`
- **Open PR:** None — not yet created
- **Uncommitted:** Only untracked files (`claude.md`, `docs/handoff-hb-2026-02-11.md`, `docs/screenshots/`, `contracts/broadcast/`) — none blocking

## Local Development Setup

Anvil state resets on restart. To get back to a working state locally:

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

- **Local (Anvil):** Network RPC `http://127.0.0.1:8545`, Chain ID `31337`; import Anvil account #0 key `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- **Sepolia:** Add Sepolia network in MetaMask; use the dedicated deployer wallet (not the Anvil key)
- Use Chrome/Brave (Safari doesn't support wallet extensions)

### Environment Files (not tracked by git)

**`contracts/.env`:**
```
PRIVATE_KEY=<deployer wallet private key>
USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238   # Circle Sepolia USDC
TREASURY_ADDRESS=<treasury address>
SEPOLIA_RPC_URL=<Alchemy Sepolia HTTPS URL>
ETHERSCAN_API_KEY=<Etherscan API key>
```

**`web/.env.local`:**
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<WalletConnect project ID>
NEXT_PUBLIC_FACTORY_ADDRESS=0x93a9e45C2aF7D6b858F54CFd70cD2a677552Cedd
```

### Sepolia Deployment

- **Factory:** `0x93a9e45C2aF7D6b858F54CFd70cD2a677552Cedd` (verified on Sepolia Etherscan)
- **USDC:** Circle Sepolia USDC at `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` (get test tokens from Circle's faucet)
- Deploy command: `source .env && forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify` (from `contracts/`)

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
