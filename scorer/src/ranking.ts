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

  // Tied entries split the combined payouts of the finishing positions they
  // occupy: a group of k entries tied at rank r consumes positions r..r+k-1
  // and shares sum(payoutBps[r-1..r+k-2]). This keeps payouts monotonic in
  // rank — a lower-ranked entry can never out-earn a tied group above it.
  const distinctRanks = [...new Set(rankedEntries.map(e => e.rank))].sort((a, b) => a - b);
  const result: ScoredEntry[] = rankedEntries.map(e => ({ ...e, prizeAmount: 0n }));

  // Group bps by occupied positions. The last group extends through any
  // remaining tier positions so no bps are stranded when there are fewer
  // entries than tiers.
  const groups = distinctRanks.map((rank, gi) => {
    const groupEntries = result.filter(e => e.rank === rank).sort((a, b) => a.entryId - b.entryId);
    const startPos = rank - 1; // competition ranking: rank r occupies positions r..r+k-1
    let endPos = startPos + groupEntries.length; // exclusive
    if (gi === distinctRanks.length - 1) endPos = Math.max(endPos, payoutBps.length);
    let bps = 0;
    for (let p = startPos; p < endPos && p < payoutBps.length; p++) bps += payoutBps[p];
    return { entries: groupEntries, bps };
  });

  // Integer division for every paid group except the last, which absorbs the
  // rounding remainder so the total always equals prizePool exactly.
  const paidGroups = groups.filter(g => g.bps > 0);
  let allocated = 0n;
  paidGroups.forEach((group, gi) => {
    const groupPool = gi === paidGroups.length - 1
      ? prizePool - allocated
      : prizePool * BigInt(group.bps) / 10000n;
    allocated += groupPool;

    const prizeEach = groupPool / BigInt(group.entries.length);
    const dust = groupPool - prizeEach * BigInt(group.entries.length);

    // Lowest entryId in each group receives intra-group dust (deterministic).
    group.entries.forEach((e, j) => {
      e.prizeAmount = prizeEach + (j === 0 ? dust : 0n);
    });
  });

  return result;
}
