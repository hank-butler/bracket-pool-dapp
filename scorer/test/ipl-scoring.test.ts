import { describe, it, expect } from 'vitest';
import { getPointsForPosition, scoreStandingsEntry, perfectScore } from '../src/ipl-scoring';

const makeBytes32 = (n: number): `0x${string}` =>
  `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`;

describe('getPointsForPosition', () => {
  const teamCount = 10;

  it('exact match gives teamCount points', () => {
    expect(getPointsForPosition(0, 0, teamCount)).toBe(10);
    expect(getPointsForPosition(5, 5, teamCount)).toBe(10);
    expect(getPointsForPosition(9, 9, teamCount)).toBe(10);
  });

  it('off by 1 gives teamCount - 1 points', () => {
    expect(getPointsForPosition(0, 1, teamCount)).toBe(9);
    expect(getPointsForPosition(3, 2, teamCount)).toBe(9);
  });

  it('off by 5 gives 5 points', () => {
    expect(getPointsForPosition(0, 5, teamCount)).toBe(5);
  });

  it('off by teamCount gives 0 points', () => {
    expect(getPointsForPosition(0, 10, teamCount)).toBe(0);
  });

  it('large distance gives 0 points', () => {
    expect(getPointsForPosition(0, 15, teamCount)).toBe(0);
  });
});

describe('scoreStandingsEntry', () => {
  it('perfect prediction = 100 for 10 teams', () => {
    const teams = Array.from({ length: 10 }, (_, i) => makeBytes32(i + 1));
    expect(scoreStandingsEntry(teams, teams)).toBe(100);
  });

  it('completely reversed prediction gives partial credit', () => {
    const results = Array.from({ length: 10 }, (_, i) => makeBytes32(i + 1));
    const picks = [...results].reverse();
    // Each team is off by: 9, 7, 5, 3, 1, 1, 3, 5, 7, 9
    // Points:              1, 3, 5, 7, 9, 9, 7, 5, 3, 1 = 50
    expect(scoreStandingsEntry(picks, results)).toBe(50);
  });

  it('all wrong teams = 0', () => {
    const picks = Array.from({ length: 10 }, (_, i) => makeBytes32(i + 1));
    const results = Array.from({ length: 10 }, (_, i) => makeBytes32(i + 100));
    expect(scoreStandingsEntry(picks, results)).toBe(0);
  });

  it('single swap from perfect loses minimal points', () => {
    // Perfect except positions 0 and 1 are swapped
    const results = Array.from({ length: 10 }, (_, i) => makeBytes32(i + 1));
    const picks = [...results];
    [picks[0], picks[1]] = [picks[1], picks[0]];
    // Two teams each off by 1: 9 + 9 = 18, rest exact: 8 * 10 = 80
    // Total = 98
    expect(scoreStandingsEntry(picks, results)).toBe(98);
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
    const lower = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`;
    const upper = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`;
    const results = [lower, makeBytes32(2), makeBytes32(3)];
    const picks = [upper, makeBytes32(2), makeBytes32(3)];
    expect(scoreStandingsEntry(picks, results)).toBe(9); // 3 * 3
  });
});

describe('perfectScore', () => {
  it('returns 100 for 10 teams', () => {
    expect(perfectScore(10)).toBe(100);
  });

  it('returns 64 for 8 teams', () => {
    expect(perfectScore(8)).toBe(64);
  });
});
