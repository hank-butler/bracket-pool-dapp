export function getPointsForGame(gameIndex: number): number {
  if (gameIndex < 0 || gameIndex > 62) throw new Error(`Invalid game index: ${gameIndex}`);
  if (gameIndex < 32) return 10;   // Round of 64
  if (gameIndex < 48) return 20;   // Round of 32
  if (gameIndex < 56) return 40;   // Sweet 16
  if (gameIndex < 60) return 80;   // Elite 8
  if (gameIndex < 62) return 160;  // Final Four
  return 320;                       // Championship
}

export function scoreEntry(picks: `0x${string}`[], results: `0x${string}`[]): number {
  if (picks.length !== results.length) {
    throw new Error(`Length mismatch: picks=${picks.length}, results=${results.length}`);
  }

  let score = 0;
  for (let i = 0; i < picks.length; i++) {
    if (picks[i].toLowerCase() === results[i].toLowerCase()) {
      score += getPointsForGame(i);
    }
  }
  return score;
}
