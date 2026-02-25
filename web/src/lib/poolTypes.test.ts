import { describe, it, expect } from 'vitest';
import { getPoolTypeConfig } from './poolTypes';

describe('getPoolTypeConfig', () => {
  it('returns March Madness config for mm: prefix', () => {
    const config = getPoolTypeConfig('mm:March Madness 2026');
    expect(config.sport).toBe('March Madness');
    expect(config.type).toBe('bracket');
  });

  it('returns IPL config for ipl: prefix', () => {
    const config = getPoolTypeConfig('ipl:IPL 2025');
    expect(config.sport).toBe('IPL');
    expect(config.type).toBe('standings');
  });

  it('returns World Cup config for wc: prefix', () => {
    const config = getPoolTypeConfig('wc:World Cup 2026');
    expect(config.sport).toBe('World Cup');
    expect(config.type).toBe('bracket');
  });

  it('returns default config for unknown prefix', () => {
    const config = getPoolTypeConfig('Some Pool Without Prefix');
    expect(config.sport).toBe('Unknown');
  });

  it('returns default config for empty string', () => {
    const config = getPoolTypeConfig('');
    expect(config.sport).toBe('Unknown');
  });
});

describe('stripPoolNamePrefix', () => {
  it('strips known prefix', () => {
    const { stripPoolNamePrefix } = require('./poolTypes');
    expect(stripPoolNamePrefix('mm:March Madness 2026')).toBe('March Madness 2026');
  });

  it('returns name unchanged if no prefix', () => {
    const { stripPoolNamePrefix } = require('./poolTypes');
    expect(stripPoolNamePrefix('Some Pool')).toBe('Some Pool');
  });
});
