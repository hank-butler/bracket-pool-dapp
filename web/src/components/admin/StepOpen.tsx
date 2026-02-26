'use client';

import { useCancelPool } from '@/hooks/useAdminPool';

interface Props {
  poolAddress: `0x${string}`;
  lockTime: number;
  entryCount: number;
}

export function StepOpen({ poolAddress, lockTime, entryCount }: Props) {
  const { cancelPool, isPending, isConfirming, isSuccess } = useCancelPool(poolAddress);
  const locksAt = new Date(lockTime * 1000).toLocaleString();

  return (
    <div className="panel-90s p-4 mb-4">
      <h2 className="text-lg mb-2">Step 1: Open — Accepting Entries</h2>
      <p className="text-sm mb-3">Locks at <b>{locksAt}</b> · <b>{entryCount}</b> entries so far</p>
      <hr />
      <div className="mt-3">
        <p className="text-xs text-gray-500 mb-2">Danger zone</p>
        <button
          className="btn-90s bg-red-100 border-red-400 text-red-700"
          onClick={cancelPool}
          disabled={isPending || isConfirming}
        >
          {isPending ? 'Confirm in wallet...' : isConfirming ? 'Cancelling...' : 'Cancel Pool'}
        </button>
        {isSuccess && <p className="text-sm mt-1 text-red-700">Pool cancelled.</p>}
      </div>
    </div>
  );
}
