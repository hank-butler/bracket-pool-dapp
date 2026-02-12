'use client';

import { use } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { usePoolDetails, usePoolStatus } from '@/hooks/usePools';
import { formatUnits, isAddress } from 'viem';
import Link from 'next/link';
import { EntrySubmit } from '@/components/EntrySubmit';
import { RefundEntry } from '@/components/RefundEntry';
import { ClaimPrize } from '@/components/ClaimPrize';

export default function PoolPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);

  if (!isAddress(address)) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-red-500">Invalid pool address</p>
          <Link href="/" className="text-blue-500 hover:underline">Back to Pools</Link>
        </div>
      </main>
    );
  }

  const poolAddress = address as `0x${string}`;
  const pool = usePoolDetails(poolAddress);
  const { isLocked, isFinalized, status } = usePoolStatus(pool);
  const { address: userAddress, isConnected } = useAccount();

  const showEntry = !isLocked && !pool.cancelled && !isFinalized;
  const showClaim = isFinalized && pool.proofsCID !== '';
  const showRefund = true; // RefundEntry handles its own eligibility check

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
            <div><p className="text-gray-500">Status</p><p className="font-semibold">{status}</p></div>
            <div><p className="text-gray-500">Entries</p><p className="font-semibold">{pool.entryCount}</p></div>
            <div><p className="text-gray-500">Pool Value</p><p className="font-semibold">${formatUnits(pool.totalPoolValue, 6)} USDC</p></div>
            <div><p className="text-gray-500">Current Price</p><p className="font-semibold">${formatUnits(pool.currentPrice, 6)} USDC</p></div>
            <div><p className="text-gray-500">Lock Time</p><p className="font-semibold">{new Date(pool.lockTime * 1000).toLocaleString()}</p></div>
            <div><p className="text-gray-500">Claim Deadline</p><p className="font-semibold">{new Date(pool.claimDeadline * 1000).toLocaleString()}</p></div>
          </div>
        </div>

        {showEntry && isConnected && pool.usdcAddress !== ('0x' + '0'.repeat(40)) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <EntrySubmit
              poolAddress={poolAddress}
              usdcAddress={pool.usdcAddress}
              currentPrice={pool.currentPrice}
              gameCount={pool.gameCount}
            />
          </div>
        )}

        {showEntry && !isConnected && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2">Submit Your Bracket</h2>
            <p className="text-gray-600">Connect your wallet to submit a bracket entry.</p>
          </div>
        )}

        {showClaim && isConnected && (
          <div className="mb-6">
            <ClaimPrize
              poolAddress={poolAddress}
              proofsCID={pool.proofsCID}
              claimDeadline={pool.claimDeadline}
            />
          </div>
        )}

        {isConnected && (
          <div className="mb-6">
            <RefundEntry
              poolAddress={poolAddress}
              cancelled={pool.cancelled}
              lockTime={pool.lockTime}
              finalizeDeadline={pool.finalizeDeadline}
              entryCount={pool.entryCount}
              merkleRoot={pool.merkleRoot}
            />
          </div>
        )}

        <div className="mt-6"><p className="text-sm text-gray-500">Contract: {poolAddress}</p></div>
      </div>
    </main>
  );
}
