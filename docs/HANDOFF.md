# Handoff — 2026-03-04 — HB

> **Author:** HB | **Date:** 2026-03-04

## Project Status

Tiered payouts (60/25/15) are implemented in the scorer and an open PR is awaiting review. All three layers are green. The next major unlock is deciding the World Cup group stage pick encoding, which unblocks the scorer module and UI work.

| Layer | Status | Tests |
|-------|--------|-------|
| Smart Contracts (Foundry) | Unchanged from last session | 82 tests pass |
| Off-Chain Scorer (TypeScript) | Tiered payouts complete — PR #8 open | 50 tests pass (6 files) |
| Frontend (Next.js + wagmi) | Unchanged from last session | Build clean, 6 routes |

## What Was Done This Session

- **Implemented tiered payouts (60/25/15)** in `scorer/src/ranking.ts` — `distributePrizes()` now splits the prize pool across the top 3 finishers instead of paying rank-1 only. Edge cases: fewer than 3 finishers (remaining tiers go to treasury), dust from integer division assigned to lowest-ranked winner. `tierEntries` sorted by `entryId` to enforce a deterministic dust assignment invariant.
- **Added ranking tests** covering 1-winner, 2-winner, 3-winner, and >3-winner scenarios with split verification. Scorer tests went from 41 → 50.
- **Opened PR #8** — `feature/tiered-payouts` → `main`: https://github.com/hank-butler/bracket-pool-dapp/pull/8
- **Clayton's review feedback on PR #8:** "Update handoff doc and do not merge planning docs" — addressed by updating this handoff. The untracked planning docs (`docs/plans/2026-02-19-admin-ui-design.md`, `docs/plans/2026-02-19-admin-ui-implementation.md`, `docs/handoff-hb-2026-02-11.md`, `docs/screenshots/`) are not committed and will not be included in the PR.

## What's Next

World Cup launch blockers remaining (priority order):

1. **Merge PR #8** — tests green, handoff updated. Ready to merge once Clayton approves.

2. **World Cup scorer module** — New `wc-scoring.ts` with round-weighted points. Blocked on open design question: how to encode group stage picks as `bytes32[]`. Each group has 6 teams; users predict which 2 (+ 3rd-place wildcard for R16) advance. Decide the pick format first — then scorer + UI can proceed. ~4–6 hrs after format is decided.

3. **March Madness 2026 team data** — Run `/update-teams` after Selection Sunday (~March 15–16). Updates `web/src/lib/teams.ts`. Can't be done until the field is announced. ~1 hr.

4. **World Cup bracket picker UI** — Largest remaining item. Two distinct UIs: group stage (table/ranking per group) and knockout stage (16-team elimination bracket). Must start by mid-March to leave buffer before June 11 kickoff. ~2–3 weeks.

5. **Live leaderboard** — Partial scoring mode in scorer + leaderboard API route + polling UI on pool detail page. ~1 week. Important for a 5-week tournament where users disengage without standings.

6. **Three entry tiers (Minnow/Shark/Whale)** — Zero code. Three `createPool` calls at deploy time with different `basePrice` values ($100/$1K/$10K USDC). Do on launch day.

7. **L2 deployment (Base)** — Contracts are fully compatible; it's a deployment target change only. Update deploy scripts + Vercel env vars when ready.

**Minor follow-up:** "Base Price (USDC)" label in `CreatePoolForm` is hardcoded — should become token-agnostic in a cleanup pass once multi-token pools are in use.

**Open question before starting World Cup scorer:** Define the pick encoding for the group stage. Each group has 6 teams; users predict which 2 (+ 3rd-place wildcard for R16) advance. This needs a `bytes32[]` encoding that the scorer can verify against posted results.

## Current Branch State

- **Branch:** `feature/tiered-payouts`
- **PR #8:** Open — https://github.com/hank-butler/bracket-pool-dapp/pull/8
- **Pushed:** Yes — fully up to date with `origin/feature/tiered-payouts`
- **Uncommitted files:** `claude.md`, `docs/handoff-hb-2026-02-11.md`, `docs/plans/2026-02-19-admin-ui-design.md`, `docs/plans/2026-02-19-admin-ui-implementation.md`, `docs/screenshots/` — all untracked, not part of this PR

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
TOKEN_ADDRESS=<mockUSDC> FACTORY_ADDRESS=<factory> ~/.foundry/bin/forge script script/CreateSmokeTestPool.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

