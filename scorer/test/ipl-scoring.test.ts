import { describe, it, expect } from 'vitest';
import {
  getBasePoints,
  scoreStandingsEntry,
  scoreStandingsEntryDetailed,
  perfectScore,
} from '../src/ipl-scoring';

const makeBytes32 = (n: number): `0x${string}` =>
  `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`;

describe('getBasePoints', () => {
  const teamCount = 10;

  it('exact match gives teamCount points', () => {
    expect(getBasePoints(0, 0, teamCount)).toBe(10);
    expect(getBasePoints(5, 5, teamCount)).toBe(10);
    expect(getBasePoints(9, 9, teamCount)).toBe(10);
  });

  it('off by 1 gives teamCount - 1 points', () => {
    expect(getBasePoints(0, 1, teamCount)).toBe(9);
    expect(getBasePoints(3, 2, teamCount)).toBe(9);
  });

  it('off by 5 gives 5 points', () => {
    expect(getBasePoints(0, 5, teamCount)).toBe(5);
  });

  it('off by teamCount gives 0 points', () => {
    expect(getBasePoints(0, 10, teamCount)).toBe(0);
  });

  it('large distance gives 0 points', () => {
    expect(getBasePoints(0, 15, teamCount)).toBe(0);
  });
});

describe('scoreStandingsEntry', () => {
  it('perfect prediction = 150 for 10 teams', () => {
    // Base: 100, Champion: +20, Runner-up: +10, Top-4: +20
    const teams = Array.from({ length: 10 }, (_, i) => makeBytes32(i + 1));
    expect(scoreStandingsEntry(teams, teams)).toBe(150);
  });

  it('completely reversed prediction = 50 (base only, no bonuses)', () => {
    const results = Array.from({ length: 10 }, (_, i) => makeBytes32(i + 1));
    const picks = [...results].reverse();
    // Base: distances are 9,7,5,3,1,1,3,5,7,9 → points 1+3+5+7+9+9+7+5+3+1 = 50
    // Champion: picks[0] = team 10, results[0] = team 1 → no bonus
    // Runner-up: picks[1] = team 9, results[1] = team 2 → no bonus
    // Top-4: predicted top 4 = {10,9,8,7}, actual top 4 = {1,2,3,4} → 0 overlap
    const detail = scoreStandingsEntryDetailed(picks, results);
    expect(detail.baseScore).toBe(50);
    expect(detail.championBonus).toBe(0);
    expect(detail.runnerUpBonus).toBe(0);
    expect(detail.top4Bonus).toBe(0);
    expect(detail.total).toBe(50);
  });

  it('all wrong teams = 0', () => {
    const picks = Array.from({ length: 10 }, (_, i) => makeBytes32(i + 1));
    const results = Array.from({ length: 10 }, (_, i) => makeBytes32(i + 100));
    expect(scoreStandingsEntry(picks, results)).toBe(0);
  });

  it('champion+runner-up swap loses bonuses but keeps partial base', () => {
    // Perfect except positions 0 and 1 are swapped
    const results = Array.from({ length: 10 }, (_, i) => makeBytes32(i + 1));
    const picks = [...results];
    [picks[0], picks[1]] = [picks[1], picks[0]];
    // Base: two teams each off by 1 (9+9) + 8 exact (8*10) = 98
    // Champion: picks[0]=team2 vs results[0]=team1 → no bonus
    // Runner-up: picks[1]=team1 vs results[1]=team2 → no bonus
    // Top-4: predicted top 4 = {2,1,3,4}, actual top 4 = {1,2,3,4} → all 4 match → +20
    const detail = scoreStandingsEntryDetailed(picks, results);
    expect(detail.baseScore).toBe(98);
    expect(detail.championBonus).toBe(0);
    expect(detail.runnerUpBonus).toBe(0);
    expect(detail.top4Bonus).toBe(20);
    expect(detail.total).toBe(118);
  });

  it('correct champion only gets champion + top-4 bonus', () => {
    // Shift all positions by 1, except champion stays correct
    const results = Array.from({ length: 10 }, (_, i) => makeBytes32(i + 1));
    // Champion correct, rest shifted: [1, 3, 4, 5, 6, 7, 8, 9, 10, 2]
    const picks = [
      makeBytes32(1), makeBytes32(3), makeBytes32(4), makeBytes32(5),
      makeBytes32(6), makeBytes32(7), makeBytes32(8), makeBytes32(9),
      makeBytes32(10), makeBytes32(2),
    ];
    const detail = scoreStandingsEntryDetailed(picks, results);
    expect(detail.championBonus).toBe(20);
    expect(detail.runnerUpBonus).toBe(0);
    // Predicted top 4: {1,3,4,5}, actual top 4: {1,2,3,4} → overlap = {1,3,4} = 3 teams
    expect(detail.top4Bonus).toBe(15);
  });

  it('identifies all 4 playoff teams even if shuffled within top 4', () => {
    const results = Array.from({ length: 10 }, (_, i) => makeBytes32(i + 1));
    // Top 4 reversed: [4,3,2,1, 5,6,7,8,9,10]
    const picks = [
      makeBytes32(4), makeBytes32(3), makeBytes32(2), makeBytes32(1),
      makeBytes32(5), makeBytes32(6), makeBytes32(7), makeBytes32(8),
      makeBytes32(9), makeBytes32(10),
    ];
    const detail = scoreStandingsEntryDetailed(picks, results);
    // Top-4 bonus: predicted {4,3,2,1}, actual {1,2,3,4} → all 4 match
    expect(detail.top4Bonus).toBe(20);
    // Champion: picks[0]=4 vs results[0]=1 → no
    expect(detail.championBonus).toBe(0);
    // Base: teams 1&4 off by 3 (7+7), teams 2&3 off by 1 (9+9), rest exact (6*10=60) → 92
    expect(detail.baseScore).toBe(92);
    expect(detail.total).toBe(112);
  });

  it('throws on length mismatch', () => {
    expect(() =>
      scoreStandingsEntry(
        Array.from({ length: 5 }, (_, i) => makeBytes32(i)),
        Array.from({ length: 10 }, (_, i) => makeBytes32(i)),
      ),
    ).toThrow();
  });

  it('works with case-insensitive comparison', () => {
    const id = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`;
    const results = [id, makeBytes32(2), makeBytes32(3)];
    const picks = [id, makeBytes32(2), makeBytes32(3)];
    // Base: 3*3 = 9, Champion: +20, Runner-up: +10, Top-4 bonus: 3 teams (all in top 3 < 4) → +15
    const detail = scoreStandingsEntryDetailed(picks, results);
    expect(detail.baseScore).toBe(9);
    expect(detail.championBonus).toBe(20);
    expect(detail.runnerUpBonus).toBe(10);
    expect(detail.top4Bonus).toBe(15);
    expect(detail.total).toBe(54);
  });
});

describe('perfectScore', () => {
  it('returns 150 for 10 teams', () => {
    // Base: 100 + Champion: 20 + Runner-up: 10 + Top-4: 20 = 150
    expect(perfectScore(10)).toBe(150);
  });

  it('returns 94 for 8 teams', () => {
    // Base: 64 + Champion: 20 + Runner-up: 10 + Top-4: 4*5=20 = 114
    expect(perfectScore(8)).toBe(114);
  });

  it('returns 36 for 3 teams', () => {
    // Base: 9 + Champion: 20 + Runner-up: 10 + Top-4: 3*5=15 = 54
    expect(perfectScore(3)).toBe(54);
  });
});
