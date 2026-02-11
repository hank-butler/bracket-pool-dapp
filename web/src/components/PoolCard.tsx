'use client';

import Link from 'next/link';
import { usePoolDetails } from '@/hooks/usePools';
import { formatUnits } from 'viem';

export function PoolCard({ address }: { address: `0x${string}` }) {
  const pool = usePoolDetails(address);

  const isLocked = Date.now() / 1000 > pool.lockTime;
  const isFinalized = pool.merkleRoot !== '0x' + '0'.repeat(64);

  const status = pool.cancelled ? 'Cancelled' : isFinalized ? 'Finalized' : isLocked ? 'Locked' : 'Open';
  const statusColor = pool.cancelled ? 'bg-red-200' : isFinalized ? 'bg-gray-200' : isLocked ? 'bg-yellow-200' : 'bg-green-200';

  return (
    <Link href={`/pool/${address}`}>
      <div className="border rounded-lg p-4 hover:border-blue-500 transition-colors">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold">{pool.poolName || 'Bracket Pool'}</h3>
          <span className={`px-2 py-1 rounded text-sm ${statusColor}`}>{status}</span>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Entries: {pool.entryCount}</p>
          <p>Pool Value: ${formatUnits(pool.totalPoolValue, 6)}</p>
          <p>Current Price: ${formatUnits(pool.currentPrice, 6)}</p>
          <p>Locks: {new Date(pool.lockTime * 1000).toLocaleString()}</p>
        </div>
      </div>
    </Link>
  );
}
