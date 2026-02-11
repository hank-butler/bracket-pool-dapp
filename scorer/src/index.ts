import { readEntries, readGameResults, readTotalPoolValue } from './reader';
import { scoreEntry } from './scoring';
import { rankEntries, distributePrizes } from './ranking';
import { buildMerkleTree } from './merkle';
import type { ScoredEntry, ScorerOutput } from './types';
import type { Address } from 'viem';
import * as fs from 'fs';

async function main() {
  const poolAddress = process.argv[2] as Address;
  const rpcUrl = process.argv[3];
  const actualTiebreaker = parseInt(process.argv[4], 10);

  if (!poolAddress || !rpcUrl || isNaN(actualTiebreaker)) {
    console.error('Usage: tsx src/index.ts <poolAddress> <rpcUrl> <actualTiebreaker>');
    process.exit(1);
  }

  console.log(`Scoring pool: ${poolAddress}`);
  console.log(`Actual tiebreaker: ${actualTiebreaker}`);

  // 1. Read data from chain
  const entries = await readEntries(poolAddress, rpcUrl);
  const results = await readGameResults(poolAddress, rpcUrl);
  const totalPoolValue = await readTotalPoolValue(poolAddress, rpcUrl);

  console.log(`Found ${entries.length} entries`);
  console.log(`Total pool value: ${totalPoolValue}`);

  // 2. Score all entries
  const scored: ScoredEntry[] = entries.map(e => ({
    ...e,
    score: scoreEntry(e.picks, results),
    tiebreakerDistance: 0,
    rank: 0,
    prizeAmount: 0n,
  }));

  // 3. Rank entries
  const ranked = rankEntries(scored, actualTiebreaker);

  // 4. Calculate prize pool using same formula as contract
  // Must match BracketPool.sol: totalPoolValue * FEE_PERCENT / BASIS_POINTS
  const FEE_PERCENT = 500n;
  const BASIS_POINTS = 10000n;
  const fee = totalPoolValue * FEE_PERCENT / BASIS_POINTS;
  const prizePool = totalPoolValue - fee;
  console.log(`Fee: ${fee}, Prize pool: ${prizePool}`);

  // 5. Distribute prizes
  const distributed = distributePrizes(ranked, prizePool);

  // 6. Build Merkle tree (only for winners with prize > 0)
  const winners = distributed
    .filter(e => e.prizeAmount > 0n)
    .map(e => ({
      owner: e.owner,
      entryId: e.entryId,
      amount: e.prizeAmount,
    }));

  const { root, proofs } = buildMerkleTree(winners);

  console.log(`Merkle root: ${root}`);
  console.log(`Winners: ${winners.length}`);

  // 7. Output JSON
  const output: ScorerOutput = {
    poolAddress,
    merkleRoot: root,
    totalEntries: entries.length,
    prizePool,
    entries: distributed,
    proofs,
  };

  const outputPath = `output-${poolAddress.slice(0, 10)}.json`;
  fs.writeFileSync(
    outputPath,
    JSON.stringify(output, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2),
  );
  console.log(`Output written to ${outputPath}`);
  console.log('\nNext steps:');
  console.log(`1. Admin calls setMerkleRoot("${root}")`);
  console.log(`2. Verify: balanceOf(pool) == sum(prizeAmounts) = ${winners.reduce((s, w) => s + w.amount, 0n)}`);
  console.log('3. Pin output JSON to IPFS');
  console.log('4. Admin calls setProofsCID(cid)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
