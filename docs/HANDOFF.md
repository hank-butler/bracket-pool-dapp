# Handoff — 2026-02-21 — HB

> **Author:** HB | **Date:** 2026-02-21

## Project Status

The branch `feature/route-updates` contains the full IPL standings support, admin UI, and all frontend lint fixes. It has been smoke tested end-to-end against local Anvil and is ready for PR review before merging to `main`. An IPL test pool is live on Sepolia at `0x2d68ae8c9f2101247197366c71175a948f3d3701` with one entry submitted.

| Layer | Status | Tests |
|-------|--------|-------|
| Smart Contracts (Foundry) | Complete | 64 tests pass |
| Off-Chain Scorer (TypeScript) | Complete — IPL scoring added | 39 tests pass (5 test files) |
| Frontend (Next.js + wagmi) | Complete — lint clean, build passes | 0 errors, 0 warnings |

## What Was Done This Session

- **Reviewed IPL files** — walked through all IPL-related code pulled in via PR #6: `web/src/lib/ipl.ts` (10 teams, standings state helpers), `web/src/lib/poolTypes.ts` (gameCount→type mapping), `web/src/components/StandingsPicker.tsx` (drag-and-drop UI), `scorer/src/ipl-scoring.ts` (position accuracy + bonus scoring, perfect score = 150)
- **Deployed IPL test pool on Sepolia** — called `factory.createPool` with `gameCount=10`, lock time 2h, finalize deadline 7 days. Pool at `0x2d68ae8c9f2101247197366c71175a948f3d3701`. One test entry submitted via the Vercel branch preview using the StandingsPicker UI. Entry confirmed on-chain: tx `0x6e598c9bf617e729aa9dd455e06f6200955cbf297eccbd2c48d31c06a219b444`
- **Fixed all frontend lint errors** — 8 errors and 4 warnings resolved across 8 files:
  - `pool/[address]/page.tsx` — moved 3 hooks before early return, removed unused vars
  - `ClaimPrize.tsx` — replaced `Date.now()` in render with `useState(() => Date.now() / 1000)` lazy initializer, moved before early return
  - `StepFinalized.tsx` — same `Date.now()` fix
  - `StepReviewFinalize.tsx` — removed `useEffect` for phase transitions; now uses `onSuccess` callbacks threaded through `setMerkleRoot` / `setProofsCID`
  - `useAdminPool.ts` — `setMerkleRoot` and `setProofsCID` now accept optional `onSuccess` callbacks
  - `useClaim.ts` — replaced three `useState` fetch-state setters with `useReducer`; effect uses `dispatch` (not flagged by `set-state-in-effect` rule)
  - `useEnterPool.ts` — moved `submitEntry` declaration before `enter`, added to dependency array
  - `EntrySubmit.tsx` — removed unused `needsApproval` from destructuring
- **Smoke tested admin UI end-to-end** against local Anvil:
  - Created smoke test pool with 3-minute lock via `contracts/script/CreateSmokeTestPool.s.sol` (new file)
  - Submitted test entry from pool page
  - Admin wizard advanced through all 4 steps after lock time
  - Posted results (63-game `bytes32[]` array), confirmed on-chain
  - Ran scorer via API route (`SCORER_RPC_URL=http://127.0.0.1:8545`), merkle root computed
  - Made IPFS pinning optional in scorer API route — skips Pinata when `PINATA_JWT` is absent, returns placeholder CID for local dev
  - Finalized pool on-chain
  - Refund flow verified (pool had 1 entry, below minimum — refund appeared and succeeded)
