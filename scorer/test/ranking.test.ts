import { describe, it, expect } from 'vitest';
import { rankEntries, distributePrizes } from '../src/ranking';
import type { ScoredEntry } from '../src/types';

const makeEntry = (id: number, owner: string, score: number, tiebreaker: number): ScoredEntry => ({
  entryId: id,
  owner,
  picks: [],
  tiebreaker: BigInt(tiebreaker),
  pricePaid: 10_000_000n,
  score,
  tiebreakerDistance: 0,
  rank: 0,
  prizeAmount: 0n,
});

describe('rankEntries', () => {
  it('ranks by score descending', () => {
    const entries = [
      makeEntry(0, '0xA', 100, 140),
      makeEntry(1, '0xB', 200, 140),
      makeEntry(2, '0xC', 150, 140),
    ];
    const ranked = rankEntries(entries, 145);
    expect(ranked[0].entryId).toBe(1);
    expect(ranked[1].entryId).toBe(2);
    expect(ranked[2].entryId).toBe(0);
  });

  it('uses tiebreaker when scores are equal', () => {
    const entries = [
      makeEntry(0, '0xA', 200, 150), // dist=5
      makeEntry(1, '0xB', 200, 143), // dist=2 (closer)
    ];
    const ranked = rankEntries(entries, 145);
    expect(ranked[0].entryId).toBe(1); // closer tiebreaker wins
    expect(ranked[1].entryId).toBe(0);
  });

  it('assigns same rank for equal score and tiebreaker distance', () => {
    const entries = [
      makeEntry(0, '0xA', 200, 140), // dist=5
      makeEntry(1, '0xB', 200, 150), // dist=5
    ];
    const ranked = rankEntries(entries, 145);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1); // tied
  });
});

describe('distributePrizes', () => {
  it('single winner gets full prize pool', () => {
    const entries = [
      makeEntry(0, '0xA', 200, 145),
      makeEntry(1, '0xB', 100, 145),
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 19_000_000n); // $19 prize pool

    expect(result[0].prizeAmount).toBe(19_000_000n);
    expect(result[1].prizeAmount).toBe(0n);
  });

  it('tied winners split evenly', () => {
    const entries = [
      makeEntry(0, '0xA', 200, 140), // dist=5
      makeEntry(1, '0xB', 200, 150), // dist=5
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 20_000_000n);

    expect(result[0].prizeAmount).toBe(10_000_000n);
    expect(result[1].prizeAmount).toBe(10_000_000n);
  });

  it('handles dust correctly (remainder to first winner)', () => {
    const entries = [
      makeEntry(0, '0xA', 200, 140),
      makeEntry(1, '0xB', 200, 150),
      makeEntry(2, '0xC', 200, 140), // 3-way tie, dist=5 each
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 19_000_001n); // not evenly divisible by 3

    const total = result.reduce((sum, e) => sum + e.prizeAmount, 0n);
    expect(total).toBe(19_000_001n); // no dust lost
  });
});
