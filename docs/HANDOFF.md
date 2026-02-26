# Handoff — 2026-02-25 — HB

> **Author:** HB | **Date:** 2026-02-25

## Project Status

The admin UI branch (`feature/route-updates`) was merged to `main` via PR #4 today. A new branch (`feature/contract-updates`) was cut and three World Cup launch-blocker contract changes were implemented and pushed. All three layers are green.

| Layer | Status | Tests |
|-------|--------|-------|
| Smart Contracts (Foundry) | Complete — 3 new features | 73 tests pass |
| Off-Chain Scorer (TypeScript) | Unchanged | 41 tests pass (6 files) |
| Frontend (Next.js + wagmi) | Updated for new contract interface | Build clean, 6 routes |

## What Was Done This Session

- **Merged PR #4** (`feature/route-updates` → `main`) — full admin UI + pool type detection refactor. Updated PR description before merging to cover all work including the pool type detection refactor added after the PR was originally opened. Branch deleted after merge.

- **Cut `feature/contract-updates`** — new branch for World Cup launch-blocker contract changes.

- **`updateResults()` — `fe525c3`**
  - New function in `BracketPool.sol` allowing admin to correct results after `setResults()` but before `setMerkleRoot()` is called
  - Guards: admin only, results must exist, not yet finalized, correct length
  - New `ResultsUpdated` event emitted
  - 6 new contract tests

- **`usdc` → `token` rename — `aa09080`**
  - `BracketPool.sol` + `BracketPoolFactory.sol`: immutable renamed, constructor param renamed, all internal calls updated
  - `BracketPool.t.sol` + `BracketPoolFactory.t.sol`: existing tests updated
  - `web/src/lib/abis/BracketPool.json` + `BracketPoolFactory.json`: regenerated from compiled output (includes `updateResults` and `ResultsUpdated` event)
  - `web/src/hooks/usePools.ts`: `functionName: 'usdc'` → `functionName: 'token'`
  - Deploy scripts updated (`DeployLocal.s.sol`, `CreateSmokeTestPool.s.sol`); also added `mm:` prefix to pool names in both scripts

- **`maxEntries` cap — `2b048ed`**
  - New `uint256 public immutable maxEntries` added to `BracketPool.sol` (0 = unlimited)
  - `require(maxEntries == 0 || entryCount < maxEntries, "Pool is full")` in `enter()`
  - Passed through `BracketPoolFactory.sol` `createPool()` as new final param
  - `foundry.toml`: added `via_ir = true` to resolve stack-too-deep compiler error from constructor parameter count
  - All constructor call sites updated in tests and deploy scripts
  - `useCreatePool` hook and `CreatePoolForm.tsx` updated with `maxEntries` field (defaults to 0)
  - 3 new contract tests

- **Branch pushed** to `origin/feature/contract-updates` — no PR opened yet.

## What's Next

World Cup launch blockers remaining (from `docs/future-ideas.md` §9):

1. **L2 deployment (Base)** — Decision + deployment config. Contracts are fully compatible; it's a deployment target change only. No code changes needed. Decide network and update deploy scripts + Vercel env vars. Do this before further testnet work to avoid redoing it on L1.

2. **Tiered payouts (60/25/15)** — Scorer-only change in `scorer/src/ranking.ts`. `distributePrizes()` currently pays rank-1 only; needs to pay top 3 with a configurable split. ~2–3 hrs including edge cases and tests. No contract changes needed.

3. **World Cup scorer module** — New `wc-scoring.ts` with round-weighted points and a World Cup game structure file (48 teams, group stage + knockout). The key design question first: how to encode group stage picks as `bytes32[]`. Users predict which teams advance from each group, not individual match scores. ~4–6 hrs once the pick format is agreed on.

4. **World Cup bracket picker UI** — The largest remaining item. Two distinct UIs needed: group stage (table/ranking per group, predict who advances) and knockout stage (16-team elimination bracket, similar to existing `BracketPicker.tsx`). Estimated 2–3 weeks. Must start by mid-March to leave buffer before June 11 kickoff.

5. **Live leaderboard** — Partial scoring mode in the scorer + leaderboard API route + polling UI on pool detail page. ~1 week. Important for a 5-week tournament where users will disengage without standings.

6. **Three entry tiers (Minnow/Shark/Whale)** — Zero code. Three `createPool` calls at deploy time with different `basePrice` values ($100/$1K/$10K USDC). Do on launch day.

