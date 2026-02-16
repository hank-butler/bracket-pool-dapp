import { useState, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { BracketPoolABI } from '@/lib/contracts';

type EnterState =
  | 'idle'
  | 'approving'
  | 'waitingApproval'
  | 'entering'
  | 'waitingEntry'
  | 'success'
  | 'error';

export function useEnterPool(
  poolAddress: `0x${string}`,
  usdcAddress: `0x${string}`,
  price: bigint,
  userAddress: `0x${string}` | undefined,
) {
  const [state, setState] = useState<EnterState>('idle');
  const [error, setError] = useState<string | null>(null);

  const { data: allowance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: userAddress ? [userAddress, poolAddress] : undefined,
    query: { enabled: !!userAddress },
  });

  const {
    writeContract: writeApprove,
    data: approveTxHash,
    reset: resetApprove,
  } = useWriteContract();

  const {
    writeContract: writeEnter,
    data: enterTxHash,
    reset: resetEnter,
  } = useWriteContract();

  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  const { isSuccess: enterConfirmed } = useWaitForTransactionReceipt({
    hash: enterTxHash,
  });

  const needsApproval = !allowance || allowance < price;

  const enter = useCallback(
    async (picks: `0x${string}`[], tiebreaker: number) => {
      setError(null);

      try {
        if (needsApproval) {
          setState('approving');
          writeApprove(
            {
              address: usdcAddress,
              abi: erc20Abi,
              functionName: 'approve',
              args: [poolAddress, price],
            },
            {
              onSuccess: () => {
                setState('waitingApproval');
              },
              onError: (err) => {
                setError(err.message);
                setState('error');
              },
            },
          );
        } else {
          submitEntry(picks, tiebreaker);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setState('error');
      }
    },
    [needsApproval, writeApprove, usdcAddress, poolAddress, price],
  );

  const submitEntry = useCallback(
    (picks: `0x${string}`[], tiebreaker: number) => {
      setState('entering');
      writeEnter(
        {
          address: poolAddress,
          abi: BracketPoolABI,
          functionName: 'enter',
          args: [picks, BigInt(tiebreaker)],
        },
        {
          onSuccess: () => {
            setState('waitingEntry');
          },
          onError: (err) => {
            setError(err.message);
            setState('error');
          },
        },
      );
    },
    [writeEnter, poolAddress],
  );

  // Drive state transitions when tx receipts arrive
  if (state === 'waitingApproval' && approveConfirmed) {
    // approval confirmed — but we need picks. Store them via a ref pattern.
    // This is handled by the component calling submitEntry after approval.
  }
  if (state === 'waitingEntry' && enterConfirmed) {
    setState('success');
  }

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
    resetApprove();
    resetEnter();
  }, [resetApprove, resetEnter]);

  return {
    state,
    error,
    needsApproval,
    enter,
    submitEntry,
    approveConfirmed,
    enterConfirmed,
    approveTxHash,
    enterTxHash,
    reset,
  };
}