- **`docs/issues.md` updated** — lint errors (issue #2) resolved

## What's Next

1. **Open PR** — `feature/route-updates` → `main`. Do NOT merge yet — user wants explicit sign-off before merge.
2. **Add Vercel env vars** — add `PINATA_JWT` and `SCORER_RPC_URL` to Vercel dashboard before deploying to production. Get JWT from app.pinata.cloud (free tier).
3. **Claim flow smoke test** — the admin smoke test only reached refund (1 entry, below minimum). For a full claim test: submit entries from 2+ wallets, finalize, verify claim UI appears and prize is claimable.
4. **Resolve pool type detection** (medium priority) — replace `gameCount` magic number mapping in `web/src/lib/poolTypes.ts` before adding more sports. See `docs/issues.md` #1 for proposed solutions.
5. **Complete Sepolia E2E cycle** — IPL test pool at `0x2d68ae8c9f2101247197366c71175a948f3d3701` locked ~2h after creation (around 2026-02-21 05:30 UTC). Run scorer against it, post Merkle root, claim prize via branch preview.
6. **Production readiness** — security audit/peer review, mainnet deploy, Gnosis Safe multisig for admin/treasury, verify contracts on Etherscan.

## Current Branch State

- **Branch:** `feature/route-updates`
- **Pushed:** No — all changes from this session are uncommitted
- **Open PR:** None yet — to be opened this session
- **Uncommitted changes:** 9 modified files (lint fixes + scorer API route change) + `contracts/script/CreateSmokeTestPool.s.sol` (new, untracked)

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
# Update web/.env.local with the new factory address

# Terminal 3 — start frontend
cd web
npm run dev   # also runs prebuild (copies scorer source into web/src/scorer/)
# Open http://localhost:3000
```

To create a short-window pool for admin smoke testing:
```bash
cd contracts
FACTORY_ADDRESS=<factory> ~/.foundry/bin/forge script script/CreateSmokeTestPool.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

### MetaMask Configuration

- **Local (Anvil):** Network RPC `http://127.0.0.1:8545`, Chain ID `31337`; import Anvil account #0 key `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- **Sepolia:** Use the dedicated deployer wallet; get test USDC from faucet.circle.com
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
NEXT_PUBLIC_FACTORY_ADDRESS=0x93a9e45C2aF7D6b858F54CFd70cD2a677552Cedd   # Sepolia
PINATA_JWT=<Pinata JWT from app.pinata.cloud>      # optional for local dev
SCORER_RPC_URL=http://127.0.0.1:8545              # or Sepolia RPC for testnet
```

### Sepolia Deployment

- **Factory:** `0x93a9e45C2aF7D6b858F54CFd70cD2a677552Cedd` (verified on Sepolia Etherscan)
- **IPL Test Pool:** `0x2d68ae8c9f2101247197366c71175a948f3d3701` (gameCount=10, locked ~2026-02-21 05:30 UTC)
- **March Madness Test Pool:** `0x5eBca3ae0c84F597C922f3B0A8B2631b8049BCc3`
- **Frontend:** `https://bracket-pool-dapp.vercel.app/`
- **Branch Preview:** Vercel auto-deploys `feature/route-updates` as a preview URL

## Key Architecture Decisions

- **63 games** (Round of 64 through Championship, no First Four), 6 rounds with doubling points (10/20/40/80/160/320)
- **Hash-only storage** — contract stores `keccak256(picks)`, full picks emitted in events
- **5% fee** via `totalPoolValue * 500 / 10000` (Solidity integer division)
- **Merkle tree claims** — scorer generates tree, root posted on-chain, proofs hosted on IPFS via Pinata
- **Claim deadline** — `finalizeDeadline + 90 days`, then admin can sweep unclaimed funds
- **Tiebreaker** — predicted championship total score (MM) or total sixes (IPL), closest wins, ties split evenly
- **Team data** — static config files in `web/src/lib/teams.ts` (MM) and `web/src/lib/ipl.ts` (IPL)
- **Sport-agnostic contracts** — `gameCount` is a parameter; frontend maps `gameCount` to pool type via `web/src/lib/poolTypes.ts` (known brittleness, tracked in `docs/issues.md` #1)
- **IPL scoring** — position accuracy (max 100) + bonuses for champion (+20), runner-up (+10), top-4 (+5 each, max 20) = perfect score 150
- **Scorer importability** — scorer source is copied into `web/src/scorer/` at build time (prebuild/predev scripts); not committed to git. Avoids Turbopack's restriction on importing files outside the project root.
- **Admin access control** — wallet-based only; UI reads `factory.owner()` and gates all admin pages. Before mainnet: transfer ownership to Gnosis Safe 2-of-2.
- **IPFS optional in local dev** — scorer API route skips Pinata and returns a placeholder CID when `PINATA_JWT` is not set, enabling full admin UI smoke testing without an IPFS account.
