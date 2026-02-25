# Handoff — 2026-02-24 — HB

> **Author:** HB | **Date:** 2026-02-24

## Project Status

The branch `feature/route-updates` is fully up to date after a complete March Madness E2E on Sepolia (post results → score → finalize → claim) and implementation of the pool name prefix convention for sport type detection. All three layers are green. The branch has not been pushed or PR'd yet.

| Layer | Status | Tests |
|-------|--------|-------|
| Smart Contracts (Foundry) | Complete | 64 tests pass |
| Off-Chain Scorer (TypeScript) | Complete | 39 tests pass (5 files) |
| Frontend (Next.js + wagmi) | Complete — build clean | 0 errors, 6 routes |

## What Was Done This Session

- **March Madness E2E on Sepolia (completed)** — Full cycle verified end-to-end on Sepolia:
  - Created new MM pool with 2 entries (needed ≥ 2 for `MIN_ENTRIES` contract requirement)
  - Posted game results via file upload (textarea removed — file upload only now)
  - Ran scorer against Alchemy PAYG RPC (fixed fromBlock = rolling 30-day window)
  - Fixed `useFinalize` hook — split into two separate `useWriteContract` instances chained via `useEffect`; the old shared instance silently dropped the `setProofsCID` call
  - Finalized pool on-chain (setMerkleRoot + setProofsCID both confirmed)
  - Verified claim flow — winning wallet successfully claimed prize
  - Pinata IPFS integration confirmed working in Vercel preview environment

- **Bug fixes committed during E2E:**
  - `scorer/src/reader.ts` — changed `fromBlock: 0n` to rolling 30-day window (~216,000 blocks)
  - `scorer/src/pipeline.ts` — added optional `fromBlock?: bigint` param
  - `web/src/components/admin/StepPostResults.tsx` — removed broken textarea, file upload only
  - `web/src/hooks/useAdminPool.ts` — split `useFinalize` into two independent write hooks

- **Pool type detection refactor (5 tasks, all complete):**
  - Replaced `gameCount` magic number mapping with `poolName` prefix convention (`mm:`, `ipl:`, `wc:`)
  - `web/src/lib/poolTypes.ts` — new `getPoolTypeConfig(poolName: string)` + `stripPoolNamePrefix()`, full prefix registry
  - `web/src/lib/poolTypes.test.ts` — 7 tests, all passing via `npm test`
  - `web/src/components/EntrySubmit.tsx` — now takes `poolName` prop instead of deriving type from `gameCount`
  - `web/src/components/CreatePoolForm.tsx` — IPL added to sports dropdown, prefix auto-prepended on submit, label hint shows stored format
  - Display strings — `stripPoolNamePrefix()` applied in all three pages (pool detail, admin list, admin pool)
  - `docs/issues.md` #1 marked resolved

- **Added `npm test` script** to `web/package.json` → `vitest run`

## What's Next

1. **Push and open PR** — `git push origin feature/route-updates`, then open PR → `main`. Branch has not been pushed yet.
2. **March Madness 2025 team data** — update `web/src/lib/teams.ts` when the bracket is announced. Use the `/update-teams` slash command — it fetches from two sources, cross-references, and requires human approval before writing.
3. **Production readiness** — security audit / peer review, mainnet deploy, Gnosis Safe 2-of-2 multisig for admin/treasury, Etherscan contract verification.
4. **Frontend lint issues** (issue #2 in `docs/issues.md`) — 4 warnings remain (unused vars, missing dep array entry). Not blocking but worth cleaning up before mainnet.

## Current Branch State

- **Branch:** `feature/route-updates`
- **Pushed:** No — run `git push origin feature/route-updates` before opening PR
- **Open PR:** None
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
NEXT_PUBLIC_FACTORY_ADDRESS=0x93a9e45C2aF7D6b858F54CFd70cD2a677552Cedd   # Sepolia
PINATA_JWT=<Pinata JWT from app.pinata.cloud>
SCORER_RPC_URL=<Alchemy Sepolia HTTPS URL>                # or http://127.0.0.1:8545 for local
```

### Sepolia Deployment

- **Factory:** `0x93a9e45C2aF7D6b858F54CFd70cD2a677552Cedd` (verified on Sepolia Etherscan)
- **Verified MM Test Pool:** Pool with 2 entries, finalized, claim verified ✓
- **Frontend:** `https://bracket-pool-dapp.vercel.app/`
- **Branch Preview:** Vercel auto-deploys `feature/route-updates` at a preview URL

## Key Architecture Decisions

- **63 games** (Round of 64 through Championship, no First Four), 6 rounds with doubling points (10/20/40/80/160/320)
- **Hash-only storage** — contract stores `keccak256(picks)`, full picks emitted in events
- **5% fee** via `totalPoolValue * 500 / 10000` (Solidity integer division)
- **Merkle tree claims** — scorer generates tree, root posted on-chain, proofs hosted on IPFS via Pinata
- **Claim deadline** — `finalizeDeadline + 90 days`, then admin can sweep unclaimed funds
- **Tiebreaker** — predicted championship total score (MM) or total sixes (IPL), closest wins, ties split evenly
- **Pool name prefix convention** — sport type encoded as prefix in `poolName`: `mm:`, `ipl:`, `wc:`. Frontend parses prefix via `getPoolTypeConfig(poolName)`. Old pools without prefix fall back to `DEFAULT_CONFIG`. No contract changes needed.
- **Team data** — static config files in `web/src/lib/teams.ts` (MM) and `web/src/lib/ipl.ts` (IPL)
- **Sport-agnostic contracts** — `gameCount` is a constructor parameter; pool type now determined by `poolName` prefix (not `gameCount`)
- **IPL scoring** — position accuracy (max 100) + bonuses for champion (+20), runner-up (+10), top-4 (+5 each, max 20) = perfect score 150
- **Scorer importability** — scorer source is copied into `web/src/scorer/` at build time (prebuild/predev scripts); not committed to git. Avoids Turbopack's restriction on importing files outside the project root.
- **Admin access control** — wallet-based only; UI reads `factory.owner()` and gates all admin pages. Before mainnet: transfer ownership to Gnosis Safe 2-of-2.
- **IPFS optional in local dev** — scorer API route skips Pinata and returns a placeholder CID when `PINATA_JWT` is not set, enabling full admin UI smoke testing without an IPFS account.
- **Results input** — file upload only (textarea removed due to clipboard encoding issues with bytes32 arrays). Admin uploads a `.json` file containing a `bytes32[]` array of game results.
