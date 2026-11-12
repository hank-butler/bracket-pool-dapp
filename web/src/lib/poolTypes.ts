/**
 * Pool type detection based on poolName prefix.
 * Format: "<prefix>:<display name>", e.g. "mm:March Madness 2026"
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

export const POOL_TYPE_PREFIXES: Record<string, PoolTypeConfig> = {
  'mm:': {
    type: 'bracket',
    sport: 'March Madness',
    label: 'NCAA Tournament Bracket',
    tiebreakerLabel: 'Predicted championship total points',
    tiebreakerPlaceholder: 'e.g. 145',
    submitLabel: 'Submit Bracket',
    incompleteLabel: 'Pick all 63 games & set tiebreaker',
    picksUnit: 'games',
  },
  'ipl:': {
    type: 'standings',
    sport: 'IPL',
    label: 'IPL Standings Prediction',
    tiebreakerLabel: 'Predicted total sixes in the tournament',
    tiebreakerPlaceholder: 'e.g. 850',
    submitLabel: 'Submit Prediction',
    incompleteLabel: 'Rank all 10 teams & set tiebreaker',
    picksUnit: 'positions',
  },
  'wc:': {
    type: 'bracket',
    sport: 'World Cup',
    label: 'World Cup Bracket',
    tiebreakerLabel: 'Predicted total goals in the Final',
    tiebreakerPlaceholder: 'e.g. 3',
    submitLabel: 'Submit Bracket',
    incompleteLabel: 'Pick all games & set tiebreaker',
    picksUnit: 'games',
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

// sportId values stored on-chain map to the same configs as name prefixes.
const SPORT_ID_TO_PREFIX: Record<string, string> = {
  mm: 'mm:',
  ipl: 'ipl:',
  wc: 'wc:',
};

/**
 * sportIds the scorer can actually score. MUST match the keys of
 * SPORT_MODULES in scorer/src/pipeline.ts. A pool for any other sport could
 * take entry fees but never be finalized, so the UI refuses to create or
 * accept entries for it. (IPL still uses the legacy ipl-scoring.ts and has no
 * shared/sports module — add 'ipl' here once it does.)
 */
export const SCORABLE_SPORT_IDS: ReadonlySet<string> = new Set(['mm', 'wc']);

/**
 * Resolve the pool type from the on-chain sportId — the same field the scorer
 * routes on — so picker and scorer can never disagree. The poolName prefix is
 * only consulted for legacy pools that predate sportId. Returns null for an
 * unrecognized or unscorable sport: callers must treat the pool as unsupported
 * rather than render a picker whose entries could never be scored.
 */
export function resolvePoolTypeConfig(sportId: string | undefined, poolName: string): PoolTypeConfig | null {
  let id = sportId;
  if (!id) {
    id = Object.keys(SPORT_ID_TO_PREFIX).find((k) => poolName.startsWith(SPORT_ID_TO_PREFIX[k]));
  }
  if (!id || !SCORABLE_SPORT_IDS.has(id)) return null;
  return POOL_TYPE_PREFIXES[SPORT_ID_TO_PREFIX[id]];
}

export function getPoolTypeConfig(poolName: string): PoolTypeConfig {
  for (const prefix of Object.keys(POOL_TYPE_PREFIXES)) {
    if (poolName.startsWith(prefix)) {
      return POOL_TYPE_PREFIXES[prefix];
    }
  }
  return DEFAULT_CONFIG;
}

export function stripPoolNamePrefix(poolName: string): string {
  for (const prefix of Object.keys(POOL_TYPE_PREFIXES)) {
    if (poolName.startsWith(prefix)) {
      return poolName.slice(prefix.length);
    }
  }
  return poolName;
}
