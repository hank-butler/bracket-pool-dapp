import { describe, it, expect } from 'vitest';
import { collectEntries, type EntryScanClient } from '../src/reader';

const POOL = '0x1234567890123456789012345678901234567890' as const;

function makeLog(entryId: number, owner: string) {
  return {
    args: {
      entryId: BigInt(entryId),
      owner,
      picks: ['0x' + '1'.repeat(64)],
      tiebreaker: 100n,
      pricePaid: 10_000_000n,
    },
  };
}

// Fake client: entries live at specific block heights; getLogs honors the
// requested [fromBlock, toBlock] range like a real node.
function makeFakeClient(opts: {
  latest: bigint;
  entryCount: number;
  logsAtBlocks: Array<{ block: bigint; log: ReturnType<typeof makeLog> }>;
  maxRange?: bigint;
}) {
  const calls: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  const client: EntryScanClient = {
    getBlockNumber: async () => opts.latest,
    readContract: async () => BigInt(opts.entryCount),
    getLogs: async ({ fromBlock, toBlock }) => {
      calls.push({ fromBlock, toBlock });
      if (opts.maxRange !== undefined && toBlock - fromBlock + 1n > opts.maxRange) {
        throw new Error('query exceeds max block range');
      }
      return opts.logsAtBlocks
        .filter(e => e.block >= fromBlock && e.block <= toBlock)
        .map(e => e.log);
    },
  };
  return { client, calls };
}

describe('collectEntries', () => {
  it('finds entries older than 30 days of blocks (no silent window cutoff)', async () => {
    // latest = 1,000,000; one entry at block 100 — far outside the old
    // 216,000-block window. Provider caps ranges at 10,000 blocks.
    const { client } = makeFakeClient({
      latest: 1_000_000n,
      entryCount: 2,
      logsAtBlocks: [
        { block: 100n, log: makeLog(0, '0xaaa0000000000000000000000000000000000000') },
        { block: 999_999n, log: makeLog(1, '0xbbb0000000000000000000000000000000000000') },
      ],
      maxRange: 10_000n,
    });

    const entries = await collectEntries(client, POOL);
    expect(entries.map(e => e.entryId)).toEqual([0, 1]);
  });

  it('stops scanning once the on-chain entryCount is matched', async () => {
    const { client, calls } = makeFakeClient({
      latest: 1_000_000n,
      entryCount: 1,
      logsAtBlocks: [{ block: 999_000n, log: makeLog(0, '0xaaa0000000000000000000000000000000000000') }],
      maxRange: 10_000n,
    });

    await collectEntries(client, POOL);
    // Entry sits within the first chunk back from latest — the scan must not
    // walk all 100 chunks to block 0.
    expect(calls.length).toBeLessThan(3);
  });

  it('dedupes duplicate logs by entryId', async () => {
    const dup = makeLog(0, '0xaaa0000000000000000000000000000000000000');
    const { client } = makeFakeClient({
      latest: 5_000n,
      entryCount: 2,
      logsAtBlocks: [
        { block: 10n, log: dup },
        { block: 11n, log: dup },
        { block: 12n, log: makeLog(1, '0xbbb0000000000000000000000000000000000000') },
      ],
    });

    const entries = await collectEntries(client, POOL);
    expect(entries).toHaveLength(2);
  });

  it('throws if the scan cannot account for every on-chain entry', async () => {
    const { client } = makeFakeClient({
      latest: 5_000n,
      entryCount: 3,
      logsAtBlocks: [{ block: 10n, log: makeLog(0, '0xaaa0000000000000000000000000000000000000') }],
    });

    await expect(collectEntries(client, POOL)).rejects.toThrow(/1 of 3/);
  });

  it('returns no entries for an empty pool without scanning logs', async () => {
    const { client, calls } = makeFakeClient({ latest: 5_000n, entryCount: 0, logsAtBlocks: [] });
    const entries = await collectEntries(client, POOL);
    expect(entries).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('respects an explicit fromBlock lower bound', async () => {
    const { client, calls } = makeFakeClient({
      latest: 50_000n,
      entryCount: 1,
      logsAtBlocks: [{ block: 40_000n, log: makeLog(0, '0xaaa0000000000000000000000000000000000000') }],
    });

    await collectEntries(client, POOL, 30_000n);
    expect(calls.every(c => c.fromBlock >= 30_000n)).toBe(true);
  });
});
