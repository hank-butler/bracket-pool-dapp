'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { isAddress, formatUnits } from 'viem';
import { WalletButton } from '@/components/WalletButton';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { usePoolDetails, usePoolStatus } from '@/hooks/usePools';
import { StepOpen } from '@/components/admin/StepOpen';
import { StepPostResults } from '@/components/admin/StepPostResults';
import { StepReviewFinalize } from '@/components/admin/StepReviewFinalize';
import { StepFinalized } from '@/components/admin/StepFinalized';

export default function AdminPoolPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);

  if (!isAddress(address)) {
    return <main className="p-8"><p className="status-error">Invalid address</p></main>;
  }

  const poolAddress = address as `0x${string}`;
  return <AdminPoolWizard poolAddress={poolAddress} />;
}

function AdminPoolWizard({ poolAddress }: { poolAddress: `0x${string}` }) {
  const { isAdmin, isLoading: accessLoading } = useAdminAccess();
  const pool = usePoolDetails(poolAddress);
  const { isLocked, isFinalized, status } = usePoolStatus(pool);

  const [scorerResult, setScorerResult] = useState<{ merkleRoot: `0x${string}`; proofsCID: string } | null>(null);

  if (accessLoading) return <main className="p-8"><p>Checking access...</p></main>;
  if (!isAdmin) return <main className="p-8"><p className="status-error">Not authorized.</p></main>;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="panel-90s p-4 mb-4 flex justify-between items-center">
          <div>
            <Link href="/admin" className="text-sm">← Back to Admin</Link>
            <h1 className="text-2xl mt-1"><span className="star">★</span> {pool.poolName || 'Pool'}</h1>
            <p className="text-xs mt-1">
              Status: <b>{status}</b> · {pool.entryCount} entries · ${formatUnits(pool.totalPoolValue, 6)} USDC
            </p>
          </div>
          <WalletButton />
        </div>
        <hr />

        {pool.cancelled && (
          <div className="panel-90s p-4 mt-4">
            <p className="text-red-600 font-bold">Pool cancelled — terminal state.</p>
          </div>
        )}

        {!pool.cancelled && !isLocked && (
          <StepOpen poolAddress={poolAddress} lockTime={pool.lockTime} entryCount={pool.entryCount} />
        )}

        {!pool.cancelled && isLocked && !isFinalized && !scorerResult && (
          <StepPostResults
            poolAddress={poolAddress}
            gameCount={pool.gameCount}
            onScorerComplete={setScorerResult}
          />
        )}

        {!pool.cancelled && isLocked && !isFinalized && scorerResult && (
          <StepReviewFinalize
            poolAddress={poolAddress}
            merkleRoot={scorerResult.merkleRoot}
            proofsCID={scorerResult.proofsCID}
          />
        )}

        {isFinalized && (
          <StepFinalized poolAddress={poolAddress} claimDeadline={pool.claimDeadline} />
        )}

        <hr className="mt-4" />
        <p className="text-xs mt-2">Contract: <code>{poolAddress}</code></p>
      </div>
    </main>
  );
}
