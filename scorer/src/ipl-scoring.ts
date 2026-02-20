/**
 * IPL Standings Scoring
 *
 * Picks and results are both arrays of team IDs ordered by position (index 0 = 1st place).
 * Scoring is position-distance based:
 *   - For each team in the results, find where the user predicted them.
 *   - Points = max(0, teamCount - |predictedPosition - actualPosition|)
 *   - Exact position match: teamCount points (10 for IPL)
 *   - Off by 1: 9 points
 *   - Off by N: max(0, 10 - N) points
 *
 * Perfect score for 10-team IPL: 100 (all 10 exact)
 */

export function getPointsForPosition(
  predictedPosition: number,
  actualPosition: number,
  teamCount: number,
): number {
  const distance = Math.abs(predictedPosition - actualPosition);
  return Math.max(0, teamCount - distance);
}

export function scoreStandingsEntry(
  picks: `0x${string}`[],
  results: `0x${string}`[],
): number {
  if (picks.length !== results.length) {
    throw new Error(`Length mismatch: picks=${picks.length}, results=${results.length}`);
  }

  const teamCount = results.length;
  let score = 0;

  for (let actualPos = 0; actualPos < teamCount; actualPos++) {
    const teamId = results[actualPos].toLowerCase();
    const predictedPos = picks.findIndex(
      (p) => p.toLowerCase() === teamId,
    );

    if (predictedPos !== -1) {
      score += getPointsForPosition(predictedPos, actualPos, teamCount);
    }
  }

  return score;
}

/** Perfect score when all teams predicted in exact positions */
export function perfectScore(teamCount: number): number {
  return teamCount * teamCount;
}
