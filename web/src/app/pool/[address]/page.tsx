'use client';

import { use } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePoolDetails } from '@/hooks/usePools';
import { formatUnits } from 'viem';
import Link from 'next/link';

export default function PoolPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const poolAddress = address as `0x${string}`;
  const pool = usePoolDetails(poolAddress);

  const isLocked = Date.now() / 1000 > pool.lockTime;
  const isFinalized = pool.merkleRoot !== '0x' + '0'.repeat(64);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/" className="text-blue-500 hover:underline">&larr; Back to Pools</Link>
            <h1 className="text-3xl font-bold mt-2">{pool.poolName || 'Pool Details'}</h1>
          </div>
          <ConnectButton />
        </div>
        <div className="bg-white border rounded-lg p-6 mb-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div><p className="text-gray-500">Status</p><p className="font-semibold">{pool.cancelled ? 'Cancelled' : isFinalized ? 'Finalized' : isLocked ? 'Locked' : 'Open'}</p></div>
            <div><p className="text-gray-500">Entries</p><p className="font-semibold">{pool.entryCount}</p></div>
            <div><p className="text-gray-500">Pool Value</p><p className="font-semibold">${formatUnits(pool.totalPoolValue, 6)} USDC</p></div>
            <div><p className="text-gray-500">Current Price</p><p className="font-semibold">${formatUnits(pool.currentPrice, 6)} USDC</p></div>
            <div><p className="text-gray-500">Lock Time</p><p className="font-semibold">{new Date(pool.lockTime * 1000).toLocaleString()}</p></div>
            <div><p className="text-gray-500">Claim Deadline</p><p className="font-semibold">{new Date(pool.claimDeadline * 1000).toLocaleString()}</p></div>
          </div>
        </div>
        {!isLocked && !pool.cancelled && !isFinalized && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Submit Your Bracket</h2>
            <p className="text-gray-600">Bracket picker component will be added here.</p>
          </div>
        )}
        <div className="mt-6"><p className="text-sm text-gray-500">Contract: {poolAddress}</p></div>
      </div>
    </main>
  );
}
