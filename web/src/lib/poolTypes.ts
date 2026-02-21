/**
 * Pool type detection based on gameCount.
 * The contract is sport-agnostic — this mapping is purely a frontend concern.
 */

export type PoolType = 'bracket' | 'standings';

export interface PoolTypeConfig {
  type: PoolType;
  sport: string;
  label: string;
  tiebreakerLabel: string;
  tiebreakerPlaceholder: string;
  submitLabel: string;
  incompleteLabel: string;
  picksUnit: string;
}

const POOL_TYPE_MAP: Record<number, PoolTypeConfig> = {
  63: {
    type: 'bracket',
    sport: 'March Madness',
    label: 'NCAA Tournament Bracket',
    tiebreakerLabel: 'Predicted championship total points',
    tiebreakerPlaceholder: 'e.g. 145',
    submitLabel: 'Submit Bracket',
    incompleteLabel: 'Pick all 63 games & set tiebreaker',
    picksUnit: 'games',
  },
  10: {
    type: 'standings',
    sport: 'IPL',
    label: 'IPL Standings Prediction',
    tiebreakerLabel: 'Predicted total sixes in the tournament',
    tiebreakerPlaceholder: 'e.g. 850',
    submitLabel: 'Submit Prediction',
    incompleteLabel: 'Rank all 10 teams & set tiebreaker',
    picksUnit: 'positions',
  },
};

const DEFAULT_CONFIG: PoolTypeConfig = {
  type: 'bracket',
  sport: 'Unknown',
  label: 'Prediction Pool',
  tiebreakerLabel: 'Tiebreaker value',
  tiebreakerPlaceholder: 'e.g. 100',
  submitLabel: 'Submit Entry',
  incompleteLabel: 'Complete all picks & set tiebreaker',
  picksUnit: 'picks',
};

export function getPoolTypeConfig(gameCount: number): PoolTypeConfig {
  return POOL_TYPE_MAP[gameCount] ?? DEFAULT_CONFIG;
}
