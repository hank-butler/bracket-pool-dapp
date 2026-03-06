import { readEntries, readGameResults, readTotalPoolValue, readPoolConfig } from './reader';
import { rankEntries, distributePrizes } from './ranking';
import { buildMerkleTree } from './merkle';
import type { ScoredEntry, ScorerOutput } from './types';
import type { Address } from 'viem';
import type { SportModule } from '../../shared/sports/interface';
import { marchmadness } from '../../shared/sports/marchmadness/scoring';

const SPORT_MODULES: Record<string, SportModule> = {
  mm: marchmadness,
};

export async function runScorer(
  poolAddress: Address,
  rpcUrl: string,
  actualTiebreaker: number,
  fromBlock?: bigint,
): Promise<ScorerOutput> {
  const { sportId, payoutBps } = await readPoolConfig(poolAddress, rpcUrl);

  const module = SPORT_MODULES[sportId];
  if (!module) throw new Error(`Unknown sportId: "${sportId}". Registered: ${Object.keys(SPORT_MODULES).join(', ')}`);

  const entries = await readEntries(poolAddress, rpcUrl, undefined, fromBlock);
  const results = await readGameResults(poolAddress, rpcUrl);
  const totalPoolValue = await readTotalPoolValue(poolAddress, rpcUrl);

  const scored: ScoredEntry[] = entries.map(e => ({
    ...e,
    score: module.scorePicks(e.picks, results),
    tiebreakerDistance: 0,
    rank: 0,
    prizeAmount: 0n,
  }));

  const ranked = rankEntries(scored, actualTiebreaker);

  const FEE_PERCENT = 500n;
  const BASIS_POINTS = 10000n;
  const fee = totalPoolValue * FEE_PERCENT / BASIS_POINTS;
  const prizePool = totalPoolValue - fee;

  const distributed = distributePrizes(ranked, prizePool, payoutBps);

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
