# Handoff — 2026-03-05 — HB

> **Author:** HB | **Date:** 2026-03-05

## Project Status

All 14 tasks of the sport module refactor are complete on `feature/sport-module-refactor`. The branch adds `sportId` + `payoutBps` to the contracts, moves sport logic into `shared/`, adds the World Cup 2026 scorer, wires the pipeline and frontend to read config from chain, and has an open PR (#9) pending review.

| Layer | Status | Tests |
|-------|--------|-------|
| Smart Contracts (Foundry) | `sportId` + `payoutBps` on BracketPool + Factory | 86 tests pass |
| Off-Chain Scorer (TypeScript) | WC2026 scorer added; pipeline sport-aware; `distributePrizes` data-driven | 68 tests pass (7 files) |
| Frontend (Next.js + wagmi) | `usePoolDetails` returns `sportId`/`payoutBps`; `CreatePoolForm` has payout split field | Build clean, 6 routes |

## What Was Done This Session

- **Tasks 7–14** of `docs/plans/2026-03-05-sport-module-refactor.md` completed:

- **Task 7 — web prebuild + teams.ts re-export:** `web/package.json` prebuild/predev now copies `shared/` → `web/shared/` (not `web/src/shared/` — the extra level is required so scorer re-exports resolve correctly). `web/src/lib/teams.ts` stripped of team data; re-exports `Team` (= `MMTeam`) and `ALL_TEAMS` from `../../shared/sports/marchmadness/teams`. `web/shared/` added to `.gitignore`.

- **Task 8 — `readPoolConfig()`:** Added to `scorer/src/reader.ts`; reads `sportId` (string) and `getPayoutBps()` (uint16[]) from chain in a single `Promise.all`.

- **Tasks 9 + 10 — `distributePrizes` + pipeline:** `distributePrizes()` now accepts `payoutBps: number[]` (required third arg). Dust goes to the last paid tier. Pipeline updated to call `readPoolConfig`, look up sport module from `SPORT_MODULES` record, and pass `payoutBps` through. `wc: worldcup2026` registered alongside `mm: marchmadness`.

- **Task 11 — WC 2026 teams:** `shared/sports/worldcup2026/teams.ts` created with all 48 teams across groups A–L. 6 slots are TBD pending UEFA playoffs (Mar 26–31) and intercontinental playoffs (also Mar 2026): TBD-A (Group A), TBD-B (Group B), TBD-D (Group D), TBD-F (Group F), TBD-I (Group I), TBD-K (Group K).

- **Task 12 — WC scoring module + tests:** `shared/sports/worldcup2026/scoring.ts` implements the `bytes32[88]` picks layout (0–47 group stage, 48–55 advancing 3rd-place, 56–71 R32, 72–79 QF, 80–83 SF, 84–85 finalists, 86 winner, 87 3rd place). Perfect score = 1,132. 16 tests added in `scorer/test/wc-scoring.test.ts`.

- **Task 13 — Frontend hooks:** `usePoolDetails` in `usePools.ts` now reads `sportId` and `payoutBps` from chain. `useCreatePool` in `useAdminPool.ts` accepts and passes through `sportId` and `payoutBps`. `CreatePoolForm` maps sport to `sportId` and adds a "Payout Splits (bps)" input field defaulting to `6000,2500,1500` with client-side sum validation.

- **Task 14 — Final verification + PR:** All tests green; PR #9 opened at `https://github.com/hank-butler/bracket-pool-dapp/pull/9`.

- **Interface fix:** `Team.code` made optional (`code?: string`) in `shared/sports/interface.ts` since MM teams don't use a short code.

- **Test fixes:** `ranking.test.ts` updated throughout for new `distributePrizes` signature; dust now goes to last paid tier (not tier 1). WC scoring tests use separate `makeResults`/`makePicks` helpers to avoid ZERO-matches-ZERO false positives.

## What's Next

1. **Update TBD team codes in `shared/sports/worldcup2026/teams.ts`** once playoffs resolve:
   - UEFA playoffs semifinals Mar 26, finals Mar 31 → fills TBD-A (Group A), TBD-B (Group B), TBD-D (Group D), TBD-F (Group F)
   - Intercontinental playoffs Mar 2026 → fills TBD-I (Group I), TBD-K (Group K)
   - Update the `code` and `name` fields; the `id` is derived from `keccak256(toHex(code))` so changing the code changes the ID — must be done before any pool lock time

2. **Merge PR #9** after Clayton reviews

3. **Redeploy Sepolia factory** after merge — `createPool` signature changed (added `sportId` + `payoutBps` args); old factory at `0xac2bAA67cB2De97eab5e5E8cBD35aea2FD03b02e` will no longer work

4. **IPL sport module** — `shared/sports/ipl/` not yet created; frontend and scorer still reference the legacy `web/src/scorer/ipl-scoring.ts`. Low priority until IPL pool is needed.

5. **Frontend WC bracket UI** — `BracketPicker.tsx` is MM-specific (63 games, region/seed layout). WC picks (88 slots, group stage + knockout) will need a new `StandingsPicker`-style component or a WC-specific picker. Not yet started.

6. **Gnosis Safe** — Transfer factory ownership to 2-of-2 multisig before mainnet.

## Current Branch State

- **Branch:** `feature/sport-module-refactor`
- **Pushed:** Yes — fully up to date with `origin/feature/sport-module-refactor`
- **Open PR:** #9 — `https://github.com/hank-butler/bracket-pool-dapp/pull/9`
- **Uncommitted files:** `claude.md` — untracked, not blocking

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
npm run dev   # prebuild copies scorer source into web/src/scorer/ and shared/ into web/shared/
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
NEXT_PUBLIC_FACTORY_ADDRESS=0xac2bAA67cB2De97eab5e5E8cBD35aea2FD03b02e   # Sepolia — NEEDS REDEPLOY after PR #9 merges
PINATA_JWT=<Pinata JWT from app.pinata.cloud>
SCORER_RPC_URL=<Alchemy Sepolia HTTPS URL>                # or http://127.0.0.1:8545 for local
```

### Sepolia Deployment

- **Factory (current):** `0xac2bAA67cB2De97eab5e5E8cBD35aea2FD03b02e` — deployed 2026-03-02, **stale after PR #9 merges**
- **Frontend:** `https://bracket-pool-dapp.vercel.app/`

## Key Architecture Decisions

- **63 games** (Round of 64 through Championship, no First Four), 6 rounds with doubling points (10/20/40/80/160/320)
- **Hash-only storage** — contract stores `keccak256(picks)`, full picks emitted in events
- **5% fee** via `totalPoolValue * 500 / 10000` (Solidity integer division)
- **Merkle tree claims** — scorer generates tree, root posted on-chain, proofs hosted on IPFS via Pinata
- **Claim deadline** — `finalizeDeadline + 90 days`, then admin can sweep unclaimed funds
- **Tiebreaker** — predicted championship total score (MM) or total goals in Final (WC), closest wins, ties split evenly
- **Tiered payouts** — `distributePrizes()` accepts `payoutBps: number[]` from chain. Dust goes to the last paid tier. Supports winner-take-all `[10000]`, top-3 `[6000, 2500, 1500]`, or any custom split.
- **`sportId` on-chain** — `BracketPool.sportId` identifies which scorer module to use. Scorer reads it via `readPoolConfig()`.
- **`payoutBps` on-chain** — `BracketPool.getPayoutBps()` returns `uint16[]` summing to 10000. Enables per-pool payout structures.
- **`shared/` directory** — sport modules (teams + scoring) live at repo root. Copied into `web/shared/` at build time (not `web/src/shared/` — the extra directory level makes scorer re-export paths resolve correctly from `web/src/scorer/`).
- **Pool name prefix convention** — `mm:`, `wc:`, `ipl:` prefix in `poolName` used by frontend for UI routing. `sportId` field used by scorer for module selection.
- **WC picks encoding** — flat `bytes32[88]`: 0–47 group order (4 slots × 12 groups), 48–55 advancing 3rd-place, 56–71 R32, 72–79 QF, 80–83 SF, 84–85 finalists, 86 winner, 87 3rd place. Perfect score = 1,132.
- **WC team IDs** — `keccak256(toHex(code))` where `code` is the FIFA 3-letter code. Changing the code changes the ID — must be finalized before pool lock.
- **Token allowlist** — `BracketPoolFactory` has `mapping(address => bool) public allowedTokens`. Owner calls `addToken`/`removeToken`.
- **`maxEntries`** — Optional entry cap on pools (0 = unlimited).
- **`updateResults()`** — Admin can correct posted results before the Merkle root is set.
- **`via_ir = true`** — Enabled in `foundry.toml` to resolve stack-too-deep compiler error.
- **Admin access control** — wallet-based only; UI reads `factory.owner()`. Before mainnet: transfer ownership to Gnosis Safe 2-of-2.
- **IPFS optional in local dev** — scorer API route skips Pinata and returns placeholder CID when `PINATA_JWT` is not set.
- **Results input** — file upload only (textarea removed). Admin uploads `.json` file with `bytes32[]` array.
