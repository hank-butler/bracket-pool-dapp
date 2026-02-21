'use client';

import { useState } from 'react';
import { useSweepUnclaimed } from '@/hooks/useAdminPool';

interface Props {
  poolAddress: `0x${string}`;
  claimDeadline: number;
}

export function StepFinalized({ poolAddress, claimDeadline }: Props) {
  const { sweepUnclaimed, isPending, isConfirming, isSuccess, error } = useSweepUnclaimed(poolAddress);
  const [now] = useState(() => Date.now() / 1000);
  const canSweep = now >= claimDeadline;
  const deadlineStr = new Date(claimDeadline * 1000).toLocaleString();

  return (
    <div className="panel-90s p-4 mb-4">
      <h2 className="text-lg mb-2">Finalized — Claims Open</h2>
      <p className="text-sm mb-3">Prize claims are open until <b>{deadlineStr}</b></p>
      {canSweep && (
        <div>
          <p className="text-sm mb-2 text-yellow-700">
            Claim deadline has passed. Unclaimed funds can be swept to treasury.
          </p>
          <button className="btn-90s" onClick={sweepUnclaimed} disabled={isPending || isConfirming}>
            {isPending ? 'Confirm in wallet...' : isConfirming ? 'Sweeping...' : 'Sweep Unclaimed'}
          </button>
          {isSuccess && <p className="text-sm mt-1 text-green-700">Swept to treasury.</p>}
          {error && <p className="status-error text-sm mt-1">{error.message}</p>}
        </div>
      )}
    </div>
  );
}
