import { readEntries, readGameResults, readTotalPoolValue } from './reader';
import { scoreEntry } from './scoring';
import { rankEntries, distributePrizes } from './ranking';
import { buildMerkleTree } from './merkle';
import type { ScoredEntry, ScorerOutput } from './types';
import type { Address } from 'viem';

export async function runScorer(
  poolAddress: Address,
  rpcUrl: string,
  actualTiebreaker: number,
  fromBlock?: bigint,
): Promise<ScorerOutput> {
  const entries = await readEntries(poolAddress, rpcUrl, undefined, fromBlock);
  const results = await readGameResults(poolAddress, rpcUrl);
  const totalPoolValue = await readTotalPoolValue(poolAddress, rpcUrl);

  const scored: ScoredEntry[] = entries.map(e => ({
    ...e,
    score: scoreEntry(e.picks, results),
    tiebreakerDistance: 0,
    rank: 0,
    prizeAmount: 0n,
  }));

  const ranked = rankEntries(scored, actualTiebreaker);

  const FEE_PERCENT = 500n;
  const BASIS_POINTS = 10000n;
  const fee = totalPoolValue * FEE_PERCENT / BASIS_POINTS;
  const prizePool = totalPoolValue - fee;

  const distributed = distributePrizes(ranked, prizePool);

  const winners = distributed
    .filter(e => e.prizeAmount > 0n)
    .map(e => ({
      owner: e.owner,
      entryId: e.entryId,
      amount: e.prizeAmount,
    }));

  const { root, proofs } = buildMerkleTree(winners);

  return {
    poolAddress,
    merkleRoot: root,
    totalEntries: entries.length,
    prizePool,
    entries: distributed,
    proofs,
  };
}
