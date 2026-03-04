# Tiered Payouts Design — 2026-03-03

## Problem

`distributePrizes()` in `scorer/src/ranking.ts` currently pays rank-1 only (100% to winner). Real-money pools need a 60/25/15 split across the top 3 finishers.

## Decision

Hardcode the 60/25/15 split inside `distributePrizes`. No signature change, no new parameters. Configurable splits deferred until a concrete need exists.

## Rules

| Distinct rank positions present | Split |
|---|---|
| 1 (or fewer than 3 entries total) | 100% to rank 1 |
| 2 | 75% to rank 1, 25% to rank 2 |
| 3+ | 60% to rank 1, 25% to rank 2, 15% to rank 3 |

Ranks 4+ always receive 0.

Within each tier, prize is split evenly among all tied entries. Integer remainder (dust) goes to the entry with the lowest `entryId` in that tier.

## Files Changed

- `scorer/src/ranking.ts` — rewrite `distributePrizes` internals
- `scorer/test/ranking.test.ts` — update existing tests, add new cases

No changes to `pipeline.ts`, `types.ts`, `merkle.ts`, or `index.ts`.

## New Test Cases

- 3 distinct ranks, clean split
- 3 distinct ranks, dust on rank 1
- 2 distinct ranks (no rank 3) → 75/25
- Tied entries within rank 2 split the 25%
- Exactly 2 entries → 100% to winner
- Exactly 1 entry → 100% to winner
