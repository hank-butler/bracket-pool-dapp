'use client';

import { use } from 'react';
import { WalletButton } from '@/components/WalletButton';
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
          <p className="status-error">Invalid pool address</p>
          <Link href="/">&larr; Back to Pools</Link>
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
  const showRefund = true;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="panel-90s p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/">&larr; Back to Pools</Link>
              <h1 className="text-2xl mt-1">
                <span className="star">&#9733;</span> {pool.poolName || 'Pool Details'}
              </h1>
            </div>
            <WalletButton />
          </div>
        </div>

        <hr />

        <div className="panel-90s p-4 mb-4">
          <h2 className="text-lg mb-2">Pool Information</h2>
          <table className="table-90s">
            <tbody>
              <tr><th>Status</th><td><b>{status}</b></td></tr>
              <tr><th>Entries</th><td>{pool.entryCount}</td></tr>
              <tr><th>Pool Value</th><td>${formatUnits(pool.totalPoolValue, 6)} USDC</td></tr>
              <tr><th>Current Price</th><td>${formatUnits(pool.currentPrice, 6)} USDC</td></tr>
              <tr><th>Lock Time</th><td>{new Date(pool.lockTime * 1000).toLocaleString()}</td></tr>
              <tr><th>Claim Deadline</th><td>{new Date(pool.claimDeadline * 1000).toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>

        {showEntry && isConnected && pool.usdcAddress !== ('0x' + '0'.repeat(40)) && (
          <div className="panel-90s p-4 mb-4">
            <EntrySubmit
              poolAddress={poolAddress}
              usdcAddress={pool.usdcAddress}
              currentPrice={pool.currentPrice}
              gameCount={pool.gameCount}
            />
          </div>
        )}

        {showEntry && !isConnected && (
          <div className="panel-90s p-4 mb-4">
            <h2 className="text-lg mb-2">Submit Your Bracket</h2>
            <p>Connect your wallet to submit a bracket entry.</p>
          </div>
        )}

        {showClaim && isConnected && (
          <div className="mb-4">
            <ClaimPrize
              poolAddress={poolAddress}
              proofsCID={pool.proofsCID}
              claimDeadline={pool.claimDeadline}
            />
          </div>
        )}

        {isConnected && (
          <div className="mb-4">
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

        <hr />
        <p className="text-xs">Contract: <code>{poolAddress}</code></p>
      </div>
    </main>
  );
}
