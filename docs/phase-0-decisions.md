# Phase 0: Design Decisions

> Resolved 2025-02-10. These decisions are final and must be reflected in all contract interfaces, scorer logic, and frontend code before Phase 1 begins.

---

## Decision 1: Game Count & Scoring Boundaries

**Question:** The plan lists 67 games but March Madness has 63 in the main bracket. The scoring table had two rounds at 10 pts.

**Resolution:** **67 games** — 4 First Four (play-in) games + 63 main bracket games.

**Round structure (7 rounds):**

| Round | Name | Games | Index Range | Points | Total Available |
|-------|------|-------|-------------|--------|-----------------|
| R0 | First Four | 4 | 0–3 | 5 | 20 |
| R1 | Round of 64 | 32 | 4–35 | 10 | 320 |
| R2 | Round of 32 | 16 | 36–51 | 20 | 320 |
| R3 | Sweet 16 | 8 | 52–59 | 40 | 320 |
| R4 | Elite 8 | 4 | 60–63 | 80 | 320 |
| R5 | Final Four | 2 | 64–65 | 160 | 320 |
| R6 | Championship | 1 | 66 | 320 | 320 |
| | **Total** | **67** | **0–66** | | **1940** |

Perfect bracket = 1940 points.

**Impact:**
- `gameCount` = 67 in all contracts and tests
- Scorer `getPointsForGame(i)` must use the index ranges above
- Previous scoring table (two rounds at 10 pts) is replaced by the R0=5, R1=10 split

---

## Decision 2: On-Chain Pick Storage (Gas Optimization)

**Question:** Storing 67 `bytes32` values per entry costs ~1.34M gas (~$50-100+ on L1). Store full picks, hash, or packed?

**Resolution:** **Hash-only on-chain storage.**

- Store `keccak256(abi.encodePacked(picks))` on-chain per entry (1 storage slot instead of 67)
- Emit the full `bytes32[] picks` in the `EntrySubmitted` event
- Scorer reconstructs picks from event data and verifies against the on-chain hash

**Contract changes:**
```solidity
// Entry struct changes:
struct Entry {
    address owner;
    bytes32 picksHash;       // was: bytes32[] picks
    uint256 tiebreaker;
    uint256 pricePaid;
}

// enter() changes:
function enter(bytes32[] calldata picks, uint256 tiebreaker) external nonReentrant {
    // ...validation...
    bytes32 picksHash = keccak256(abi.encodePacked(picks));
    entries[entryCount] = Entry(msg.sender, picksHash, tiebreaker, price);
    emit EntrySubmitted(entryCount, msg.sender, picks, tiebreaker, price);
    // ...
}
```

**Impact:**
- Entry struct stores `bytes32 picksHash` instead of `bytes32[] picks`
- `enter()` still accepts `bytes32[] calldata picks` but only stores the hash
- `EntrySubmitted` event still emits full picks array (scorer depends on this)
- Remove `getEntryPicks()` view function (picks are no longer in storage)
- Estimated gas savings: ~1.3M gas per entry (~97% reduction in storage cost)

---

## Decision 3: Prize Pool Calculation

**Question:** Scorer computes `total - 5% fee` independently. Rounding differences between Solidity integer division and TypeScript could produce mismatched amounts.

**Resolution:** **Scorer reads contract balance, not recomputes.**

The scorer must determine the prize pool as:
```typescript
const prizePool = await usdc.read.balanceOf([poolAddress]);
```

This is called **after** `setMerkleRoot()` has executed and transferred the 5% fee to treasury. The remaining balance is the exact prize pool available for distribution.

**Impact:**
- Scorer pipeline must run after `setMerkleRoot()` is called (fee already taken)
- Scorer never independently calculates the fee amount
- Eliminates any rounding mismatch between Solidity and TypeScript
- Pipeline order: `setResults()` → `setMerkleRoot()` → run scorer → admin posts CID

**Wait — ordering issue:** `setMerkleRoot()` requires the Merkle root as input, but the scorer produces the root. The scorer needs to know the prize pool to calculate prize amounts, which requires the fee to already be taken.

**Revised flow:**
1. Admin calls `setResults()`
2. Scorer reads `totalPoolValue` from contract, computes fee using the same formula (`totalPoolValue * 500 / 10000`), calculates prize pool as `totalPoolValue - fee`
3. Scorer builds Merkle tree with prize amounts, outputs root
4. Admin calls `setMerkleRoot(root)` — contract takes fee, remaining balance matches scorer's calculation
5. **Verification step:** Scorer confirms `usdc.balanceOf(pool) == sum(prizeAmounts)` after `setMerkleRoot()` is called

The scorer replicates the fee calculation but adds a post-verification step to catch any mismatch before proofs are published.

**Impact:**
- Scorer computes fee using identical formula: `totalPoolValue * 500 / 10000` (integer division)
- After `setMerkleRoot()`, scorer verifies `balanceOf(pool) == sum(allPrizeAmounts)`
- If verification fails, scorer aborts and alerts admin — do not publish proofs

---

## Decision 4: Proof Hosting

**Question:** Scorer output JSON (Merkle proofs) has no defined hosting location. If it disappears, winners cannot claim.

**Resolution:** **IPFS with CID stored on-chain.**

