# Tiered Payouts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace winner-takes-all prize distribution with a 60/25/15 split across the top 3 finishers.

**Architecture:** Modify `distributePrizes()` internals only. Same function signature — no callers change. Rank-1 always absorbs inter-tier dust. Within a tier, dust goes to the lowest `entryId` (already sorted first by `rankEntries`).

**Tech Stack:** TypeScript, Vitest (`npm test` in `scorer/`)

---

## Split Rules

| Scenario | Split |
|---|---|
| Fewer than 3 entries total | 100% rank 1 |
| 3+ entries, 1 distinct rank | 100% rank 1 (all tied) |
| 3+ entries, 2 distinct ranks | 75% rank 1 / 25% rank 2 |
| 3+ entries, 3+ distinct ranks | 60% rank 1 / 25% rank 2 / 15% rank 3 |

Ranks 4+ always receive 0. Tier amounts: rank 2 and rank 3 are computed first via integer division; rank 1 gets the remainder (absorbs dust).

---

### Task 1: Write failing tests for tiered payouts

**Files:**
- Modify: `scorer/test/ranking.test.ts`

The existing tests in this file still pass after this change (the 2-entry and 3-way-tie cases are covered by existing tests). Add a new `describe` block at the bottom of the file.

**Step 1: Add new test cases**

Append to `scorer/test/ranking.test.ts`:

