import { runScorer } from './pipeline';
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
  const output = await runScorer(poolAddress, rpcUrl, actualTiebreaker);

  const outputPath = `output-${poolAddress.slice(0, 10)}.json`;
  fs.writeFileSync(
    outputPath,
    JSON.stringify(output, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2),
  );
  console.log(`Output written to ${outputPath}`);
  console.log(`Merkle root: ${output.merkleRoot}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
