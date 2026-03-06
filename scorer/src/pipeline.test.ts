import { describe, it, expect, vi } from 'vitest';
import { runScorer } from './pipeline';

vi.mock('./reader', () => ({
  readPoolConfig: vi.fn().mockResolvedValue({ sportId: 'mm', payoutBps: [6000, 2500, 1500] }),
  readEntries: vi.fn().mockResolvedValue([
    {
      entryId: 0,
      owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      picks: Array(63).fill('0x' + '1'.repeat(64)),
      tiebreaker: 150n,
      pricePaid: 10_000_000n,
    },
    {
      entryId: 1,
      owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      picks: Array(63).fill('0x' + '2'.repeat(64)),
      tiebreaker: 160n,
      pricePaid: 10_100_000n,
    },
  ]),
  readGameResults: vi.fn().mockResolvedValue(Array(63).fill('0x' + '1'.repeat(64))),
  readTotalPoolValue: vi.fn().mockResolvedValue(20_100_000n),
}));

describe('runScorer', () => {
  it('returns a merkle root and proofs', async () => {
    const output = await runScorer(
      '0x1234567890123456789012345678901234567890',
      'http://localhost:8545',
      155,
    );

    expect(output.merkleRoot).toMatch(/^0x[0-9a-f]{64}$/);
    expect(output.totalEntries).toBe(2);
    expect(output.prizePool).toBeGreaterThan(0n);
    expect(Object.keys(output.proofs).length).toBeGreaterThan(0);
  });

  it('awards prize to the entry with correct picks', async () => {
    const output = await runScorer(
      '0x1234567890123456789012345678901234567890',
      'http://localhost:8545',
      155,
    );

    // Entry 0 picks all '1' team, results are all '1' team — entry 0 should win
    const winner = output.entries.find(e => e.rank === 1);
    expect(winner?.owner).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    expect(winner?.prizeAmount).toBeGreaterThan(0n);
  });
});
