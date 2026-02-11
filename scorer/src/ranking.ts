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
  // Find all rank-1 entries (winners)
  const winnerRank = rankedEntries[0].rank;
  const winners = rankedEntries.filter(e => e.rank === winnerRank);
  const nonWinners = rankedEntries.filter(e => e.rank !== winnerRank);

  const prizePerWinner = prizePool / BigInt(winners.length);
  const dust = prizePool - prizePerWinner * BigInt(winners.length);

  const distributed = winners.map((e, i) => ({
    ...e,
    prizeAmount: prizePerWinner + (i === 0 ? dust : 0n),
  }));

  const zeroedNonWinners = nonWinners.map(e => ({ ...e, prizeAmount: 0n }));

  return [...distributed, ...zeroedNonWinners];
}
