import { useReadContract, useAccount } from 'wagmi';
import { contracts, FACTORY_ADDRESS } from '@/lib/contracts';

export function useAdminAccess() {
  const { address, isConnected } = useAccount();

  const { data: owner, isLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: contracts.factory.abi,
    functionName: 'owner',
  });

  const isAdmin = isConnected && !!address && !!owner &&
    address.toLowerCase() === (owner as string).toLowerCase();

  return { isAdmin, isLoading, owner: owner as `0x${string}` | undefined };
}
