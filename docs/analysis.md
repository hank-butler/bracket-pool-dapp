# MVP Plan Analysis

Analysis of `docs/plans/2025-02-09-bracket-pool-mvp-updated.md` — potential issues organized by severity.

---

## Critical Issues

### 1. Bonding Curve Refund Creates a Deficit (Line 31, 254)
The bonding curve means later entries pay more than earlier ones. But `refund()` returns `pricePaid` — the exact amount each entrant paid. If the pool is cancelled after many entries, the contract needs to pay back each entry's individual price. However, `setMerkleRoot()` already transfers 5% of `totalPoolValue` to treasury. If the merkle root is set and then a refund condition is somehow met (it shouldn't be since `cancelPool` requires `merkleRoot == bytes32(0)`), this is safe. **But there's a subtler issue**: the refund paths (2) and (3) don't check `cancelled` — they check conditions independently. If `setMerkleRoot` has already been called and taken the 5% fee, the deadline-based refund path won't trigger (merkleRoot != bytes32(0)). This seems okay, but worth adding an explicit test that verifies sum(pricePaid) == totalPoolValue to ensure the accounting is always balanced.

### 2. No Reentrancy Guard on `setMerkleRoot()` (Line 193)
`setMerkleRoot()` does a USDC `safeTransfer` to `treasury` but doesn't have `nonReentrant`. USDC is unlikely to have a callback, but if treasury is a contract (e.g., Gnosis Safe), this is worth guarding. The modifier is already imported — just not applied here.

### 3. Prize Pool Calculation Mismatch (Line 360-361)
The scorer pipeline says: `total - 5% fee / winners`. But the fee is already taken on-chain in `setMerkleRoot()`. The scorer should calculate prizes from `contract.balanceOf(pool)` **after** the fee is taken, not recompute the fee itself. If the scorer independently calculates 5% and there's any rounding difference from the Solidity division, the Merkle tree will encode amounts that don't match the contract's actual USDC balance — claims will fail or leave dust.

---

## High-Severity Issues

### 4. `gameResults` Stored as Dynamic Array but Treated as Immutable (Lines 129, 176-183)
`gameResults` is a mutable storage array. `setResults()` checks `gameResults.length == 0` to prevent double-setting, but `gameResults` could theoretically be an empty dynamic array with nonzero length if someone pushed and popped. More importantly — there's no check that `gameResults.length == gameCount` before `setMerkleRoot()`. The check is `gameResults.length == gameCount` (line 195), which is good. But consider using a `resultsPosted` bool flag instead of relying on array length for cleaner state management.

### 5. Missing `entryCount >= MIN_ENTRIES` Check in `setResults()` (Line 176)
`setMerkleRoot()` checks `entryCount >= MIN_ENTRIES` (line 198), but `setResults()` doesn't. The admin could post results to a pool with 0 or 1 entries. Not exploitable since `setMerkleRoot` catches it, but it wastes gas and creates a confusing state.

### 6. No Claim Deadline (Lines 216-226)
Once the Merkle root is set, winners can claim forever. There's no mechanism for the admin/treasury to sweep unclaimed funds. In practice, USDC could sit in the contract indefinitely. Consider adding a claim deadline after which unclaimed funds go to treasury.

### 7. Scoring Boundary Table Looks Wrong (Line 330)
```
0-3: 10, 4-35: 10, 36-51: 20, 52-59: 40, 60-63: 80, 64-65: 160, 66: 320
```
Games 0-3 and 4-35 both award 10 points? That's the first two rounds at the same value. According to the spec (line 34): `R1=10, R2=20, R3=40, R4=80, R5=160, R6=320`. March Madness has 32+16+8+4+2+1 = 63 games, not 67. The index ranges don't add up to 67 elements either (0-66 is 67 values). This needs to be reconciled — either the game count is wrong or the boundary mapping is wrong.

---

## Medium-Severity Issues

### 8. `bytes32[]` Pick Encoding is Gas-Expensive (Line 30)
Storing 67 `bytes32` values per entry is ~67 storage slots = ~1.34M gas just for SSTORE on a fresh entry. On L1 Ethereum at current prices, this could cost $50-100+ per entry in gas alone, on top of the USDC entry fee. This may make the product unusable on mainnet. Consider:
- Storing only a hash of picks on-chain, emitting the full picks in the event (the scorer reads events anyway)
- Or packing picks more efficiently (each pick is likely a small team ID, so multiple picks per bytes32)

### 9. No Event Indexing (Lines 134, 164)
`EntrySubmitted` includes `bytes32[] picks` — this is useful for the scorer but expensive in gas. The event parameters don't mention `indexed` keywords. At minimum, `entryId` and `owner` should be indexed for efficient log filtering by the scorer.

### 10. Tiebreaker Logic Not Fully Specified (Lines 37-38)
The spec says tiebreaker is "total combined score (final game)" and ties "split prize evenly." But the smart contract has no on-chain tiebreaker logic — it's all in the scorer. The scorer pipeline description (line 360) says "rank by score + tiebreaker" but doesn't specify:
- What "total combined score" means (both teams' final scores combined?)
- How close to the actual total determines tiebreaker ranking
- What happens with a 3-way tie where 2nd place prize differs from 3rd

### 11. Scorer Output Hosting Not Addressed (Line 417)
The claim UI "fetches scorer output JSON for the pool" — but where is this JSON hosted? There's no mention of IPFS, S3, or any storage mechanism. If the scorer output disappears, winners can't generate their proofs. The Merkle root is on-chain but proofs are off-chain and need to be available.

### 12. Factory `onlyOwner` Limits Pool Creation (Line 277)
Only the factory owner (multisig) can create pools. The plan mentions targeting "millions of entries with a headline-level prize pot" — but there's no permissionless pool creation. This is fine for MVP if only the operator creates pools, but worth noting as a design constraint.

---

## Low-Severity Issues

### 13. `poolName` is Mutable but Never Updated (Line 129)
`poolName` is listed as mutable state but there's no function to change it. Should probably be immutable (or a constant set in the constructor). Since it's a `string`, it can't be `immutable` in Solidity — consider using `bytes32` if names are short enough, or just leave it as storage.

### 14. No Validation of `_priceSlope` (Line 121)
If `priceSlope` is 0, the bonding curve is flat (constant price). If it's very large, the price could overflow. No bounds checking is specified.

### 15. CRE Timeline Risk (Line 482)
"CRE is in Early Access (launched Nov 2025)" — this is the documented upgrade path, but Early Access programs can change significantly. This isn't an issue for MVP but worth noting that the upgrade path is not guaranteed to be stable.

### 16. No `getPoolCount()` or Pagination (Line 283)
The factory pushes to a `pools` array but the frontend needs to enumerate pools. The plan mentions `usePools` reading `poolCount + pool addresses` (line 387) but no `getPoolCount()` function is specified in the factory.

---

## Summary

The **most actionable items** before implementation:
1. **Fix the game count / scoring boundaries** — 67 vs 63 games needs reconciliation
2. **Reconsider storing full picks on-chain** — gas cost on L1 may be prohibitive
3. **Ensure scorer reads contract balance** instead of independently computing fees
4. **Add `nonReentrant` to `setMerkleRoot()`**
5. **Define where scorer output JSON is hosted** for the claim UI
