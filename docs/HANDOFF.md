# Handoff — 2026-10-21 — HB

> **Author:** HB | **Date:** 2026-10-21

## Project Status

First session since June. A full status review was run against the original MVP plan and all findings were fixed on `fix/status-review-bugs` (PR pending): two fund-safety bugs in the contract's finalize/claim path, a prize-distribution bug that could pay a lower-ranked entry more than tied winners, a chain-reader bug that could silently drop entries, a USDC approval race on the bonding curve, and several smaller frontend defects. Both original launch targets (March Madness 2026, World Cup 2026) have passed without a live pool — the next session should be a scope/goals reset with the realistic target being **March Madness 2027**.

| Layer | Status | Tests |
|-------|--------|-------|
| Smart Contracts (Foundry) | Finalize deadline guard + pool-bound Merkle leaves added | 89 tests pass |
| Off-Chain Scorer (TypeScript) | Tie-aware prize distribution; chunked entry scan with on-chain count cross-check | 79 tests pass (7 files) |
| Frontend (Next.js + wagmi) | sportId-based picker routing; buffered approvals; IPFS gateway fallbacks | Build clean, lint clean, 13 tests pass |

## What Was Done This Session

Status review (4 parallel code reviews + plan-vs-scope gap analysis), then fixes for every confirmed bug, all TDD:

- **Contract — `setMerkleRoot` deadline guard** (`BracketPool.sol`): finalization now reverts once `finalizeDeadline` passes. Previously the refund path and the finalize path could both be live at once (refunds drain the pool, then a stale Merkle tree over-promises prizes), and a root set after `claimDeadline` would have made every claim revert while `sweepUnclaimed` sent the entire balance to treasury.
- **Contract — pool-bound Merkle leaves**: claim leaf is now `keccak256(keccak256(abi.encode(address(this), owner, entryId, amount)))` — a proof can never verify on a different pool, even if an admin reuses a root. Scorer's `buildMerkleTree(poolAddress, winners)` updated to match, with a test asserting byte-exact agreement with the contract encoding. **This changes the leaf format — any previously generated proofs JSON is incompatible (fine, since the factory needs redeploying anyway).**
- **Scorer — tie-aware `distributePrizes`** (`scorer/src/ranking.ts`): tied entries now split the combined payouts of the finishing positions they occupy (two tied for 1st with 60/25/15 split 85% between them; the next entry gets 15%). Previously ties compressed the tier list and the *last* tier absorbed the folded money — a 3rd-place finisher could be paid more than the tied winners, and a test was asserting that wrong behavior.
- **Scorer — entry scan rewrite** (`scorer/src/reader.ts`): replaces the single 30-day-window `getLogs` (which silently dropped older entries and exceeded RPC range caps) with a backward chunked scan (10k blocks/request) that stops when the on-chain `entryCount` is matched and **throws** if any entry is unaccounted for. Dedupes by `entryId`. New `collectEntries()` is dependency-injected and unit-tested (6 tests).
- **Scorer/shared — WC advancing 3rds scored as a set** (`shared/sports/worldcup2026/scoring.ts`): slots 48–55 now score by set membership (duplicates collapse), so a correct set of 8 advancing third-place teams earns full points regardless of the order the picker stored them in. Previously positional comparison could score a fully-correct set as 0.
- **Web — picker routing by on-chain `sportId`** (`poolTypes.ts`, `EntrySubmit.tsx`): the picker is chosen from the same field the scorer routes on, so they can never disagree. Unknown sport → explicit "Unsupported pool" panel instead of silently rendering the March Madness picker. poolName prefix remains as legacy fallback only.
- **Web — approval race fixed** (`useEnterPool.ts`): price and allowance are re-read at submit time and approval includes a 10% buffer, so an entry no longer reverts when someone else enters between page load and submission (bonding curve raises the price on every entry).
- **Web — StandingsPicker drag-and-drop fixed**: dropping a team from "Available Teams" onto a slot now works (the drop handler never read `dataTransfer`; the placement branch was dead code). Firefox drag-start quirk also covered.
- **Web — smaller fixes**: IPFS proof fetch now tries 3 gateways with a 10s timeout each (`useClaim.ts`); WC knockout hint now keyed to actual advancing-3rd count; WC tiebreaker field can be cleared; lint error (`module` variable) fixed in `scorer/src/pipeline.ts`; scorer vitest no longer runs stale compiled tests from `dist/`.
- **Docs**: original MVP plan moved from untracked `claude.md` to `docs/plans/original-mvp-plan.md`; `docs/issues.md` updated (both tracked issues resolved).

## What's Next

1. **Scope/goals reset (HB + CL)** — both 2026 launch windows were missed; the WC 2026 code is now a template for a future tournament rather than a launch vehicle. Decide: target March Madness 2027? Revive IPL? Mainnet vs. another Sepolia season? Inputs for that discussion:
   - MM path is end-to-end complete and tested (contracts → scorer → picker → claims).
   - WC module works but has two event-specific gaps that only matter if reused: R32 pairing table for advancing 3rds (slots 68–71, placeholder) and the 6 TBD team codes in `shared/sports/worldcup2026/teams.ts`.
