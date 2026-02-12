import { useState, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { BracketPoolABI } from '@/lib/contracts';

const ZERO_MERKLE_ROOT = '0x' + '0'.repeat(64);

export interface RefundEligibility {
  eligible: boolean;
  reason: string;
}

export function checkRefundEligibility(
  cancelled: boolean,
  lockTime: number,
  finalizeDeadline: number,
  entryCount: number,
  merkleRoot: string,
): RefundEligibility {
  const now = Date.now() / 1000;

  // Condition 1: Pool cancelled
  if (cancelled) {
    return { eligible: true, reason: 'Pool cancelled' };
  }

  // Condition 2: Past lock time, fewer than 2 entries, no merkle root
  if (now >= lockTime && entryCount < 2 && merkleRoot === ZERO_MERKLE_ROOT) {
    return { eligible: true, reason: 'Not enough entries after lock time' };
  }

  // Condition 3: Past finalize deadline, no merkle root
  if (now >= finalizeDeadline && merkleRoot === ZERO_MERKLE_ROOT) {
    return { eligible: true, reason: 'Finalization deadline passed without results' };
  }

  return { eligible: false, reason: '' };
}

export function useRefund(poolAddress: `0x${string}`) {
  const [error, setError] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<bigint | null>(null);

  const { writeContract, data: txHash, reset: resetWrite } = useWriteContract();

  const { isSuccess: confirmed, isLoading: waiting } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const refund = useCallback(
    (entryId: bigint) => {
      setError(null);
      setRefundingId(entryId);
      writeContract(
        {
          address: poolAddress,
          abi: BracketPoolABI,
          functionName: 'refund',
          args: [entryId],
        },
        {
          onError: (err) => {
            setError(err.message);
            setRefundingId(null);
          },
        },
      );
    },
    [writeContract, poolAddress],
  );

  const reset = useCallback(() => {
    setError(null);
    setRefundingId(null);
    resetWrite();
  }, [resetWrite]);

  return {
    refund,
    refundingId,
    txHash,
    confirmed,
    waiting,
    error,
    reset,
  };
}
