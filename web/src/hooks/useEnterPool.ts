import { useState, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { BracketPoolABI } from '@/lib/contracts';

// enter() pulls getCurrentPrice() at transaction time, so any entry that
// lands between approval and submission raises the amount pulled. Approve
// with a 10% buffer so the entry doesn't revert on insufficient allowance.
const APPROVAL_BUFFER_BPS = 1000n;

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

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: userAddress ? [userAddress, poolAddress] : undefined,
    query: { enabled: !!userAddress },
  });

  // The bonding curve raises the price with every entry, so the price passed
  // in from the page is a stale snapshot. Track the live on-chain price and
  // re-read it at submit time.
  const { data: livePrice, refetch: refetchPrice } = useReadContract({
    address: poolAddress,
    abi: BracketPoolABI,
    functionName: 'getCurrentPrice',
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

  const requiredPrice = (livePrice as bigint | undefined) ?? price;
  const needsApproval = !allowance || allowance < requiredPrice;

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

  const enter = useCallback(
    async (picks: `0x${string}`[], tiebreaker: number) => {
      setError(null);

      try {
        // Re-read price and allowance at click time — both can be stale.
        const [freshAllowance, freshPrice] = await Promise.all([
          refetchAllowance().then(r => r.data as bigint | undefined),
          refetchPrice().then(r => r.data as bigint | undefined),
        ]);
        const currentPrice = freshPrice ?? requiredPrice;
        const currentAllowance = freshAllowance ?? 0n;

        if (currentAllowance < currentPrice) {
          setState('approving');
          const approveAmount = currentPrice * (10000n + APPROVAL_BUFFER_BPS) / 10000n;
          writeApprove(
            {
              address: usdcAddress,
              abi: erc20Abi,
              functionName: 'approve',
              args: [poolAddress, approveAmount],
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
    [refetchAllowance, refetchPrice, requiredPrice, writeApprove, usdcAddress, poolAddress, submitEntry],
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
