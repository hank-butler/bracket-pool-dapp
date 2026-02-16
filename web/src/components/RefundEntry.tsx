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
    <div className="panel-90s p-4 space-y-4">
      <div>
        <h2 className="text-lg status-warning">Refund Available</h2>
        <p className="text-xs mt-1">{eligibility.reason}</p>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.entryId.toString()}
            className="panel-90s-inset p-3 flex items-center justify-between"
          >
            <div>
              <p className="font-bold">Entry #{entry.entryId.toString()}</p>
              <p className="text-xs">
                Paid: ${formatUnits(entry.pricePaid, 6)} USDC
              </p>
            </div>
            {entry.isRefunded ? (
              <span className="btn-90s" style={{ cursor: 'default' }}>
                Already refunded
              </span>
            ) : (
              <button
                type="button"
                onClick={() => refund(entry.entryId)}
                disabled={waiting || refundingId !== null}
                className="btn-90s-primary"
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
        <p className="text-xs status-success">
          Refund confirmed! Tx: <code>{txHash}</code>
        </p>
      )}

      {error && (
        <div className="panel-90s-inset p-3">
          <p className="text-xs status-error">{error}</p>
          <button
            type="button"
            onClick={reset}
            className="text-xs underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
