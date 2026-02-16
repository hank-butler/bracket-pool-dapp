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
        <h2 className="text-lg">Submit Your Bracket</h2>
        <p className="text-xs">
          Entry price: <b>${formatUnits(currentPrice, 6)} USDC</b>
        </p>
      </div>

      {state === 'success' ? (
        <div className="panel-90s p-4">
          <p className="status-success">Entry submitted successfully!</p>
          {enterTxHash && (
            <p className="text-xs mt-1">
              Tx: <code>{enterTxHash}</code>
            </p>
          )}
          <button
            type="button"
            onClick={() => { reset(); setPendingPicks(null); }}
            className="btn-90s mt-3"
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
            <div className="panel-90s p-4">
              <p className="status-warning">
                {state === 'approving' && 'Approve USDC spending in your wallet...'}
                {state === 'waitingApproval' && 'Waiting for approval confirmation...'}
                {state === 'entering' && 'Confirm entry submission in your wallet...'}
                {state === 'waitingEntry' && 'Waiting for entry confirmation...'}
              </p>
              {approveTxHash && state === 'waitingApproval' && (
                <p className="text-xs mt-1">
                  Approve tx: <code>{approveTxHash}</code>
                </p>
              )}
            </div>
          )}

          {state === 'error' && error && (
            <div className="panel-90s p-4">
              <p className="status-error">Error</p>
              <p className="text-xs mt-1">{error}</p>
              <button
                type="button"
                onClick={() => { reset(); setPendingPicks(null); }}
                className="btn-90s mt-3"
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