2. **Review + merge the bug-fix PR** (branch `fix/status-review-bugs`).
3. **Redeploy the Sepolia factory** — required regardless: the deployed factory (2026-03-02) predates the PR #9 `createPool` signature change, and this PR changes the claim leaf format. Update `NEXT_PUBLIC_FACTORY_ADDRESS` in `web/.env.local` and on Vercel.
4. **Gnosis Safe** — transfer factory/pool admin to a 2-of-2 multisig before anything touches mainnet. The admin EOA can still cancel pools and (before the deadline) set the Merkle root; the new deadline guard narrows but does not remove the trust assumption.
5. **Known remaining trust assumption (document or enforce):** the contract does not verify that Merkle leaf amounts sum to ≤ prize pool — a buggy/over-allocated tree lets early claimers drain later winners. The scorer guarantees exact totals, but nothing on-chain does.
6. **Nice-to-haves parked:** mobile tap-to-place fallback for drag-and-drop pickers; `shared/sports/ipl/` module (legacy `ipl-scoring.ts` still in use); reorg-confirmation buffer in the scorer's log scan.

## Current Branch State

- **Branch:** `fix/status-review-bugs` (branched from `main` @ `14953ee`)
- **Open PR:** being opened this session — see PR for the full diff summary
- **Uncommitted work:** none after commit

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
NEXT_PUBLIC_FACTORY_ADDRESS=<set after factory redeploy — old 0xac2bAA… is stale>
PINATA_JWT=<Pinata JWT from app.pinata.cloud>
SCORER_RPC_URL=<Alchemy Sepolia HTTPS URL>                # or http://127.0.0.1:8545 for local
```

### Sepolia Deployment

- **Factory:** `0xac2bAA67cB2De97eab5e5E8cBD35aea2FD03b02e` — deployed 2026-03-02, **STALE** (predates PR #9 signature change and this PR's leaf format change); redeploy required
- **Frontend:** `https://bracket-pool-dapp.vercel.app/`

## Key Architecture Decisions

- **63 games** (Round of 64 through Championship, no First Four), 6 rounds with doubling points (10/20/40/80/160/320)
- **Hash-only storage** — contract stores `keccak256(picks)`, full picks emitted in events
- **5% fee** via `totalPoolValue * 500 / 10000` (Solidity integer division)
- **Merkle tree claims** — scorer generates tree, root posted on-chain, proofs hosted on IPFS via Pinata
- **Pool-bound Merkle leaves** *(new)* — leaf = `keccak256(keccak256(abi.encode(poolAddress, owner, entryId, amount)))`; proofs cannot replay across pools
- **Finalize/refund mutual exclusion** *(new)* — `setMerkleRoot` requires `block.timestamp < finalizeDeadline`; after the deadline only refunds are possible, guaranteeing the full 90-day claim window whenever a pool does finalize
- **Claim deadline** — `finalizeDeadline + 90 days`, then admin can sweep unclaimed funds
- **Tiebreaker** — predicted championship total score (MM) or total goals in Final (WC), closest wins
- **Tiered payouts with positional tie handling** *(updated)* — tied entries split the combined payoutBps of the positions they occupy (standard pool convention); unoccupied tail tiers fold into the last finisher; rounding dust to the last paid group, intra-group dust to lowest entryId; totals always equal the prize pool exactly
- **Entry scan with count cross-check** *(new)* — scorer walks `getLogs` backward in 10k-block chunks until the on-chain `entryCount` is matched; mismatch is a hard error, never a silent drop
- **`sportId` on-chain routes both scorer and picker** *(updated)* — the frontend picker is resolved from `sportId` (poolName prefix is legacy fallback only); unknown sport renders an unsupported-pool notice
- **WC advancing 3rds are a set** *(updated)* — slots 48–55 scored by membership, not position; knockout slots remain positional (each slot is a fixed match in the official bracket)
- **`payoutBps` on-chain** — `uint16[]` summing to 10000; validated at pool creation, consumed by the scorer (the contract itself does no prize math)
- **`shared/` directory** — sport modules (teams + scoring) live at repo root. Copied into `web/shared/` and `web/src/scorer/` at build time by the web `prebuild`/`predev` scripts — never edit the copies
- **Token allowlist** — `BracketPoolFactory.allowedTokens`; owner calls `addToken`/`removeToken`
- **`maxEntries`** — optional entry cap on pools (0 = unlimited)
- **`updateResults()`** — admin can correct posted results before the Merkle root is set
- **`via_ir = true`** — enabled in `foundry.toml` to resolve stack-too-deep
- **Admin access control** — wallet-based EOA; transfer to Gnosis Safe 2-of-2 before mainnet
- **IPFS** — proofs uploaded via Pinata; claims fetch through 3 public gateways with timeout fallback; local dev skips Pinata when `PINATA_JWT` unset
- **Results input** — file upload only; admin uploads `.json` with `bytes32[]` array
