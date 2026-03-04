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

  it('3 tiers with 3-way tie at rank 2: each tier split evenly', () => {
    // ranks: [1, 2, 2, 2, 3] — three tied at rank 2, one at rank 3
    const entries = [
      makeEntry(0, '0xA', 400, 145),
      makeEntry(1, '0xB', 200, 145),
      makeEntry(2, '0xC', 200, 145),
      makeEntry(3, '0xD', 200, 145),
      makeEntry(4, '0xE', 100, 145),
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 120_000_000n);

    expect(result.find(e => e.entryId === 0)?.prizeAmount).toBe(72_000_000n); // 60%
    // 25% of 120_000_000 = 30_000_000, split 3 ways = 10_000_000 each
    expect(result.find(e => e.entryId === 1)?.prizeAmount).toBe(10_000_000n);
    expect(result.find(e => e.entryId === 2)?.prizeAmount).toBe(10_000_000n);
    expect(result.find(e => e.entryId === 3)?.prizeAmount).toBe(10_000_000n);
    expect(result.find(e => e.entryId === 4)?.prizeAmount).toBe(18_000_000n); // 15%
    const total = result.reduce((sum, e) => sum + e.prizeAmount, 0n);
    expect(total).toBe(120_000_000n);
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
