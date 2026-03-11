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

export function distributePrizes(
  rankedEntries: ScoredEntry[],
  prizePool: bigint,
  payoutBps: number[],
): ScoredEntry[] {
  if (rankedEntries.length === 0) {
    throw new Error('Cannot distribute prizes to empty entry list');
  }
  if (payoutBps.length === 0) {
    throw new Error('payoutBps must not be empty');
  }

  const distinctRanks = [...new Set(rankedEntries.map(e => e.rank))].sort((a, b) => a - b);
  const tierCount = Math.min(payoutBps.length, distinctRanks.length);

  // Compute tier pools from payoutBps.
  // All tiers except the last use integer division; the last paid tier absorbs dust
  // so the total always equals prizePool exactly.
  const tierPools: bigint[] = [];
  let allocated = 0n;
  for (let i = 0; i < tierCount; i++) {
    if (i === tierCount - 1) {
      tierPools.push(prizePool - allocated);
    } else {
      const tierPool = prizePool * BigInt(payoutBps[i]) / 10000n;
      tierPools.push(tierPool);
      allocated += tierPool;
    }
  }

  const result: ScoredEntry[] = rankedEntries.map(e => ({ ...e, prizeAmount: 0n }));
  const paidRanks = distinctRanks.slice(0, tierCount);

  for (let i = 0; i < paidRanks.length; i++) {
    const tierEntries = result.filter(e => e.rank === paidRanks[i]);
    tierEntries.sort((a, b) => a.entryId - b.entryId);
    const tierPool = tierPools[i];
    const prizeEach = tierPool / BigInt(tierEntries.length);
    const dust = tierPool - prizeEach * BigInt(tierEntries.length);

    // Lowest entryId in each tier receives intra-tier dust (deterministic).
    tierEntries.forEach((e, j) => {
      e.prizeAmount = prizeEach + (j === 0 ? dust : 0n);
    });
  }

  return result;
}
