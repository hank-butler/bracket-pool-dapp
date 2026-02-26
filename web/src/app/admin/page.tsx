'use client';

import Link from 'next/link';
import { formatUnits } from 'viem';
import { WalletButton } from '@/components/WalletButton';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { usePools, usePoolDetails, usePoolStatus } from '@/hooks/usePools';
import { CreatePoolForm } from '@/components/CreatePoolForm';
import { stripPoolNamePrefix } from '@/lib/poolTypes';

const BADGE_CLASS: Record<string, string> = {
  Open: 'badge-open',
  Locked: 'badge-locked',
  Finalized: 'badge-finalized',
  Cancelled: 'badge-cancelled',
};

function AdminPoolRow({ address }: { address: `0x${string}` }) {
  const pool = usePoolDetails(address);
  const { status } = usePoolStatus(pool);
  const badgeCls = BADGE_CLASS[status] || 'badge-open';

  return (
    <Link href={`/admin/pool/${address}`}>
      <div className="panel-90s p-3 hover:border-[3px] flex justify-between items-center">
        <div>
          <p className="font-bold">{pool.poolName ? stripPoolNamePrefix(pool.poolName) : 'Pool'}</p>
          <p className="text-xs">{address.slice(0, 10)}...</p>
        </div>
        <div className="text-right text-sm">
          <span className={`px-2 py-0.5 text-[10px] font-bold ${badgeCls}`}>{status}</span>
          <p className="text-xs mt-1">{pool.entryCount} entries · ${formatUnits(pool.totalPoolValue, 6)}</p>
        </div>
      </div>
    </Link>
  );
}

export default function AdminPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const { poolAddresses } = usePools();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="panel-90s p-4 mb-4 flex justify-between items-center">
          <h1 className="text-2xl"><span className="star">★</span> Admin</h1>
          <WalletButton />
        </div>
        <hr />
        {isLoading ? (
          <p className="mt-4">Checking access...</p>
        ) : !isAdmin ? (
          <p className="status-error mt-4">Not authorized. Connect the owner wallet.</p>
        ) : (
          <>
            <CreatePoolForm />
            <div className="panel-90s p-4">
              <h2 className="text-lg mb-2">All Pools</h2>
              <div className="space-y-2">
                {poolAddresses.length === 0 && <p className="text-sm">No pools yet.</p>}
                {poolAddresses.map(addr => <AdminPoolRow key={addr} address={addr} />)}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
