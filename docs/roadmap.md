# Bracket Pool DApp — Roadmap

> Derived from the [Updated MVP Plan](plans/2025-02-09-bracket-pool-mvp-updated.md) and the [Plan Analysis](analysis.md).

---

## Phase 0: Pre-Implementation — Resolve Open Design Questions

Before writing code, the following issues from the analysis must be resolved. Each maps to a decision that affects contract interfaces, gas costs, or off-chain architecture.

| # | Issue | Decision Needed | Recommendation |
|---|-------|-----------------|----------------|
| 1 | Game count is listed as 67 but March Madness has 63 games (32+16+8+4+2+1). Scoring boundary table has two rounds at 10 pts. | Confirm correct game count and round→index mapping. | Audit against the actual NCAA bracket structure. 67 may include play-in games (First Four = 4 extra). If so, update the scoring table to assign correct per-round points. |
| 2 | Storing 67 `bytes32` values per entry costs ~1.34M gas on L1 (~$50-100+). | Store full picks on-chain, store only a hash, or pack picks? | Store a `keccak256` hash of picks on-chain; emit full picks in the `EntrySubmitted` event. The scorer already reads events, so no functionality is lost. Dramatically reduces gas. |
| 3 | Scorer computes `total - 5% fee` independently of contract. Rounding differences between Solidity integer division and TypeScript could produce mismatched amounts. | How does the scorer determine the prize pool? | Scorer should read `usdc.balanceOf(poolAddress)` after `setMerkleRoot()` has taken the fee, not recompute it. |
| 4 | Scorer output JSON (proofs) has no defined hosting location. If it disappears, winners cannot claim. | Where is the proof JSON stored? | Host on IPFS (pin via Pinata/web3.storage) and store the CID on-chain or in a public registry. S3 as a fallback. |
| 5 | Tiebreaker logic is underspecified: "total combined score (final game)". | Define tiebreaker semantics precisely. | Tiebreaker = predicted sum of both teams' final-game scores. Closest to actual total wins. Equal distance = split prize evenly. Document in scorer and in contract comments. |
| 6 | No claim deadline — USDC can sit in the contract forever. | Add a sweep mechanism or accept the risk? | Add a `claimDeadline` (e.g., finalizeDeadline + 90 days). After that, admin can sweep unclaimed funds to treasury. |

**Exit criteria:** All six decisions documented and reflected in updated contract interfaces before Phase 1 begins.

---

## Phase 1: Smart Contracts (Foundry)

### 1.0 — Project Scaffolding
- `forge init`, install OpenZeppelin, configure `foundry.toml` (solc 0.8.24, optimizer 200 runs)
- Replace `.gitignore` to cover Foundry, Node, Next.js, env files

### 1.1 — MockUSDC Test Helper
- ERC20 with 6 decimals and public `mint()`