7. **March Madness 2025 team data** — Run `/update-teams` once the bracket is announced (Selection Sunday, mid-March). Updates `web/src/lib/teams.ts`.

**Open question before starting World Cup scorer:** Define the pick encoding for the group stage. Each group has 6 teams; users predict which 2 (+ 3rd-place wildcard for R16) advance. This needs a `bytes32[]` encoding that the scorer can verify against posted results.

## Current Branch State

- **Branch:** `feature/contract-updates`
- **Pushed:** Yes — `origin/feature/contract-updates`
- **Open PR:** None — not opened yet
- **Uncommitted files:** `claude.md`, `docs/handoff-hb-2026-02-11.md`, `docs/plans/2026-02-19-admin-ui-design.md`, `docs/plans/2026-02-19-admin-ui-implementation.md`, `docs/screenshots/` — all untracked, not blocking

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
npm run dev   # prebuild copies scorer source into web/src/scorer/
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
NEXT_PUBLIC_FACTORY_ADDRESS=0x93a9e45C2aF7D6b858F54CFd70cD2a677552Cedd   # Sepolia (stale — redeploy needed after contract changes)
PINATA_JWT=<Pinata JWT from app.pinata.cloud>
SCORER_RPC_URL=<Alchemy Sepolia HTTPS URL>                # or http://127.0.0.1:8545 for local
```

### Sepolia Deployment

- **Factory (stale):** `0x93a9e45C2aF7D6b858F54CFd70cD2a677552Cedd` — needs redeploy after `feature/contract-updates` is merged (contract ABI changed)
- **Frontend:** `https://bracket-pool-dapp.vercel.app/`

## Key Architecture Decisions

- **63 games** (Round of 64 through Championship, no First Four), 6 rounds with doubling points (10/20/40/80/160/320)
- **Hash-only storage** — contract stores `keccak256(picks)`, full picks emitted in events
- **5% fee** via `totalPoolValue * 500 / 10000` (Solidity integer division)
- **Merkle tree claims** — scorer generates tree, root posted on-chain, proofs hosted on IPFS via Pinata
- **Claim deadline** — `finalizeDeadline + 90 days`, then admin can sweep unclaimed funds
- **Tiebreaker** — predicted championship total score (MM) or total sixes (IPL), closest wins, ties split evenly
- **Pool name prefix convention** — sport type encoded as prefix in `poolName`: `mm:`, `ipl:`, `wc:`. Frontend parses prefix via `getPoolTypeConfig(poolName)`. Old pools without prefix fall back to `DEFAULT_CONFIG`. No contract changes needed.
- **Team data** — static config files in `web/src/lib/teams.ts` (MM) and `web/src/lib/ipl.ts` (IPL)
- **Sport-agnostic contracts** — `gameCount` is a constructor parameter; pool type determined by `poolName` prefix (not `gameCount`)
- **IPL scoring** — position accuracy (max 100) + bonuses for champion (+20), runner-up (+10), top-4 (+5 each, max 20) = perfect score 150
- **Scorer importability** — scorer source is copied into `web/src/scorer/` at build time (prebuild/predev scripts); not committed to git. Avoids Turbopack's restriction on importing files outside the project root.
- **Admin access control** — wallet-based only; UI reads `factory.owner()` and gates all admin pages. Before mainnet: transfer ownership to Gnosis Safe 2-of-2.
- **IPFS optional in local dev** — scorer API route skips Pinata and returns a placeholder CID when `PINATA_JWT` is not set, enabling full admin UI smoke testing without an IPFS account.
- **Results input** — file upload only (textarea removed due to clipboard encoding issues with bytes32 arrays). Admin uploads a `.json` file containing a `bytes32[]` array of game results.
- **`token` not `usdc`** — The ERC20 payment token field is named `token` in both contracts (renamed this session). Allows any ERC20, not just USDC. Frontend and ABIs updated to match.
- **`maxEntries`** — Optional entry cap on pools (0 = unlimited). Added this session. Cheap insurance against viral traffic overwhelming the scorer.
- **`updateResults()`** — Admin can correct posted results before the Merkle root is set. Added this session. Eliminates the only path to a forced pool cancellation from a bad `setResults()` call.
- **`via_ir = true`** — Enabled in `foundry.toml` to resolve stack-too-deep compiler error from `BracketPool` constructor parameter count. No functional impact.
- **Sepolia factory needs redeploy** — The deployed factory at `0x93a9e45C2aF7D6b858F54CFd70cD2a677552Cedd` uses the old contract ABI. Redeploy required after `feature/contract-updates` is merged.
