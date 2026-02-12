'use client';

import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useUserEntries } from '@/hooks/useUserEntries';
import { useRefund, checkRefundEligibility } from '@/hooks/useRefund';

interface RefundEntryProps {
  poolAddress: `0x${string}`;
  cancelled: boolean;
  lockTime: number;
  finalizeDeadline: number;
  entryCount: number;
  merkleRoot: string;
}

export function RefundEntry({
  poolAddress,
  cancelled,
  lockTime,
  finalizeDeadline,
  entryCount,
  merkleRoot,
}: RefundEntryProps) {
  const { address } = useAccount();
  const { entries, isLoading, hasEntries } = useUserEntries(poolAddress, address);
  const { refund, refundingId, txHash, confirmed, waiting, error, reset } = useRefund(poolAddress);

  const eligibility = checkRefundEligibility(cancelled, lockTime, finalizeDeadline, entryCount, merkleRoot);

  if (!eligibility.eligible || !hasEntries || isLoading) return null;

  const refundableEntries = entries.filter((e) => !e.isRefunded);
  if (refundableEntries.length === 0) return null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-orange-800">Refund Available</h2>
        <p className="text-sm text-orange-600 mt-1">{eligibility.reason}</p>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.entryId.toString()}
            className="flex items-center justify-between bg-white rounded p-3 border"
          >
            <div>
              <p className="font-medium">Entry #{entry.entryId.toString()}</p>
              <p className="text-sm text-gray-600">
                Paid: ${formatUnits(entry.pricePaid, 6)} USDC
              </p>
            </div>
            {entry.isRefunded ? (
              <span className="px-3 py-1 text-sm bg-gray-100 text-gray-500 rounded">
                Already refunded
              </span>
            ) : (
              <button
                type="button"
                onClick={() => refund(entry.entryId)}
                disabled={waiting || refundingId !== null}
                className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded hover:bg-orange-700 disabled:opacity-50"
              >
                {refundingId === entry.entryId && waiting
                  ? 'Refunding...'
                  : refundingId === entry.entryId && confirmed
                    ? 'Refunded!'
                    : 'Refund'}
              </button>
            )}
          </div>
        ))}
      </div>

      {txHash && confirmed && (
        <p className="text-sm text-green-600">
          Refund confirmed! Tx: <code className="text-xs">{txHash}</code>
        </p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 text-sm text-red-500 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
