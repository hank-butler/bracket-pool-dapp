import { describe, it, expect } from 'vitest';
import { getPointsForGame, scoreEntry } from '../src/scoring';

describe('getPointsForGame', () => {
  it('returns 5 for First Four (indices 0-3)', () => {
    expect(getPointsForGame(0)).toBe(5);
    expect(getPointsForGame(3)).toBe(5);
  });

  it('returns 10 for Round of 64 (indices 4-35)', () => {
    expect(getPointsForGame(4)).toBe(10);
    expect(getPointsForGame(35)).toBe(10);
  });

  it('returns 20 for Round of 32 (indices 36-51)', () => {
    expect(getPointsForGame(36)).toBe(20);
    expect(getPointsForGame(51)).toBe(20);
  });

  it('returns 40 for Sweet 16 (indices 52-59)', () => {
    expect(getPointsForGame(52)).toBe(40);
    expect(getPointsForGame(59)).toBe(40);
  });

  it('returns 80 for Elite 8 (indices 60-63)', () => {
    expect(getPointsForGame(60)).toBe(80);
    expect(getPointsForGame(63)).toBe(80);
  });

  it('returns 160 for Final Four (indices 64-65)', () => {
    expect(getPointsForGame(64)).toBe(160);
    expect(getPointsForGame(65)).toBe(160);
  });

  it('returns 320 for Championship (index 66)', () => {
    expect(getPointsForGame(66)).toBe(320);
  });

  it('throws for out-of-range index', () => {
    expect(() => getPointsForGame(67)).toThrow();
  });
});

describe('scoreEntry', () => {
  const makeBytes32 = (n: number): `0x${string}` =>
    `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`;

  const makePicks = (count: number, offset = 0): `0x${string}`[] =>
    Array.from({ length: count }, (_, i) => makeBytes32(i + 1 + offset));

  it('perfect bracket = 1940', () => {
    const picks = makePicks(67);
    const results = makePicks(67);
    expect(scoreEntry(picks, results)).toBe(1940);
  });

  it('all wrong = 0', () => {
    const picks = makePicks(67, 0);
    const results = makePicks(67, 100);
    expect(scoreEntry(picks, results)).toBe(0);
  });

  it('only championship correct = 320', () => {
    const picks = makePicks(67, 0);
    const results = makePicks(67, 100);
    results[66] = picks[66];
    expect(scoreEntry(picks, results)).toBe(320);
  });

  it('only First Four correct = 20', () => {
    const picks = makePicks(67, 0);
    const results = makePicks(67, 100);
    results[0] = picks[0];
    results[1] = picks[1];
    results[2] = picks[2];
    results[3] = picks[3];
    expect(scoreEntry(picks, results)).toBe(20);
  });

  it('throws on length mismatch', () => {
    expect(() => scoreEntry(makePicks(10), makePicks(67))).toThrow();
  });
});