### 1.2 — BracketPool Constructor + Initialization
- Constructor with explicit `_admin` parameter (admin bug fix)
- Add `nonReentrant` to all functions that transfer USDC, **including `setMerkleRoot()`** (analysis issue #2)
- Consider `resultsPosted` bool flag instead of relying on `gameResults.length` (analysis issue #4)
- Add `getPoolCount()` view to factory (analysis issue #16)
- Validate `_priceSlope` bounds in constructor (analysis issue #14)
- Index `entryId` and `owner` in `EntrySubmitted` event (analysis issue #9)

### 1.3 — getCurrentPrice()
- Bonding curve: `basePrice + (slope * totalPoolValue / 10000)`
- Tests: empty pool returns base, price increases after entries

### 1.4 — enter()
- If hash-only approach adopted (Phase 0 decision #2): store `keccak256(picks)` on-chain, emit full picks in event
- `nonReentrant`, reverts after lock / wrong length / cancelled

### 1.5 — setResults()
- Admin-only, after lock, no double-set
- Consider adding `entryCount >= MIN_ENTRIES` check here too (analysis issue #5)

### 1.6 — setMerkleRoot()
- Takes 5% fee via `safeTransfer` to treasury
- **Must include `nonReentrant`** (analysis issue #2)
- Requires results posted, not already set, root != 0, sufficient entries

### 1.7 — claim()
- Merkle proof verification with double-hash leaf (OpenZeppelin convention)
- `nonReentrant`, prevents double-claim
- If claim deadline adopted (Phase 0 decision #6): enforce it here

### 1.8 — cancelPool() + refund()
- Three refund paths: cancelled / insufficient entries after lock / past finalize deadline
- Add test: `sum(pricePaid) == totalPoolValue` to verify accounting balance (analysis issue #1)

### 1.9 — BracketPoolFactory
- `createPool()` passes `msg.sender` as admin (not factory address)
- Critical test: `pool.admin() == caller`
- Add `getPoolCount()` and pool enumeration views

### 1.10 — Deployment Script
- `Deploy.s.sol` with env-based USDC/treasury/RPC configuration

### 1.11 — Full Test Suite
- Target 90%+ coverage on `BracketPool.sol`
- Fuzz tests for `getCurrentPrice`, claim/refund edge cases
- Invariant: contract USDC balance >= sum of all unclaimed prizes + unrefunded entries

---

## Phase 2: Off-Chain Scoring Service (TypeScript)

### 2.1 — Project Setup
- TypeScript + viem + `@openzeppelin/merkle-tree` + vitest

### 2.2 — Scoring Logic
- Correct round→index mapping (must match Phase 0 decision #1)
- ESPN-style points: R1=10, R2=20, R3=40, R4=80, R5=160, R6=320
- Tests: perfect bracket, all wrong, championship-only

### 2.3 — Merkle Tree Builder
- `StandardMerkleTree.of(values, ['address', 'uint256', 'uint256'])`
- Leaf: `[owner, entryId, prizeAmount]`

### 2.4 — Event Reader
- Read `EntrySubmitted` events via viem
- If hash-only approach: reconstruct picks from event data, verify against on-chain hash

### 2.5 — Main Pipeline
- Read entries → score → rank (score + tiebreaker) → calculate prizes
- **Prize pool = `usdc.balanceOf(pool)`** after fee is taken (analysis issue #3)
- Output: JSON with Merkle root, per-entry scores/ranks, winner proofs
- Upload proof JSON to IPFS (Phase 0 decision #4)

### 2.6 — Determinism Verification
- Test: same inputs always produce the same Merkle root
- Test: generated proofs validate against the root in a local contract instance

---

## Phase 3: Frontend (Next.js + wagmi + RainbowKit)

### 3.1 — Project Setup
- Next.js 14, TypeScript, Tailwind, wagmi, RainbowKit
- Chains: Sepolia + Mainnet (not Base)

### 3.2 — Contract ABIs + Addresses
- Extract from Foundry build output
- Sepolia + Mainnet address config

### 3.3 — Pool List Page
- `usePools` hook (requires `getPoolCount()` from factory — analysis issue #16)
- Pool cards: name, entries, value, status, current price

### 3.4 — Pool Detail Page
- `/pool/[address]` — full pool info, user's entries
- Conditional sections based on pool state

### 3.5 — Bracket Picker
- Interactive bracket tree UI
- `teams.ts` mapping display names → bytes32 IDs
- Tiebreaker input field

### 3.6 — Entry Submission
- Two-step flow: USDC approve → `pool.enter()`
- State machine: Idle → Approving → Submitting → Done

### 3.7 — Claim UI
- Fetch proof JSON from IPFS/hosted location (Phase 0 decision #4)
- Find user's winning entries, call `pool.claim(entryId, amount, proof)`

### 3.8 — Refund UI
- Show refund button when any of the 3 refund conditions are met
- Call `pool.refund(entryId)`

---

## Phase 4: Integration Testing

### 4.1 — Anvil Fork E2E
1. Fork Sepolia via Anvil
2. Deploy factory, create pool
3. Mint USDC, submit entries from multiple accounts
4. Warp time past lock, post results
5. Run scorer against local fork
6. Post Merkle root, verify fee transfer
7. Claim prizes, verify USDC balances
8. Test refund paths (cancel, min entries, deadline)

### 4.2 — Frontend Manual E2E
- Point web app at `localhost:8545`
- Full flow with MetaMask: connect → pick bracket → enter → claim/refund

---

## Phase 5: Testnet Deployment

1. Deploy 3-of-5 Gnosis Safe on Sepolia
2. Deploy `BracketPoolFactory` to Sepolia
3. Transfer factory ownership to Safe
4. Verify contracts on Etherscan
5. Create test pool, run full flow on Sepolia
6. Deploy frontend to Vercel
7. Smoke test: end-to-end with real Sepolia USDC

---

## Phase 6: Mainnet Preparation

1. Security audit / peer review
2. Deploy to Ethereum Mainnet
3. Transfer ownership to production multisig
4. Verify contracts on Etherscan
5. Monitor first pool lifecycle end-to-end

---

## Future: Chainlink CRE Upgrade

The contract architecture already separates `setResults()` (game data) from `setMerkleRoot()` (scored outcome). Upgrade path:

1. Add `oracle` role alongside `admin`
2. CRE workflow fetches results from SportsDataIO, reaches DON consensus, calls `setResults()`
3. Scorer (or CRE workflow) computes Merkle root, posts via `setMerkleRoot()`
4. No structural changes to the Merkle claim pattern

CRE is in Early Access as of Nov 2025 — timeline is not guaranteed to be stable.

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| L1 gas costs make entries too expensive | Adopt hash-only on-chain storage (Phase 0 decision #2); consider L2 migration if needed |
| Scorer output lost, winners can't claim | Pin proof JSON to IPFS; store CID on-chain or in public registry |
| Rounding mismatch between scorer and contract | Scorer reads `balanceOf(pool)` post-fee instead of recomputing |
| Multisig fails to finalize within deadline | Emergency refund path after `finalizeDeadline` already in contract |
| Unclaimed USDC locked forever | Add claim deadline + admin sweep (Phase 0 decision #6) |
| Game count / scoring table is wrong | Reconcile against actual NCAA bracket before implementation |
