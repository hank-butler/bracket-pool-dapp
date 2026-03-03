import { useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { BracketPoolABI, contracts, FACTORY_ADDRESS } from '@/lib/contracts';

export function useCreatePool() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function createPool(args: {
    token: `0x${string}`;
    poolName: string;
    gameCount: number;
    lockTime: number;
    finalizeDeadline: number;
    basePrice: bigint;
    priceSlope: bigint;
    maxEntries: number;
  }) {
    writeContract({
      address: FACTORY_ADDRESS,
      abi: contracts.factory.abi,
      functionName: 'createPool',
      args: [
        args.token,
        args.poolName,
        BigInt(args.gameCount),
        BigInt(args.lockTime),
        BigInt(args.finalizeDeadline),
        args.basePrice,
        args.priceSlope,
        BigInt(args.maxEntries),
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

export function useFinalize(poolAddress: `0x${string}`, pendingCID?: string) {
  const { writeContract: writeRoot, data: rootHash, isPending: rootPending, error: rootError } = useWriteContract();
  const { writeContract: writeCID, data: cidHash, isPending: cidPending, error: cidError } = useWriteContract();
  const { isLoading: rootConfirming, isSuccess: rootSuccess } = useWaitForTransactionReceipt({ hash: rootHash });
  const { isLoading: cidConfirming, isSuccess: cidSuccess } = useWaitForTransactionReceipt({ hash: cidHash });

  // Auto-trigger setProofsCID after setMerkleRoot confirms on-chain
  useEffect(() => {
    if (rootSuccess && pendingCID && !cidHash) {
      writeCID({
        address: poolAddress,
        abi: BracketPoolABI,
        functionName: 'setProofsCID',
        args: [pendingCID],
      });
    }
  }, [rootSuccess, pendingCID, cidHash, writeCID, poolAddress]);

  function setMerkleRoot(root: `0x${string}`) {
    writeRoot({
      address: poolAddress,
      abi: BracketPoolABI,
      functionName: 'setMerkleRoot',
      args: [root],
    });
  }

  const isPending = rootPending || cidPending;
  const isConfirming = rootConfirming || cidConfirming;
  const isSuccess = cidSuccess;
  const error = rootError || cidError;

  return { setMerkleRoot, isPending, isConfirming, isSuccess, rootSuccess, error };
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

export function useAddToken() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function addToken(tokenAddress: `0x${string}`) {
    writeContract({
      address: FACTORY_ADDRESS,
      abi: contracts.factory.abi,
      functionName: 'addToken',
      args: [tokenAddress],
    });
  }

  return { addToken, isPending, isConfirming, isSuccess, error };
}

export function useRemoveToken() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function removeToken(tokenAddress: `0x${string}`) {
    writeContract({
      address: FACTORY_ADDRESS,
      abi: contracts.factory.abi,
      functionName: 'removeToken',
      args: [tokenAddress],
    });
  }

  return { removeToken, isPending, isConfirming, isSuccess, error };
}
