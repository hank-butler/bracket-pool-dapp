import { describe, it, expect } from 'vitest';
import { worldcup2026 } from '../../shared/sports/worldcup2026/scoring';
import { keccak256, toHex } from 'viem';

const t = (code: string) => keccak256(toHex(code)) as `0x${string}`;
const ZERO     = ('0x' + '0'.repeat(64)) as `0x${string}`;
const NO_MATCH = ('0x' + '1'.repeat(64)) as `0x${string}`;

// Results: unset slots are ZERO
function makeResults(overrides: Partial<Record<number, `0x${string}`>> = {}): `0x${string}`[] {
  const arr = new Array(88).fill(ZERO) as `0x${string}`[];
  for (const [i, v] of Object.entries(overrides)) arr[Number(i)] = v;
  return arr;
}

// Picks: unset slots are NO_MATCH so they never accidentally match ZERO results
function makePicks(overrides: Partial<Record<number, `0x${string}`>> = {}): `0x${string}`[] {
  const arr = new Array(88).fill(NO_MATCH) as `0x${string}`[];
  for (const [i, v] of Object.entries(overrides)) arr[Number(i)] = v;
  return arr;
}

describe('worldcup2026.scorePicks — group stage', () => {
  it('scores 10 points for correct 1st place in group A (index 0)', () => {
    expect(worldcup2026.scorePicks(makePicks({ 0: t('BRA') }), makeResults({ 0: t('BRA') }))).toBe(10);
  });

  it('scores 8 points for correct 2nd place in group A (index 1)', () => {
    expect(worldcup2026.scorePicks(makePicks({ 1: t('ARG') }), makeResults({ 1: t('ARG') }))).toBe(8);
  });

  it('scores 5 points for correct 3rd place in group A (index 2)', () => {
    expect(worldcup2026.scorePicks(makePicks({ 2: t('FRA') }), makeResults({ 2: t('FRA') }))).toBe(5);
  });

  it('scores 3 points for correct 4th place in group A (index 3)', () => {
    expect(worldcup2026.scorePicks(makePicks({ 3: t('ENG') }), makeResults({ 3: t('ENG') }))).toBe(3);
  });

  it('scores 10 points for 1st place in group B (index 4)', () => {
    expect(worldcup2026.scorePicks(makePicks({ 4: t('GER') }), makeResults({ 4: t('GER') }))).toBe(10);
  });

  it('scores 5 points for correct advancing 3rd-place team (index 48)', () => {
    expect(worldcup2026.scorePicks(makePicks({ 48: t('SEN') }), makeResults({ 48: t('SEN') }))).toBe(5);
  });

  it('scores 0 for wrong pick', () => {
    expect(worldcup2026.scorePicks(makePicks({ 0: t('ARG') }), makeResults({ 0: t('BRA') }))).toBe(0);
  });
});

describe('worldcup2026.scorePicks — knockout stage', () => {
  it('scores 10 points for correct R32 team (index 56)', () => {
    expect(worldcup2026.scorePicks(makePicks({ 56: t('BRA') }), makeResults({ 56: t('BRA') }))).toBe(10);
  });

  it('scores 20 points for correct QF team (index 72)', () => {
    expect(worldcup2026.scorePicks(makePicks({ 72: t('BRA') }), makeResults({ 72: t('BRA') }))).toBe(20);
  });

  it('scores 40 points for correct SF team (index 80)', () => {
    expect(worldcup2026.scorePicks(makePicks({ 80: t('BRA') }), makeResults({ 80: t('BRA') }))).toBe(40);
  });

  it('scores 80 points for correct finalist (index 84)', () => {
    expect(worldcup2026.scorePicks(makePicks({ 84: t('BRA') }), makeResults({ 84: t('BRA') }))).toBe(80);
  });

  it('scores 100 points for correct winner (index 86)', () => {
    expect(worldcup2026.scorePicks(makePicks({ 86: t('BRA') }), makeResults({ 86: t('BRA') }))).toBe(100);
  });

  it('scores 40 points for correct 3rd place winner (index 87)', () => {
    expect(worldcup2026.scorePicks(makePicks({ 87: t('NED') }), makeResults({ 87: t('NED') }))).toBe(40);
  });
});

describe('worldcup2026.scorePicks — perfect score', () => {
  it('perfect picks score 1132', () => {
    const perfect = makePicks();
    for (let i = 0; i < 88; i++) {
      perfect[i] = t(`TEAM${i}`);
    }
    expect(worldcup2026.scorePicks(perfect, perfect)).toBe(1132);
  });
});

describe('worldcup2026.validatePicks', () => {
  it('rejects picks with wrong length', () => {
    expect(worldcup2026.validatePicks(new Array(87).fill(ZERO) as `0x${string}`[])).toBe(false);
    expect(worldcup2026.validatePicks(new Array(89).fill(ZERO) as `0x${string}`[])).toBe(false);
  });

  it('accepts picks with correct length', () => {
    expect(worldcup2026.validatePicks(new Array(88).fill(ZERO) as `0x${string}`[])).toBe(true);
  });
});
