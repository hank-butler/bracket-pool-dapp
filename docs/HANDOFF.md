# Handoff — 2026-02-20 — CL

> **Author:** CL | **Date:** 2026-02-20

## Project Status

The MVP is deployed to Sepolia with a live frontend on Vercel. This session added IPL cricket standings prediction support as a second pool type alongside March Madness brackets, including a new scoring engine and drag-and-drop UI component. An issues tracker was created to document known technical debt.
# Handoff — 2026-02-19 — HB

> **Author:** HB | **Date:** 2026-02-19

## Project Status

The admin UI is fully built and passing build checks on `feature/route-updates`. It covers the complete pool lifecycle — create pool, post results, run scorer, pin to IPFS, and finalize on-chain — but has not yet been smoke tested end-to-end against a live Anvil instance. That is the next session's first task.

| Layer | Status | Tests |
|-------|--------|-------|
| Smart Contracts (Foundry) | Complete | 64 tests pass |
| Off-Chain Scorer (TypeScript) | Complete — IPL scoring added | 37 tests pass (16 new IPL tests) |
| Frontend (Next.js + wagmi) | Complete — StandingsPicker added | Build succeeds, 6 pre-existing lint errors |

## What Was Done This Session

- **Reviewed IPL cricket branch** (`claude/general-session-A21Dy`) — two commits adding standings prediction support:
  - `ef677bc` — Base IPL standings prediction (10 teams, StandingsPicker component, team data, pool type config)
  - `5f4a073` — Weighted scoring engine (position accuracy + champion/runner-up/top-4 bonuses, perfect score = 150)
- **Ran full test suite** — contracts (64 pass), scorer (37 pass), frontend build (success)
- **Identified pool type detection issue** — frontend infers pool type from `gameCount` magic numbers (63 = MM, 10 = IPL), which is brittle for multi-sport support. Evaluated three solutions (contract field, name prefix convention, frontend config). Logged as medium priority in `docs/issues.md`.
- **Identified pre-existing lint errors** — 6 errors and 4 warnings across `pool/[address]/page.tsx`, `ClaimPrize.tsx`, `useClaim.ts`, `useEnterPool.ts`. Logged as high priority in `docs/issues.md`.
- **Created `docs/issues.md`** — new issue tracker for identified technical debt
- **Created PR #6** — https://github.com/hank-butler/bracket-pool-dapp/pull/6 to merge `claude/general-session-A21Dy` into `main`

## What's Next