- Pin scorer output JSON to IPFS via Pinata or web3.storage
- Store the IPFS CID on-chain in the BracketPool contract
- Frontend fetches proofs using the on-chain CID

**Contract changes:**
```solidity
// New state variable:
string public proofsCID;

// New event:
event ProofsCIDSet(string cid);

// New function (called after setMerkleRoot):
function setProofsCID(string calldata cid) external {
    require(msg.sender == admin, "Not authorized");
    require(merkleRoot != bytes32(0), "Merkle root not set");
    require(bytes(proofsCID).length == 0, "CID already set");
    require(bytes(cid).length > 0, "Empty CID");
    proofsCID = cid;
    emit ProofsCIDSet(cid);
}
```

**Impact:**
- New `proofsCID` state variable and `setProofsCID()` function on BracketPool
- Scorer pipeline uploads to IPFS and outputs the CID
- Admin calls `setProofsCID(cid)` after uploading
- Frontend reads `proofsCID` from contract, fetches from `ipfs://<cid>` via gateway
- Proofs are permanently retrievable as long as IPFS pin is maintained

---

## Decision 5: Tiebreaker Semantics

**Question:** "Total combined score (final game)" is underspecified.

**Resolution:** **Predicted total points scored in the championship game.**

- Each entrant submits a `uint256 tiebreaker` value representing their predicted combined score of both teams in the championship game (e.g., if they predict Team A 75 – Team B 68, they submit `143`)
- After the tournament, the actual combined score is known
- Tiebreaker ranking: **closest absolute distance** to the actual total wins
- Equal distance: **split the prize evenly** between tied entries

**Scorer logic:**
```typescript
function tiebreakRank(entries: ScoredEntry[], actualTotal: number): ScoredEntry[] {
    return entries.sort((a, b) => {
        // Primary: higher score wins
        if (b.score !== a.score) return b.score - a.score;
        // Secondary: closest tiebreaker to actual total
        const distA = Math.abs(a.tiebreaker - actualTotal);
        const distB = Math.abs(b.tiebreaker - actualTotal);
        return distA - distB;
    });
}
```

If two entries have the same score AND the same tiebreaker distance, they split the combined prize for their positions evenly.

**Impact:**
- `tiebreaker` field already exists in Entry struct (uint256) — no contract changes needed
- Scorer CLI takes `actualTiebreaker` as an argument
- Prize splitting logic must handle even division with potential dust (remainder goes to higher-ranked entry or stays in contract)

---

## Decision 6: Claim Deadline & Unclaimed Fund Sweep

**Question:** No claim deadline — USDC can sit in the contract forever.

**Resolution:** **Add `claimDeadline` and `sweepUnclaimed()`.**

- `claimDeadline` = `finalizeDeadline + 90 days`
- After `claimDeadline`, admin can call `sweepUnclaimed()` to transfer all remaining USDC to treasury
- Winners must claim within the 90-day window after finalization

**Contract changes:**
```solidity
// New immutable:
uint256 public immutable claimDeadline;  // finalizeDeadline + 90 days

// Set in constructor:
claimDeadline = _finalizeDeadline + 90 days;

// New event:
event UnclaimedSwept(address treasury, uint256 amount);

// New function:
function sweepUnclaimed() external {
    require(msg.sender == admin, "Not authorized");
    require(block.timestamp >= claimDeadline, "Claim period not over");
    require(merkleRoot != bytes32(0), "Not finalized");
    uint256 balance = usdc.balanceOf(address(this));
    require(balance > 0, "Nothing to sweep");
    usdc.safeTransfer(treasury, balance);
    emit UnclaimedSwept(treasury, balance);
}

// Modify claim():
function claim(...) external nonReentrant {
    require(block.timestamp < claimDeadline, "Claim period ended");
    // ...existing logic...
}
```

**Impact:**
- New `claimDeadline` immutable, computed from `finalizeDeadline + 90 days`
- New `sweepUnclaimed()` function for admin
- `claim()` gains a deadline check — reverts after `claimDeadline`
- Frontend should display claim deadline and warn users as it approaches
- `claimDeadline` does not affect refund paths (refunds are independent)

---

## Summary of All Contract Interface Changes

Compared to the original MVP plan, these decisions produce the following changes to `BracketPool.sol`:

**Entry struct:**
- `bytes32[] picks` → `bytes32 picksHash`

**New state:**
- `string public proofsCID`
- `uint256 public immutable claimDeadline`

**New functions:**
- `setProofsCID(string calldata cid)` — admin sets IPFS CID after uploading proofs
- `sweepUnclaimed()` — admin sweeps unclaimed USDC after claim deadline

**Modified functions:**
- `enter()` — stores hash of picks instead of full array; still emits full picks in event
- `claim()` — adds `require(block.timestamp < claimDeadline)`

**New events:**
- `ProofsCIDSet(string cid)`
- `UnclaimedSwept(address treasury, uint256 amount)`

**Scoring (off-chain):**
- 7 rounds with R0=5 for First Four games
- Fee computed via `totalPoolValue * 500 / 10000`, verified post-`setMerkleRoot()` against `balanceOf(pool)`
- Tiebreaker: closest predicted championship total score, equal distance splits evenly
- Output pinned to IPFS, CID provided to admin for on-chain storage

**Constructor parameter changes:**
- None — `claimDeadline` is derived from `finalizeDeadline` internally
