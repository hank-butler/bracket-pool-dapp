export interface RawEntry {
  entryId: number;
  owner: string;
  picks: `0x${string}`[];
  tiebreaker: bigint;
  pricePaid: bigint;
}

export interface ScoredEntry extends RawEntry {
  score: number;
  tiebreakerDistance: number;
  rank: number;
  prizeAmount: bigint;
}

export interface ScorerOutput {
  poolAddress: string;
  merkleRoot: string;
  totalEntries: number;
  prizePool: bigint;
  entries: ScoredEntry[];
  proofs: Record<number, string[]>;
}
