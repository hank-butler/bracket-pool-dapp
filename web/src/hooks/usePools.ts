import { useReadContract, useReadContracts } from 'wagmi';
import { contracts, FACTORY_ADDRESS, BracketPoolABI } from '@/lib/contracts';

export function usePools() {
  const { data: poolCount } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: contracts.factory.abi,
    functionName: 'getPoolCount',
  });

  const poolQueries = useReadContracts({
    contracts: Array.from({ length: Number(poolCount || 0) }, (_, i) => ({
      address: FACTORY_ADDRESS,
      abi: contracts.factory.abi as any,
      functionName: 'pools' as const,
      args: [BigInt(i)],
    })),
  });

  return {
    poolCount: Number(poolCount || 0),
    poolAddresses: poolQueries.data?.map(d => d.result as `0x${string}`) || [],
    isLoading: poolQueries.isLoading,
  };
}

export function usePoolDetails(address: `0x${string}`) {
  const results = useReadContracts({
    contracts: [
      { address, abi: BracketPoolABI as any, functionName: 'poolName' },
      { address, abi: BracketPoolABI as any, functionName: 'gameCount' },
      { address, abi: BracketPoolABI as any, functionName: 'lockTime' },
      { address, abi: BracketPoolABI as any, functionName: 'totalPoolValue' },
      { address, abi: BracketPoolABI as any, functionName: 'entryCount' },
      { address, abi: BracketPoolABI as any, functionName: 'getCurrentPrice' },
      { address, abi: BracketPoolABI as any, functionName: 'merkleRoot' },
      { address, abi: BracketPoolABI as any, functionName: 'cancelled' },
      { address, abi: BracketPoolABI as any, functionName: 'claimDeadline' },
    ],
  });

  const d = results.data || [];

  return {
    poolName: (d[0]?.result as string) || '',
    gameCount: Number(d[1]?.result || 0),
    lockTime: Number(d[2]?.result || 0),
    totalPoolValue: BigInt((d[3]?.result || 0).toString()),
    entryCount: Number(d[4]?.result || 0),
    currentPrice: BigInt((d[5]?.result || 0).toString()),
    merkleRoot: (d[6]?.result as string) || '0x' + '0'.repeat(64),
    cancelled: Boolean(d[7]?.result),
    claimDeadline: Number(d[8]?.result || 0),
    isLoading: results.isLoading,
  };
}
