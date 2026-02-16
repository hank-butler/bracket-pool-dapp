'use client';

import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useClaim } from '@/hooks/useClaim';
import { useUserEntries } from '@/hooks/useUserEntries';

interface ClaimPrizeProps {
  poolAddress: `0x${string}`;
  proofsCID: string;
  claimDeadline: number;
}

export function ClaimPrize({ poolAddress, proofsCID, claimDeadline }: ClaimPrizeProps) {
  const { address } = useAccount();
  const { entries: userEntries } = useUserEntries(poolAddress, address);
  const {
    claimables,
    fetching,
    fetchError,
    claim,
    claimingId,
    txHash,
    confirmed,
    waiting,
    claimError,
    reset,
  } = useClaim(poolAddress, proofsCID, address);

  if (!proofsCID) return null;

  const now = Date.now() / 1000;
  const deadlinePassed = claimDeadline > 0 && now > claimDeadline;

  if (fetching) {
    return (
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <p className="text-purple-700">Loading prize data from IPFS...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700">Failed to load prize data: {fetchError}</p>
      </div>
    );
  }

  if (claimables.length === 0) return null;

  // Cross-reference with on-chain claimed status
  const claimedIds = new Set(
    userEntries.filter((e) => e.isClaimed).map((e) => Number(e.entryId)),
  );

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-purple-800">Claim Your Prizes</h2>
        {!deadlinePassed && claimDeadline > 0 && (
          <p className="text-sm text-purple-600 mt-1">
            Claim deadline: {new Date(claimDeadline * 1000).toLocaleString()}
          </p>
        )}
        {deadlinePassed && (
          <p className="text-sm text-red-600 mt-1 font-medium">
            Claim deadline has passed
          </p>
        )}
      </div>

      <div className="space-y-2">
        {claimables.map((entry) => {
          const alreadyClaimed = claimedIds.has(entry.entryId);
          return (
            <div
              key={entry.entryId}
              className="flex items-center justify-between bg-white rounded p-3 border"
            >
              <div>
                <p className="font-medium">Entry #{entry.entryId}</p>
                <p className="text-sm text-purple-600">
                  Prize: ${formatUnits(entry.prizeAmount, 6)} USDC
                </p>
              </div>
              {alreadyClaimed ? (
                <span className="px-3 py-1 text-sm bg-gray-100 text-gray-500 rounded">
                  Already claimed
                </span>
              ) : deadlinePassed ? (
                <span className="px-3 py-1 text-sm bg-red-100 text-red-500 rounded">
                  Deadline passed
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => claim(entry.entryId, entry.prizeAmount, entry.proof)}
                  disabled={waiting || claimingId !== null}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  {claimingId === entry.entryId && waiting
                    ? 'Claiming...'
                    : claimingId === entry.entryId && confirmed
                      ? 'Claimed!'
                      : 'Claim'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {txHash && confirmed && (
        <p className="text-sm text-green-600">
          Claim confirmed! Tx: <code className="text-xs">{txHash}</code>
        </p>
      )}

      {claimError && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-600">{claimError}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 text-sm text-red-500 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
