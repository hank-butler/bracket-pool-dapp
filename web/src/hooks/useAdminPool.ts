import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { BracketPoolABI, contracts, FACTORY_ADDRESS } from '@/lib/contracts';

export function useCreatePool() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function createPool(args: {
    poolName: string;
    gameCount: number;
    lockTime: number;
    finalizeDeadline: number;
    basePrice: bigint;
    priceSlope: bigint;
  }) {
    writeContract({
      address: FACTORY_ADDRESS,
      abi: contracts.factory.abi,
      functionName: 'createPool',
      args: [
        args.poolName,
        BigInt(args.gameCount),
        BigInt(args.lockTime),
        BigInt(args.finalizeDeadline),
        args.basePrice,
        args.priceSlope,
      ],
    });
  }

  return { createPool, isPending, isConfirming, isSuccess, error };
}

export function useSetResults(poolAddress: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function setResults(results: `0x${string}`[]) {
    writeContract({
      address: poolAddress,
      abi: BracketPoolABI,
      functionName: 'setResults',
      args: [results],
    });
  }

  return { setResults, isPending, isConfirming, isSuccess, error };
}

export function useFinalize(poolAddress: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function setMerkleRoot(root: `0x${string}`) {
    writeContract({
      address: poolAddress,
      abi: BracketPoolABI,
      functionName: 'setMerkleRoot',
      args: [root],
    });
  }

  function setProofsCID(cid: string) {
    writeContract({
      address: poolAddress,
      abi: BracketPoolABI,
      functionName: 'setProofsCID',
      args: [cid],
    });
  }

  return { setMerkleRoot, setProofsCID, isPending, isConfirming, isSuccess, error };
}

export function useCancelPool(poolAddress: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function cancelPool() {
    writeContract({ address: poolAddress, abi: BracketPoolABI, functionName: 'cancelPool', args: [] });
  }

  return { cancelPool, isPending, isConfirming, isSuccess, error };
}

export function useSweepUnclaimed(poolAddress: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function sweepUnclaimed() {
    writeContract({ address: poolAddress, abi: BracketPoolABI, functionName: 'sweepUnclaimed', args: [] });
  }

  return { sweepUnclaimed, isPending, isConfirming, isSuccess, error };
}