```ts
describe('distributePrizes (tiered)', () => {
  it('3 distinct ranks: 60/25/15 split', () => {
    const entries = [
      makeEntry(0, '0xA', 300, 145),
      makeEntry(1, '0xB', 200, 145),
      makeEntry(2, '0xC', 100, 145),
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 100_000_000n);

    expect(result.find(e => e.entryId === 0)?.prizeAmount).toBe(60_000_000n);
    expect(result.find(e => e.entryId === 1)?.prizeAmount).toBe(25_000_000n);
    expect(result.find(e => e.entryId === 2)?.prizeAmount).toBe(15_000_000n);
  });

  it('3 distinct ranks: inter-tier dust goes to rank-1 entry', () => {
    const entries = [
      makeEntry(0, '0xA', 300, 145),
      makeEntry(1, '0xB', 200, 145),
      makeEntry(2, '0xC', 100, 145),
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 100_000_001n);

    // t2 = 100_000_001 * 25n / 100n = 25_000_000
    // t3 = 100_000_001 * 15n / 100n = 15_000_000
    // t1 = 100_000_001 - 25_000_000 - 15_000_000 = 60_000_001
    expect(result.find(e => e.entryId === 0)?.prizeAmount).toBe(60_000_001n);
    expect(result.find(e => e.entryId === 1)?.prizeAmount).toBe(25_000_000n);
    expect(result.find(e => e.entryId === 2)?.prizeAmount).toBe(15_000_000n);

    const total = result.reduce((sum, e) => sum + e.prizeAmount, 0n);
    expect(total).toBe(100_000_001n);
  });

  it('2 distinct ranks (3+ entries): 75/25 split', () => {
    // ranks: [1, 2, 2]
    const entries = [
      makeEntry(0, '0xA', 300, 145),
      makeEntry(1, '0xB', 200, 145),
      makeEntry(2, '0xC', 200, 145),
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 100_000_000n);

    expect(result.find(e => e.entryId === 0)?.prizeAmount).toBe(75_000_000n);
    // entries 1 and 2 are tied at rank 2 — split 25% evenly
    expect(result.find(e => e.entryId === 1)?.prizeAmount).toBe(12_500_000n);
    expect(result.find(e => e.entryId === 2)?.prizeAmount).toBe(12_500_000n);
  });

  it('2 distinct ranks: inter-tier dust goes to rank-1', () => {
    const entries = [
      makeEntry(0, '0xA', 300, 145),
      makeEntry(1, '0xB', 200, 145),
      makeEntry(2, '0xC', 200, 145),
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 100_000_001n);

    // t2 = 100_000_001 * 25n / 100n = 25_000_000
    // t1 = 100_000_001 - 25_000_000 = 75_000_001
    expect(result.find(e => e.entryId === 0)?.prizeAmount).toBe(75_000_001n);
    const total = result.reduce((sum, e) => sum + e.prizeAmount, 0n);
    expect(total).toBe(100_000_001n);
  });

  it('tied entries within rank 2 split the 25%', () => {
    // ranks: [1, 2, 2, 2] — three tied at rank 2
    const entries = [
      makeEntry(0, '0xA', 400, 145),
      makeEntry(1, '0xB', 200, 145),
      makeEntry(2, '0xC', 200, 145),
      makeEntry(3, '0xD', 200, 145),
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 120_000_000n);

    expect(result.find(e => e.entryId === 0)?.prizeAmount).toBe(72_000_000n); // 60%
    // 25% of 120_000_000 = 30_000_000, split 3 ways = 10_000_000 each
    expect(result.find(e => e.entryId === 1)?.prizeAmount).toBe(10_000_000n);
    expect(result.find(e => e.entryId === 2)?.prizeAmount).toBe(10_000_000n);
    expect(result.find(e => e.entryId === 3)?.prizeAmount).toBe(10_000_000n);
  });

  it('rank 4+ entries get 0', () => {
    const entries = [
      makeEntry(0, '0xA', 400, 145),
      makeEntry(1, '0xB', 300, 145),
      makeEntry(2, '0xC', 200, 145),
      makeEntry(3, '0xD', 100, 145),
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 100_000_000n);

    expect(result.find(e => e.entryId === 3)?.prizeAmount).toBe(0n);
    const total = result.reduce((sum, e) => sum + e.prizeAmount, 0n);
    expect(total).toBe(100_000_000n);
  });

  it('exactly 1 entry: 100% to that entry', () => {
    const entries = [makeEntry(0, '0xA', 200, 145)];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 19_000_000n);

    expect(result[0].prizeAmount).toBe(19_000_000n);
  });

  it('2 entries: 100% to winner (not tiered)', () => {
    const entries = [
      makeEntry(0, '0xA', 200, 145),
      makeEntry(1, '0xB', 100, 145),
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 19_000_000n);

    expect(result.find(e => e.entryId === 0)?.prizeAmount).toBe(19_000_000n);
    expect(result.find(e => e.entryId === 1)?.prizeAmount).toBe(0n);
  });

  it('all entries tied (1 distinct rank): everyone splits 100%', () => {
    const entries = [
      makeEntry(0, '0xA', 200, 145),
      makeEntry(1, '0xB', 200, 145),
      makeEntry(2, '0xC', 200, 145),
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 30_000_000n);

    result.forEach(e => expect(e.prizeAmount).toBe(10_000_000n));
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd scorer && npm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: existing tests pass, all new tests fail (likely `toBe(60_000_000n)` received `19_000_000n` or similar).

---

### Task 2: Implement tiered `distributePrizes`

**Files:**
- Modify: `scorer/src/ranking.ts`

**Step 1: Replace `distributePrizes` implementation**

Replace the entire `distributePrizes` function (lines 33–53) with:

```ts
export function distributePrizes(rankedEntries: ScoredEntry[], prizePool: bigint): ScoredEntry[] {
  if (rankedEntries.length === 0) {
    throw new Error('Cannot distribute prizes to empty entry list');
  }

  const distinctRanks = [...new Set(rankedEntries.map(e => e.rank))].sort((a, b) => a - b);

  // Compute prize pool per tier.
  // Rank 2 and rank 3 use integer division; rank 1 gets the remainder (absorbs inter-tier dust).
  let tierPools: bigint[];
  if (rankedEntries.length < 3 || distinctRanks.length === 1) {
    tierPools = [prizePool];
  } else if (distinctRanks.length === 2) {
    const t2 = prizePool * 25n / 100n;
    tierPools = [prizePool - t2, t2];
  } else {
    const t2 = prizePool * 25n / 100n;
    const t3 = prizePool * 15n / 100n;
    tierPools = [prizePool - t2 - t3, t2, t3];
  }

  // Start everyone at 0, then assign prizes tier by tier.
  const result: ScoredEntry[] = rankedEntries.map(e => ({ ...e, prizeAmount: 0n }));

  const paidRanks = distinctRanks.slice(0, tierPools.length);

  for (let i = 0; i < paidRanks.length; i++) {
    const tierEntries = result.filter(e => e.rank === paidRanks[i]);
    const tierPool = tierPools[i];
    const prizeEach = tierPool / BigInt(tierEntries.length);
    const dust = tierPool - prizeEach * BigInt(tierEntries.length);

    // tierEntries are already sorted by entryId asc (rankEntries sorts deterministically),
    // so index 0 is the lowest entryId and receives the intra-tier dust.
    tierEntries.forEach((e, j) => {
      e.prizeAmount = prizeEach + (j === 0 ? dust : 0n);
    });
  }

  return result;
}
```

**Step 2: Run all tests**

```bash
cd scorer && npm test -- --reporter=verbose 2>&1 | tail -40
```

Expected: all tests pass (41 existing + 9 new = 50 total).

**Step 3: Commit**

```bash
cd scorer && git add src/ranking.ts test/ranking.test.ts
git commit -m "feat: tiered payouts 60/25/15 in distributePrizes"
```

---

### Task 3: Verify pipeline integration

No code changes — this task confirms the scorer pipeline still produces a valid Merkle tree with the new distribution.

**Step 1: Run pipeline tests**

```bash
cd scorer && npm test -- --reporter=verbose src/pipeline.test.ts 2>&1
```

Expected: all pipeline tests pass.

**Step 2: Final full test run**

```bash
cd scorer && npm test 2>&1 | tail -10
```

Expected: all 50 tests pass across 6 files, 0 failures.

**Step 3: Commit if pipeline tests required any fix (skip if already clean)**

```bash
git add -p
git commit -m "fix: update pipeline for tiered payouts"
```
