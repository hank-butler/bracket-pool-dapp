import { type Abi } from 'viem';
import { useReadContract, useReadContracts } from 'wagmi';
import { BracketPoolABI } from '@/lib/contracts';

const abi = BracketPoolABI as Abi;

export interface UserEntry {
  entryId: bigint;
  owner: `0x${string}`;
  pricePaid: bigint;
  isClaimed: boolean;
  isRefunded: boolean;
}

export function useUserEntries(
  poolAddress: `0x${string}`,
  userAddress: `0x${string}` | undefined,
) {
  const { data: entryIds, isLoading: idsLoading } = useReadContract({
    address: poolAddress,
    abi,
    functionName: 'getUserEntryIds',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  });

  const ids = (entryIds as bigint[] | undefined) ?? [];

  // Build batch reads for each entry
  const batchContracts = ids.flatMap((id) => [
    { address: poolAddress, abi, functionName: 'entries' as const, args: [id] as const },
    { address: poolAddress, abi, functionName: 'entryClaimed' as const, args: [id] as const },
    { address: poolAddress, abi, functionName: 'entryRefunded' as const, args: [id] as const },
  ]);

  const { data: batchResults, isLoading: detailsLoading } = useReadContracts({
    contracts: batchContracts.length > 0 ? batchContracts : undefined,
    query: { enabled: ids.length > 0 },
  });

  const entries: UserEntry[] = [];
  if (batchResults && ids.length > 0) {
    for (let i = 0; i < ids.length; i++) {
      const entryResult = batchResults[i * 3]?.result as
        | readonly [`0x${string}`, `0x${string}`, bigint, bigint]
        | undefined;
      const claimed = batchResults[i * 3 + 1]?.result as boolean | undefined;
      const refunded = batchResults[i * 3 + 2]?.result as boolean | undefined;

      if (entryResult) {
        entries.push({
          entryId: ids[i],
          owner: entryResult[0],
          pricePaid: entryResult[3],
          isClaimed: claimed ?? false,
          isRefunded: refunded ?? false,
        });
      }
    }
  }

  return {
    entries,
    isLoading: idsLoading || detailsLoading,
    hasEntries: entries.length > 0,
  };
}
