import { useState, useEffect } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { contracts, FACTORY_ADDRESS, BracketPoolABI } from '@/lib/contracts';

const ZERO_MERKLE_ROOT = '0x' + '0'.repeat(64);

export function usePools() {
  const { data: pools, isLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: contracts.factory.abi,
    functionName: 'getAllPools',
  });

  const poolAddresses = (pools as `0x${string}`[] | undefined) ?? [];

  return {
    poolCount: poolAddresses.length,
    poolAddresses,
    isLoading,
  };
}

export function usePoolDetails(address: `0x${string}`) {
  const results = useReadContracts({
    contracts: [
      { address, abi: BracketPoolABI, functionName: 'poolName' },
      { address, abi: BracketPoolABI, functionName: 'gameCount' },
      { address, abi: BracketPoolABI, functionName: 'lockTime' },
      { address, abi: BracketPoolABI, functionName: 'totalPoolValue' },
      { address, abi: BracketPoolABI, functionName: 'entryCount' },
      { address, abi: BracketPoolABI, functionName: 'getCurrentPrice' },
      { address, abi: BracketPoolABI, functionName: 'merkleRoot' },
      { address, abi: BracketPoolABI, functionName: 'cancelled' },
      { address, abi: BracketPoolABI, functionName: 'claimDeadline' },
    ],
  });

  const d = results.data || [];

  return {
    poolName: (d[0]?.result as string) || '',
    gameCount: Number(d[1]?.result || 0),
    lockTime: Number(d[2]?.result || 0),
    totalPoolValue: (d[3]?.result as bigint) ?? BigInt(0),
    entryCount: Number(d[4]?.result || 0),
    currentPrice: (d[5]?.result as bigint) ?? BigInt(0),
    merkleRoot: (d[6]?.result as string) || ZERO_MERKLE_ROOT,
    cancelled: Boolean(d[7]?.result),
    claimDeadline: Number(d[8]?.result || 0),
    isLoading: results.isLoading,
  };
}

export function usePoolStatus(pool: ReturnType<typeof usePoolDetails>) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const isLocked = now / 1000 > pool.lockTime;
  const isFinalized = pool.merkleRoot !== ZERO_MERKLE_ROOT;

  const status = pool.cancelled ? 'Cancelled' : isFinalized ? 'Finalized' : isLocked ? 'Locked' : 'Open';
  const statusColor = pool.cancelled ? 'bg-red-200' : isFinalized ? 'bg-gray-200' : isLocked ? 'bg-yellow-200' : 'bg-green-200';

  return { isLocked, isFinalized, status, statusColor };
}
