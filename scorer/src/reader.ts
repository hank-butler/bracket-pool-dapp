import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { sepolia, mainnet } from 'viem/chains';
import type { RawEntry } from './types';

const ENTRY_SUBMITTED_EVENT = parseAbiItem(
  'event EntrySubmitted(uint256 indexed entryId, address indexed owner, bytes32[] picks, uint256 tiebreaker, uint256 pricePaid)'
);

export async function readEntries(
  poolAddress: Address,
  rpcUrl: string,
  chainId: number = 11155111, // Sepolia default
  fromBlock?: bigint,
): Promise<RawEntry[]> {
  const chain = chainId === 1 ? mainnet : sepolia;
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  let startBlock = fromBlock;
  if (startBlock === undefined) {
    const currentBlock = await client.getBlockNumber();
    // Default: scan last ~30 days of blocks (216,000 blocks at ~12s each)
    startBlock = currentBlock > 216000n ? currentBlock - 216000n : 0n;
  }

  const logs = await client.getLogs({
    address: poolAddress,
    event: ENTRY_SUBMITTED_EVENT,
    fromBlock: startBlock,
    toBlock: 'latest',
  });

  return logs.map(log => ({
    entryId: Number(log.args.entryId!),
    owner: log.args.owner!,
    picks: log.args.picks! as `0x${string}`[],
    tiebreaker: log.args.tiebreaker!,
    pricePaid: log.args.pricePaid!,
  }));
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
