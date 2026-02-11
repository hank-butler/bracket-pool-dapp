export function getPointsForGame(gameIndex: number): number {
  if (gameIndex < 0 || gameIndex > 66) throw new Error(`Invalid game index: ${gameIndex}`);
  if (gameIndex < 4) return 5;
  if (gameIndex < 36) return 10;
  if (gameIndex < 52) return 20;
  if (gameIndex < 60) return 40;
  if (gameIndex < 64) return 80;
  if (gameIndex < 66) return 160;
  return 320;
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
