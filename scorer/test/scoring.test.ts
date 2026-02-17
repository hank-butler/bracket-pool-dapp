import { describe, it, expect } from 'vitest';
import { getPointsForGame, scoreEntry } from '../src/scoring';

describe('getPointsForGame', () => {
  it('returns 10 for Round of 64 (indices 0-31)', () => {
    expect(getPointsForGame(0)).toBe(10);
    expect(getPointsForGame(31)).toBe(10);
  });

  it('returns 20 for Round of 32 (indices 32-47)', () => {
    expect(getPointsForGame(32)).toBe(20);
    expect(getPointsForGame(47)).toBe(20);
  });

  it('returns 40 for Sweet 16 (indices 48-55)', () => {
    expect(getPointsForGame(48)).toBe(40);
    expect(getPointsForGame(55)).toBe(40);
  });

  it('returns 80 for Elite 8 (indices 56-59)', () => {
    expect(getPointsForGame(56)).toBe(80);
    expect(getPointsForGame(59)).toBe(80);
  });

  it('returns 160 for Final Four (indices 60-61)', () => {
    expect(getPointsForGame(60)).toBe(160);
    expect(getPointsForGame(61)).toBe(160);
  });

  it('returns 320 for Championship (index 62)', () => {
    expect(getPointsForGame(62)).toBe(320);
  });

  it('throws for out-of-range index', () => {
    expect(() => getPointsForGame(63)).toThrow();
    expect(() => getPointsForGame(-1)).toThrow();
  });
});

describe('scoreEntry', () => {
  const makeBytes32 = (n: number): `0x${string}` =>
    `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`;

  const makePicks = (count: number, offset = 0): `0x${string}`[] =>
    Array.from({ length: count }, (_, i) => makeBytes32(i + 1 + offset));

  it('perfect bracket = 1920', () => {
    const picks = makePicks(63);
    const results = makePicks(63);
    expect(scoreEntry(picks, results)).toBe(1920);
  });

  it('all wrong = 0', () => {
    const picks = makePicks(63, 0);
    const results = makePicks(63, 100);
    expect(scoreEntry(picks, results)).toBe(0);
  });

  it('only championship correct = 320', () => {
    const picks = makePicks(63, 0);
    const results = makePicks(63, 100);
    results[62] = picks[62];
    expect(scoreEntry(picks, results)).toBe(320);
  });

  it('throws on length mismatch', () => {
    expect(() => scoreEntry(makePicks(10), makePicks(63))).toThrow();
  });
});
