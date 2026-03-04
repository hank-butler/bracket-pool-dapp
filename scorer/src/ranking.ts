import type { ScoredEntry } from './types';

export function rankEntries(entries: ScoredEntry[], actualTiebreaker: number): ScoredEntry[] {
  // Calculate tiebreaker distances
  const withDistance = entries.map(e => ({
    ...e,
    tiebreakerDistance: Math.abs(Number(e.tiebreaker) - actualTiebreaker),
  }));

  // Sort: score desc, then tiebreaker distance asc, then entryId asc for determinism
  withDistance.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.tiebreakerDistance !== b.tiebreakerDistance) return a.tiebreakerDistance - b.tiebreakerDistance;
    return a.entryId - b.entryId;
  });

  // Assign ranks (tied entries get same rank)
  let currentRank = 1;
  for (let i = 0; i < withDistance.length; i++) {
    if (i > 0 &&
        withDistance[i].score === withDistance[i - 1].score &&
        withDistance[i].tiebreakerDistance === withDistance[i - 1].tiebreakerDistance) {
      withDistance[i].rank = withDistance[i - 1].rank;
    } else {
      withDistance[i].rank = currentRank;
    }
    currentRank++;
  }

  return withDistance;
}

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

    // tierEntries are sorted by entryId asc (rankEntries sorts deterministically),
    // so index 0 is the lowest entryId and receives the intra-tier dust.
    tierEntries.forEach((e, j) => {
      e.prizeAmount = prizeEach + (j === 0 ? dust : 0n);
    });
  }

  return result;
}
