/**
 * IPL Standings Scoring
 *
 * Picks and results are both arrays of team IDs ordered by position (index 0 = 1st place).
 *
 * Scoring has two layers:
 *
 * 1. BASE POSITION ACCURACY — for each team:
 *    points = max(0, teamCount - |predictedPosition - actualPosition|)
 *    Exact = 10, off by 1 = 9, ..., off by 10 = 0.
 *    Max base score: 100 (all 10 exact)
 *
 * 2. BONUSES — rewards for nailing the positions that matter:
 *    - Champion bonus:  +20 if predicted 1st matches actual 1st
 *    - Runner-up bonus: +10 if predicted 2nd matches actual 2nd
 *    - Top-4 bonus:     +5 for each team predicted in top 4 that actually finished top 4
 *                        (regardless of exact position within top 4)
 *    Max bonus: 20 + 10 + 20 = 50
 *
 * Perfect score for 10-team IPL: 100 + 50 = 150
 */

const CHAMPION_BONUS = 20;
const RUNNER_UP_BONUS = 10;
const TOP_4_BONUS = 5;
const PLAYOFF_CUTOFF = 4;

export function getBasePoints(
  predictedPosition: number,
  actualPosition: number,
  teamCount: number,
): number {
  const distance = Math.abs(predictedPosition - actualPosition);
  return Math.max(0, teamCount - distance);
}

export interface StandingsScoreBreakdown {
  baseScore: number;
  championBonus: number;
  runnerUpBonus: number;
  top4Bonus: number;
  total: number;
}

export function scoreStandingsEntry(
  picks: `0x${string}`[],
  results: `0x${string}`[],
): number {
  return scoreStandingsEntryDetailed(picks, results).total;
}

export function scoreStandingsEntryDetailed(
  picks: `0x${string}`[],
  results: `0x${string}`[],
): StandingsScoreBreakdown {
  if (picks.length !== results.length) {
    throw new Error(`Length mismatch: picks=${picks.length}, results=${results.length}`);
  }

  const teamCount = results.length;
  let baseScore = 0;

  // Base distance scoring
  for (let actualPos = 0; actualPos < teamCount; actualPos++) {
    const teamId = results[actualPos].toLowerCase();
    const predictedPos = picks.findIndex(
      (p) => p.toLowerCase() === teamId,
    );

    if (predictedPos !== -1) {
      baseScore += getBasePoints(predictedPos, actualPos, teamCount);
    }
  }

  // Champion bonus: predicted 1st == actual 1st
  const championBonus =
    picks[0]?.toLowerCase() === results[0]?.toLowerCase() ? CHAMPION_BONUS : 0;

  // Runner-up bonus: predicted 2nd == actual 2nd
  const runnerUpBonus =
    picks[1]?.toLowerCase() === results[1]?.toLowerCase() ? RUNNER_UP_BONUS : 0;

  // Top-4 bonus: for each team you predicted in top 4 that actually finished top 4
  const actualTop4 = new Set(
    results.slice(0, PLAYOFF_CUTOFF).map((r) => r.toLowerCase()),
  );
  const predictedTop4 = picks.slice(0, PLAYOFF_CUTOFF).map((p) => p.toLowerCase());
  const top4Bonus = predictedTop4.filter((p) => actualTop4.has(p)).length * TOP_4_BONUS;

  const total = baseScore + championBonus + runnerUpBonus + top4Bonus;

  return { baseScore, championBonus, runnerUpBonus, top4Bonus, total };
}

/** Perfect score for a given team count (with IPL bonuses) */
export function perfectScore(teamCount: number): number {
  const basePerfect = teamCount * teamCount;
  const bonusPerfect = CHAMPION_BONUS + RUNNER_UP_BONUS + Math.min(teamCount, PLAYOFF_CUTOFF) * TOP_4_BONUS;
  return basePerfect + bonusPerfect;
}
