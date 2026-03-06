import type { SportModule } from '../interface';
import { ALL_WC_TEAMS } from './teams';

// Index layout for the 88-slot picks array:
// 0–47:   Group stage order — 4 slots per group × 12 groups (pos 0=1st, 1=2nd, 2=3rd, 3=4th)
// 48–55:  8 advancing 3rd-place teams
// 56–71:  Round of 32 (16 teams)
// 72–79:  Quarterfinals (8 teams)
// 80–83:  Semifinals (4 teams)
// 84–85:  Finalists (2 teams)
// 86:     Winner
// 87:     3rd place match winner

function getPointsForIndex(i: number): number {
  if (i < 48) {
    const posInGroup = i % 4;
    if (posInGroup === 0) return 10; // 1st
    if (posInGroup === 1) return 8;  // 2nd
    if (posInGroup === 2) return 5;  // 3rd
    return 3;                         // 4th
  }
  if (i < 56) return 5;   // advancing 3rd-place
  if (i < 72) return 10;  // R32
  if (i < 80) return 20;  // QF
  if (i < 84) return 40;  // SF
  if (i < 86) return 80;  // Finalist
  if (i === 86) return 100; // Winner
  if (i === 87) return 40;  // 3rd place
  throw new Error(`Invalid index: ${i}`);
}

export const worldcup2026: SportModule = {
  sportKey: 'wc',
  gameCount: 88,

  scorePicks(picks, results) {
    if (picks.length !== 88 || results.length !== 88) {
      throw new Error(`Expected 88 picks/results, got picks=${picks.length} results=${results.length}`);
    }
    let score = 0;
    for (let i = 0; i < 88; i++) {
      if (picks[i].toLowerCase() === results[i].toLowerCase()) {
        score += getPointsForIndex(i);
      }
    }
    return score;
  },

  validatePicks(picks) {
    return picks.length === 88;
  },

  getTeams() {
    return ALL_WC_TEAMS;
  },
};
