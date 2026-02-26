'use client';

import { useState } from 'react';
import { useReadContract } from 'wagmi';
import { BracketPoolABI } from '@/lib/contracts';
import { useSetResults } from '@/hooks/useAdminPool';

interface Props {
  poolAddress: `0x${string}`;
  gameCount: number;
  onScorerComplete: (result: { merkleRoot: `0x${string}`; proofsCID: string }) => void;
}

export function StepPostResults({ poolAddress, gameCount, onScorerComplete }: Props) {
  const [resultsJson, setResultsJson] = useState('');
  const [tiebreaker, setTiebreaker] = useState('');
  const [scorerRunning, setScorerRunning] = useState(false);
  const [scorerError, setScorerError] = useState('');

  const { data: gameResults } = useReadContract({
    address: poolAddress,
    abi: BracketPoolABI,
    functionName: 'getGameResults',
  });

  const resultsPosted = Array.isArray(gameResults) && gameResults.length > 0;

  const { setResults, isPending, isConfirming, error } = useSetResults(poolAddress);

  function handlePostResults() {
    let parsed: `0x${string}`[];
    try {
      parsed = JSON.parse(resultsJson);
      if (!Array.isArray(parsed) || parsed.length !== gameCount) {
        alert(`Expected ${gameCount} results, got ${Array.isArray(parsed) ? parsed.length : 'invalid JSON'}`);
        return;
      }
    } catch {
      alert('Invalid JSON');
      return;
    }
    setResults(parsed);
  }

  async function handleRunScorer() {
    const tb = parseInt(tiebreaker, 10);
    if (isNaN(tb)) { alert('Enter a valid tiebreaker number'); return; }
    setScorerRunning(true);
    setScorerError('');
    try {
      const res = await fetch('/api/admin/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolAddress, tiebreaker: tb }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onScorerComplete(data);
    } catch (err: unknown) {
      setScorerError(err instanceof Error ? err.message : 'Scorer failed');
    } finally {
      setScorerRunning(false);
    }
  }

  return (
    <div className="panel-90s p-4 mb-4">
      {!resultsPosted ? (
        <>
          <h2 className="text-lg mb-2">Step 2: Post Results</h2>
          <p className="text-sm mb-3">
            Paste a JSON array of {gameCount} team ID bytes32 values (one per game, in bracket order).
          </p>
          <div className="mt-2 mb-2">
            <label className="btn-90s text-xs cursor-pointer">
              Load from file
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => setResultsJson(ev.target?.result as string);
                  reader.readAsText(file);
                }}
              />
            </label>
            {resultsJson && (
              <span className="text-xs ml-2 text-green-700">
                {(() => { try { const a = JSON.parse(resultsJson); return Array.isArray(a) ? `${a.length} values loaded` : 'invalid'; } catch { return 'invalid JSON'; } })()}
              </span>
            )}
          </div>
          <button className="btn-90s mt-2" onClick={handlePostResults} disabled={isPending || isConfirming}>
            {isPending ? 'Confirm in wallet...' : isConfirming ? 'Posting...' : 'Post Results'}
          </button>
          {error && <p className="status-error text-sm mt-1">{error.message}</p>}
        </>
      ) : (
        <>
          <h2 className="text-lg mb-2">Step 3: Run Scorer</h2>
          <p className="text-sm mb-3 text-green-700">✓ Results posted on-chain</p>
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">Actual Tiebreaker</label>
            <p className="text-xs text-gray-500 mb-1">
              The actual final score total (March Madness) or total goals in the Final (World Cup)
            </p>
            <input
              className="input-90s w-40"
              type="number"
              placeholder="e.g. 142"
              value={tiebreaker}
              onChange={e => setTiebreaker(e.target.value)}
            />
          </div>
          <button className="btn-90s" onClick={handleRunScorer} disabled={scorerRunning}>
            {scorerRunning ? 'Running scorer + pinning to IPFS...' : 'Run Scorer'}
          </button>
          {scorerError && <p className="status-error text-sm mt-1">{scorerError}</p>}
        </>
      )}
    </div>
  );
}
