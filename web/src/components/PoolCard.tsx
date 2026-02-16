'use client';

import Link from 'next/link';
import { usePoolDetails, usePoolStatus } from '@/hooks/usePools';
import { formatUnits } from 'viem';

const BADGE_CLASS: Record<string, string> = {
  Open: 'badge-open',
  Locked: 'badge-locked',
  Finalized: 'badge-finalized',
  Cancelled: 'badge-cancelled',
};

export function PoolCard({ address }: { address: `0x${string}` }) {
  const pool = usePoolDetails(address);
  const { status } = usePoolStatus(pool);

  const badgeCls = BADGE_CLASS[status] || 'badge-open';

  return (
    <Link href={`/pool/${address}`}>
      <div className="panel-90s p-3 hover:border-[3px]">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold">{pool.poolName || 'Bracket Pool'}</h3>
          <span className={`px-2 py-0.5 text-[10px] font-bold ${badgeCls}`}>
            {status}
          </span>
        </div>
        <hr />
        <div className="text-xs space-y-1">
          <p>Entries: <b>{pool.entryCount}</b></p>
          <p>Pool Value: <b>${formatUnits(pool.totalPoolValue, 6)}</b></p>
          <p>Current Price: <b>${formatUnits(pool.currentPrice, 6)}</b></p>
          <p>Locks: {new Date(pool.lockTime * 1000).toLocaleString()}</p>
        </div>
      </div>
    </Link>
  );
}
