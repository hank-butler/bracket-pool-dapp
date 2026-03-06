# Handoff — 2026-03-05 — HB

> **Author:** HB | **Date:** 2026-03-05

## Project Status

Mid-implementation on `feature/sport-module-refactor`. Tasks 1–6 of 14 complete. The branch adds `sportId` + `payoutBps` to the contracts, creates the `shared/` sport module directory, and moves MM scoring there. Next up is wiring the web prebuild to copy `shared/` and updating the scorer pipeline to be sport-aware.

| Layer | Status | Tests |
|-------|--------|-------|
| Smart Contracts (Foundry) | `sportId` + `payoutBps` added to BracketPool + Factory | 86 tests pass |
| Off-Chain Scorer (TypeScript) | MM scoring moved to `shared/`, re-export shim in place | 50 tests pass (6 files) |
| Frontend (Next.js + wagmi) | Unchanged — ABIs regenerated | Build clean, 6 routes |

## What Was Done This Session

- **Brainstormed + designed** sport module refactor architecture: `sportId` + `payoutBps` on-chain, `shared/sports/` directory, sport modules imported by scorer and frontend via prebuild copy. Full design in `docs/plans/2026-03-05-sport-module-refactor-design.md`.

- **Wrote implementation plan** — 14 tasks in `docs/plans/2026-03-05-sport-module-refactor.md`.

- **Created `feature/sport-module-refactor` branch** off `main`.

- **Task 2 — BracketPool contract:** Added `string public sportId`, `uint16[] private _payoutBps`, `getPayoutBps()` view, `_sumBps()` helper, constructor validation (`Payouts must sum to 10000`). 3 new tests. All `new BracketPool(` calls updated.

- **Task 3 — BracketPoolFactory contract:** `createPool()` now accepts `_sportId` + `__payoutBps` and passes through. 1 new test. All `factory.createPool(` calls updated.

- **Task 4 — Deploy scripts + ABIs:** `DeployLocal.s.sol` and `CreateSmokeTestPool.s.sol` updated. `BracketPool.json` and `BracketPoolFactory.json` ABIs regenerated.

- **Task 5 — `shared/sports/interface.ts`:** `Team` and `SportModule` interfaces created. `shared/tsconfig.json` added.

- **Task 6 — MM sport module:** `shared/sports/marchmadness/teams.ts` (64 teams) and `shared/sports/marchmadness/scoring.ts` created. `scorer/src/scoring.ts` replaced with re-export shim for backwards compatibility.

- **`.gitignore` updated** — `docs/**` ignored except `HANDOFF.md`. All previously-tracked planning docs removed from index (still exist locally).

## What's Next

Continue executing `docs/plans/2026-03-05-sport-module-refactor.md` starting at **Task 7**:

7. **Task 7 — Update web prebuild + teams.ts re-export**
   - Extend `web/package.json` prebuild/predev scripts to also copy `shared/` → `web/src/shared/`
   - Add `web/src/shared/` to `.gitignore`
   - Update `web/src/lib/teams.ts` to re-export `MMTeam` and `ALL_TEAMS` from `../shared/sports/marchmadness/teams`
   - Keep all frontend-specific types/functions (`Game`, `BracketState`, `buildGames`, etc.) in `teams.ts` directly
   - Verify `npm run build` in `web/` passes

8. **Task 8 — `readPoolConfig()` in reader.ts** — reads `sportId` + `payoutBps` from chain

9. **Task 9 — `distributePrizes()` accepts `payoutBps` param** — replace hardcoded 60/25/15

10. **Task 10 — Pipeline sport-aware** — reads config from chain, routes to sport module

11. **Task 11 — WC 2026 teams** — look up FIFA draw results, create `shared/sports/worldcup2026/teams.ts`

12. **Task 12 — WC scoring module + tests** — `shared/sports/worldcup2026/scoring.ts`, register in pipeline

13. **Task 13 — Frontend hooks** — add `sportId` + `payoutBps` to pool reads, update `CreatePoolForm`

14. **Task 14 — Final verification + PR**

## Current Branch State

- **Branch:** `feature/sport-module-refactor`
- **Pushed:** Yes — fully up to date with `origin/feature/sport-module-refactor`
- **Open PRs:** None yet — PR created at end of Task 14
- **Uncommitted files:** `claude.md`, `docs/handoff-hb-2026-02-11.md`, `docs/plans/2026-02-19-admin-ui-*.md`, `docs/screenshots/` — all untracked, not blocking

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
- **NOTE:** Factory needs to be redeployed after this branch merges (`createPool` signature changed)
- **Frontend:** `https://bracket-pool-dapp.vercel.app/`

## Key Architecture Decisions

- **63 games** (Round of 64 through Championship, no First Four), 6 rounds with doubling points (10/20/40/80/160/320)
- **Hash-only storage** — contract stores `keccak256(picks)`, full picks emitted in events
- **5% fee** via `totalPoolValue * 500 / 10000` (Solidity integer division)
- **Merkle tree claims** — scorer generates tree, root posted on-chain, proofs hosted on IPFS via Pinata
- **Claim deadline** — `finalizeDeadline + 90 days`, then admin can sweep unclaimed funds
- **Tiebreaker** — predicted championship total score (MM) or total goals in Final (WC), closest wins, ties split evenly
- **Tiered payouts** — `distributePrizes()` will accept `payoutBps` from chain (Task 9). Currently still hardcoded 60/25/15 — pipeline not yet wired.
- **`sportId` on-chain** — `BracketPool.sportId` identifies which scorer module to use. Scorer reads it via `readPoolConfig()` (Task 8).
- **`payoutBps` on-chain** — `BracketPool.getPayoutBps()` returns `uint16[]` summing to 10000. Enables per-pool payout structures (winner-take-all, top-3, etc.).
- **`shared/` directory** — sport modules (teams + scoring) live at repo root, copied into `web/src/shared/` at build time. Pattern mirrors existing scorer→web prebuild copy.
- **Pool name prefix convention** — `mm:`, `wc:`, `ipl:` prefix in `poolName` used by frontend for UI routing. `sportId` field used by scorer for module selection.
- **Token allowlist** — `BracketPoolFactory` has `mapping(address => bool) public allowedTokens`. Owner calls `addToken`/`removeToken`.
- **`maxEntries`** — Optional entry cap on pools (0 = unlimited).
- **`updateResults()`** — Admin can correct posted results before the Merkle root is set.
- **`via_ir = true`** — Enabled in `foundry.toml` to resolve stack-too-deep compiler error.
- **Admin access control** — wallet-based only; UI reads `factory.owner()`. Before mainnet: transfer ownership to Gnosis Safe 2-of-2.
- **IPFS optional in local dev** — scorer API route skips Pinata and returns placeholder CID when `PINATA_JWT` is not set.
- **Results input** — file upload only (textarea removed). Admin uploads `.json` file with `bytes32[]` array.
