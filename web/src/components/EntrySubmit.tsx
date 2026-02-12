'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { BracketPicker } from './BracketPicker';
import { useEnterPool } from '@/hooks/useEnterPool';
import { picksToBytes32Array } from '@/lib/teams';

interface EntrySubmitProps {
  poolAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  currentPrice: bigint;
  gameCount: number;
}

export function EntrySubmit({ poolAddress, usdcAddress, currentPrice, gameCount }: EntrySubmitProps) {
  const { address } = useAccount();
  const {
    state,
    error,
    needsApproval,
    enter,
    submitEntry,
    approveConfirmed,
    approveTxHash,
    enterTxHash,
    reset,
  } = useEnterPool(poolAddress, usdcAddress, currentPrice, address);

  const [pendingPicks, setPendingPicks] = useState<{ picks: `0x${string}`[]; tiebreaker: number } | null>(null);

  // When approval confirms, automatically submit the entry
  useEffect(() => {
    if (approveConfirmed && pendingPicks && state === 'waitingApproval') {
      submitEntry(pendingPicks.picks, pendingPicks.tiebreaker);
    }
  }, [approveConfirmed, pendingPicks, state, submitEntry]);

  const handleComplete = useCallback(
    (picks: (`0x${string}` | null)[], tiebreaker: number) => {
      const bytes32Picks = picks.map((p) => p || ('0x' + '0'.repeat(64)) as `0x${string}`);
      setPendingPicks({ picks: bytes32Picks, tiebreaker });
      enter(bytes32Picks, tiebreaker);
    },
    [enter],
  );

  const isProcessing = state !== 'idle' && state !== 'success' && state !== 'error';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Submit Your Bracket</h2>
        <p className="text-sm text-gray-600">
          Entry price: <span className="font-semibold">${formatUnits(currentPrice, 6)} USDC</span>
        </p>
      </div>

      {state === 'success' ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="font-semibold text-green-800">Entry submitted successfully!</p>
          {enterTxHash && (
            <p className="text-sm text-green-600 mt-1">
              Tx: <code className="text-xs">{enterTxHash}</code>
            </p>
          )}
          <button
            type="button"
            onClick={() => { reset(); setPendingPicks(null); }}
            className="mt-3 px-4 py-2 text-sm bg-green-100 hover:bg-green-200 rounded"
          >
            Submit another entry
          </button>
        </div>
      ) : (
        <>
          <BracketPicker
            gameCount={gameCount}
            onComplete={handleComplete}
            disabled={isProcessing}
          />

          {isProcessing && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="font-medium text-yellow-800">
                {state === 'approving' && 'Approve USDC spending in your wallet...'}
                {state === 'waitingApproval' && 'Waiting for approval confirmation...'}
                {state === 'entering' && 'Confirm entry submission in your wallet...'}
                {state === 'waitingEntry' && 'Waiting for entry confirmation...'}
              </p>
              {approveTxHash && state === 'waitingApproval' && (
                <p className="text-sm text-yellow-600 mt-1">
                  Approve tx: <code className="text-xs">{approveTxHash}</code>
                </p>
              )}
            </div>
          )}

          {state === 'error' && error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="font-medium text-red-800">Error</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
              <button
                type="button"
                onClick={() => { reset(); setPendingPicks(null); }}
                className="mt-3 px-4 py-2 text-sm bg-red-100 hover:bg-red-200 rounded"
              >
                Try again
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