1. **Merge PR #6** — IPL standings support into `main`
2. **Fix pre-existing lint errors** (high priority) — conditional hooks in pool page, impure render in ClaimPrize, setState in useClaim effect, variable ordering in useEnterPool (see `docs/issues.md` #2)
3. **Complete Sepolia E2E cycle** — run scorer against test pool after lock time, post Merkle root, claim prize via browser
4. **Resolve pool type detection** (medium priority) — before adding more game types, replace `gameCount` magic number mapping with a robust approach (see `docs/issues.md` #1)
5. **Production readiness** — security audit/peer review, mainnet deploy, Gnosis Safe multisig for admin/treasury, verify contracts on mainnet Etherscan
6. **World Cup 2026 pivot** — Phase B (`sportId` in contracts), Phase C (shared sports config), Phase D (World Cup bracket picker UI)

## Current Branch State

- **Branch:** `claude/general-session-A21Dy`
- **Pushed:** Yes, up to date with remote
- **Open PR:** #6 — https://github.com/hank-butler/bracket-pool-dapp/pull/6 (into `main`)
- **Uncommitted:** Only `scorer/output-0xcafac3dd.json` (untracked, not relevant)
| Off-Chain Scorer (TypeScript) | Complete | 23 tests pass (4 test files) |
| Frontend (Next.js + wagmi) | Admin UI built, pending smoke test | Build clean, 6 routes |

## What Was Done This Session

- **Designed admin UI** — created `docs/plans/2026-02-19-admin-ui-design.md` and `docs/plans/2026-02-19-admin-ui-implementation.md`
- **Refactored scorer** — extracted pipeline logic from `index.ts` into `scorer/src/pipeline.ts` as a callable module; `index.ts` is now a thin CLI wrapper (commit `af7016d`)
- **Added `pipeline.test.ts`** — 2 new scorer tests covering Merkle root generation and prize award logic
- **Added Pinata IPFS utility** — `web/src/lib/pinata.ts` using Pinata SDK v2 (`pinata.upload.public.json()`) (commit `c56d066`)
- **Added scorer API route** — `POST /api/admin/score` runs scorer server-side and pins proofs JSON to IPFS (commit `021b3f7`)
- **Solved Turbopack import issue** — scorer source is copied into `web/src/scorer/` at build time via `prebuild`/`predev` scripts; `@openzeppelin/merkle-tree` installed in web; tsconfig target bumped to ES2020
- **Built all admin hooks** — `useAdminAccess`, `useCreatePool`, `useSetResults`, `useFinalize`, `useCancelPool`, `useSweepUnclaimed`
- **Built admin dashboard** — `/admin` page with pool list and Create Pool form, owner-wallet gated
- **Built per-pool wizard** — `/admin/pool/[address]` with lifecycle steps: StepOpen, StepPostResults, StepReviewFinalize, StepFinalized (commit `c948c3a`)

## What's Next

1. **Smoke test the admin UI** (tomorrow) — start Anvil, deploy locally, walk through the full admin flow:
   - Go to `/admin`, create a pool with lock time ~2 min away
   - Submit a test entry from `/pool/[address]`
   - Warp time past lock: `cast rpc anvil_setNextBlockTimestamp <timestamp> --rpc-url http://localhost:8545`
   - Post results (paste a valid `bytes32[]` JSON array), run scorer, finalize
   - Verify `/pool/[address]` shows Finalized and claim UI appears
2. **Add `PINATA_JWT` and `SCORER_RPC_URL` to `web/.env.local`** before smoke test — get JWT from app.pinata.cloud
3. **Open PR** — `feature/route-updates` → `main` once smoke test passes
4. **Vercel env vars** — add `PINATA_JWT` and `SCORER_RPC_URL` to Vercel dashboard before deploying
5. **Complete the Sepolia E2E cycle** — existing test pool at `0x5eBca3ae0c84F597C922f3B0A8B2631b8049BCc3`; run scorer, post Merkle root, claim prize
6. **Production readiness** — security audit/peer review, mainnet deploy, Gnosis Safe multisig for admin/treasury

## Current Branch State

- **Branch:** `feature/route-updates`
- **Pushed:** No — all commits are local only
- **Open PR:** None
- **Uncommitted:** Only untracked files (`claude.md`, `docs/handoff-hb-2026-02-11.md`, `docs/plans/`, `docs/screenshots/`) — none blocking

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
npm run dev   # also runs prebuild (copies scorer source into web/src/scorer/)
# Open http://localhost:3000
```

### MetaMask Configuration

- **Local (Anvil):** Network RPC `http://127.0.0.1:8545`, Chain ID `31337`; import Anvil account #0 key `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- **Sepolia:** Use the dedicated deployer wallet (not the Anvil key); get test USDC from faucet.circle.com
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
PINATA_JWT=<Pinata JWT from app.pinata.cloud>      # needed for scorer API route
SCORER_RPC_URL=https://rpc.sepolia.org              # or http://127.0.0.1:8545 for local
```

### Sepolia Deployment

- **Factory:** `0x93a9e45C2aF7D6b858F54CFd70cD2a677552Cedd` (verified on Sepolia Etherscan)
- **Test Pool:** `0x5eBca3ae0c84F597C922f3B0A8B2631b8049BCc3`
- **Frontend:** `https://bracket-pool-dapp.vercel.app/`
- **USDC:** Circle Sepolia USDC at `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- Deploy command: `source .env && forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify` (from `contracts/`)

## Key Architecture Decisions

- **63 games** (Round of 64 through Championship, no First Four), 6 rounds with doubling points (10/20/40/80/160/320)
- **First Four handling** — play-in winners are resolved on the frontend before lock time, not picked by users. Lock time set to Thursday (R64 start)
- **Hash-only storage** — contract stores `keccak256(picks)`, full picks emitted in events
- **5% fee** via `totalPoolValue * 500 / 10000` (Solidity integer division)
- **Merkle tree claims** — scorer generates tree, root posted on-chain, proofs hosted on IPFS via Pinata
- **Claim deadline** — `finalizeDeadline + 90 days`, then admin can sweep unclaimed funds
- **Tiebreaker** — predicted championship total score (MM) or total sixes (IPL), closest wins, ties split evenly
- **Team data** — static config files in `web/src/lib/teams.ts` (MM) and `web/src/lib/ipl.ts` (IPL), updated via `/update-teams` slash command on Selection Sunday
- **Sport-agnostic contracts** — `gameCount` is a parameter; frontend maps `gameCount` to pool type via `web/src/lib/poolTypes.ts` (known brittleness, tracked in `docs/issues.md` #1)
- **IPL scoring** — position accuracy (max 100) + bonuses for champion (+20), runner-up (+10), top-4 (+5 each, max 20) = perfect score 150
- **Tiebreaker** — predicted championship total score, closest wins, ties split evenly
- **Team data** — static config file in `web/src/lib/teams.ts`, updated via `/update-teams` slash command on Selection Sunday
- **Sport-agnostic contracts** — `gameCount` is a parameter, World Cup will use `gameCount=88` with a future `sportId` field
- **Scorer importability** — scorer source is copied into `web/src/scorer/` at build time (prebuild/predev scripts); not committed to git (in `.gitignore`). This avoids Turbopack's restriction on importing files outside the project root.
- **Admin access control** — wallet-based only; UI reads `factory.owner()` and gates all admin pages. No separate auth layer needed — contract is source of truth. Before mainnet: transfer ownership to Gnosis Safe 2-of-2.