### MetaMask Configuration

- **Local (Anvil):** Network RPC `http://127.0.0.1:8545`, Chain ID `31337`; import Anvil account #0 key `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- **Admin UI locally:** The Payment Token dropdown defaults to Sepolia USDC — switch to "Custom address..." and paste in the MockUSDC address from the deploy output
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
NEXT_PUBLIC_FACTORY_ADDRESS=0xac2bAA67cB2De97eab5e5E8cBD35aea2FD03b02e   # Sepolia — deployed 2026-03-02
PINATA_JWT=<Pinata JWT from app.pinata.cloud>
SCORER_RPC_URL=<Alchemy Sepolia HTTPS URL>                # or http://127.0.0.1:8545 for local
```

### Sepolia Deployment

- **Factory (current):** `0xac2bAA67cB2De97eab5e5E8cBD35aea2FD03b02e` — deployed 2026-03-02, verified on Etherscan
- **Frontend:** `https://bracket-pool-dapp.vercel.app/`
- **No pools exist yet on the new factory** — go to `/admin` on the live site, connect the deployer wallet (Sepolia), and create one. Sepolia USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`) is already on the allowlist from the deploy.

## Key Architecture Decisions

- **63 games** (Round of 64 through Championship, no First Four), 6 rounds with doubling points (10/20/40/80/160/320)
- **Hash-only storage** — contract stores `keccak256(picks)`, full picks emitted in events
- **5% fee** via `totalPoolValue * 500 / 10000` (Solidity integer division)
- **Merkle tree claims** — scorer generates tree, root posted on-chain, proofs hosted on IPFS via Pinata
- **Claim deadline** — `finalizeDeadline + 90 days`, then admin can sweep unclaimed funds
- **Tiebreaker** — predicted championship total score (MM) or total sixes (IPL), closest wins, ties split evenly
- **Tiered payouts** — `distributePrizes()` splits prize pool 60/25/15 across top 3. Fewer than 3 finishers: unused tiers go to treasury. Dust from integer division goes to lowest-ranked winner. `tierEntries` sorted by `entryId` for deterministic dust assignment.
- **Pool name prefix convention** — sport type encoded as prefix in `poolName`: `mm:`, `ipl:`, `wc:`. Frontend parses prefix via `getPoolTypeConfig(poolName)`. Old pools without prefix fall back to `DEFAULT_CONFIG`. No contract changes needed.
- **Team data** — static config files in `web/src/lib/teams.ts` (MM) and `web/src/lib/ipl.ts` (IPL)
- **Sport-agnostic contracts** — `gameCount` is a constructor parameter; pool type determined by `poolName` prefix (not `gameCount`)
- **IPL scoring** — position accuracy (max 100) + bonuses for champion (+20), runner-up (+10), top-4 (+5 each, max 20) = perfect score 150
- **Scorer importability** — scorer source is copied into `web/src/scorer/` at build time (prebuild/predev scripts); not committed to git. Avoids Turbopack's restriction on importing files outside the project root.
- **Admin access control** — wallet-based only; UI reads `factory.owner()` and gates all admin pages. Before mainnet: transfer ownership to Gnosis Safe 2-of-2.
- **IPFS optional in local dev** — scorer API route skips Pinata and returns a placeholder CID when `PINATA_JWT` is not set, enabling full admin UI smoke testing without an IPFS account.
- **Results input** — file upload only (textarea removed due to clipboard encoding issues with bytes32 arrays). Admin uploads a `.json` file containing a `bytes32[]` array of game results.
- **`token` not `usdc`** — The ERC20 payment token field is named `token` in both contracts. Allows any ERC20, not just USDC. Frontend and ABIs updated to match.
- **Token allowlist** — `BracketPoolFactory` has `mapping(address => bool) public allowedTokens`. Owner calls `addToken`/`removeToken`. Constructor seeded with `address[] memory initialTokens`. `createPool` requires token to be on allowlist. Removing a token does not affect existing pools.
- **`maxEntries`** — Optional entry cap on pools (0 = unlimited). Cheap insurance against viral traffic overwhelming the scorer.
- **`updateResults()`** — Admin can correct posted results before the Merkle root is set. Eliminates the only path to a forced pool cancellation from a bad `setResults()` call.
- **`via_ir = true`** — Enabled in `foundry.toml` to resolve stack-too-deep compiler error from `BracketPool` constructor parameter count. No functional impact.
