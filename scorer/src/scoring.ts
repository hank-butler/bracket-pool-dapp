// Re-export from shared for backwards compatibility
export { marchmadness } from '../../shared/sports/marchmadness/scoring';

// Keep scoreEntry and getPointsForGame as named exports for any direct callers
import { marchmadness } from '../../shared/sports/marchmadness/scoring';
export const scoreEntry = marchmadness.scorePicks.bind(marchmadness);
export function getPointsForGame(gameIndex: number): number {
  if (gameIndex < 0 || gameIndex > 62) throw new Error(`Invalid game index: ${gameIndex}`);
  if (gameIndex < 32) return 10;
  if (gameIndex < 48) return 20;
  if (gameIndex < 56) return 40;
  if (gameIndex < 60) return 80;
  if (gameIndex < 62) return 160;
  return 320;
}
