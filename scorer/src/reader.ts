import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { sepolia, mainnet } from 'viem/chains';
import type { RawEntry } from './types';

const ENTRY_SUBMITTED_EVENT = parseAbiItem(
  'event EntrySubmitted(uint256 indexed entryId, address indexed owner, bytes32[] picks, uint256 tiebreaker, uint256 pricePaid)'
);

// Keep each getLogs range small enough for common RPC provider caps.
const LOG_CHUNK_SIZE = 10_000n;

const ENTRY_COUNT_ABI = [
  {
    name: 'entryCount',
    type: 'function' as const,
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view' as const,
  },
] as const;

interface EntryLog {
  args: {
    entryId?: bigint;
    owner?: string;
    picks?: readonly string[];
    tiebreaker?: bigint;
    pricePaid?: bigint;
  };
}

// Minimal client surface so the scan logic is testable without a live node.
export interface EntryScanClient {
  getBlockNumber(): Promise<bigint>;
  getLogs(args: {
    address: Address;
    event: typeof ENTRY_SUBMITTED_EVENT;
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<EntryLog[]>;
  readContract(args: {
    address: Address;
    abi: typeof ENTRY_COUNT_ABI;
    functionName: 'entryCount';
  }): Promise<unknown>;
}

// Scans backward from the latest block in LOG_CHUNK_SIZE windows until every
// on-chain entry is accounted for. The entryCount cross-check means a too-
// narrow scan can never silently drop entries (which would mis-rank the pool
// and strand a dropped winner's prize).
export async function collectEntries(
  client: EntryScanClient,
  poolAddress: Address,
  fromBlock?: bigint,
): Promise<RawEntry[]> {
  const expected = Number(
    await client.readContract({ address: poolAddress, abi: ENTRY_COUNT_ABI, functionName: 'entryCount' }),
  );
  if (expected === 0) return [];

  const latest = await client.getBlockNumber();
  const lowest = fromBlock ?? 0n;
  const byId = new Map<number, RawEntry>();

  let hi = latest;
  while (hi >= lowest && byId.size < expected) {
    const lo = hi - lowest + 1n > LOG_CHUNK_SIZE ? hi - LOG_CHUNK_SIZE + 1n : lowest;
    const logs = await client.getLogs({
      address: poolAddress,
      event: ENTRY_SUBMITTED_EVENT,
      fromBlock: lo,
      toBlock: hi,
    });
    for (const log of logs) {
      byId.set(Number(log.args.entryId!), {
        entryId: Number(log.args.entryId!),
        owner: log.args.owner! as Address,
        picks: log.args.picks! as `0x${string}`[],
        tiebreaker: log.args.tiebreaker!,
        pricePaid: log.args.pricePaid!,
      });
    }
    if (lo === lowest) break;
    hi = lo - 1n;
  }

  if (byId.size !== expected) {
    throw new Error(
      `Entry scan found ${byId.size} of ${expected} entries for pool ${poolAddress}. ` +
        `Check the fromBlock lower bound (${lowest}) and RPC log availability.`,
    );
  }

  return [...byId.values()].sort((a, b) => a.entryId - b.entryId);
}

export async function readEntries(
  poolAddress: Address,
  rpcUrl: string,
  chainId: number = 11155111, // Sepolia default
  fromBlock?: bigint,
): Promise<RawEntry[]> {
  const chain = chainId === 1 ? mainnet : sepolia;
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  return collectEntries(client as unknown as EntryScanClient, poolAddress, fromBlock);
}

export async function readGameResults(
  poolAddress: Address,
  rpcUrl: string,
  chainId: number = 11155111,
): Promise<`0x${string}`[]> {
  const chain = chainId === 1 ? mainnet : sepolia;
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  const BRACKET_POOL_ABI = [
    {
      name: 'getGameResults',
      type: 'function' as const,
      inputs: [],
      outputs: [{ name: '', type: 'bytes32[]' }],
      stateMutability: 'view' as const,
    },
  ] as const;

  const results = await client.readContract({
    address: poolAddress,
    abi: BRACKET_POOL_ABI,
    functionName: 'getGameResults',
  });

  return results as `0x${string}`[];
}

export async function readPoolConfig(
  poolAddress: Address,
  rpcUrl: string,
  chainId: number = 11155111,
): Promise<{ sportId: string; payoutBps: number[] }> {
  const chain = chainId === 1 ? mainnet : sepolia;
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  const ABI = [
    {
      name: 'sportId',
      type: 'function' as const,
      inputs: [],
      outputs: [{ name: '', type: 'string' }],
      stateMutability: 'view' as const,
    },
    {
      name: 'getPayoutBps',
      type: 'function' as const,
      inputs: [],
      outputs: [{ name: '', type: 'uint16[]' }],
      stateMutability: 'view' as const,
    },
  ] as const;

  const [sportId, payoutBps] = await Promise.all([
    client.readContract({ address: poolAddress, abi: ABI, functionName: 'sportId' }),
    client.readContract({ address: poolAddress, abi: ABI, functionName: 'getPayoutBps' }),
  ]);

  return {
    sportId: sportId as string,
    payoutBps: (payoutBps as readonly number[]).map(Number),
  };
}

export async function readTotalPoolValue(
  poolAddress: Address,
  rpcUrl: string,
  chainId: number = 11155111,
): Promise<bigint> {
  const chain = chainId === 1 ? mainnet : sepolia;
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  const ABI = [
    {
      name: 'totalPoolValue',
      type: 'function' as const,
      inputs: [],
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view' as const,
    },
  ] as const;

  return await client.readContract({
    address: poolAddress,
    abi: ABI,
    functionName: 'totalPoolValue',
  });
}
