import { useState, useEffect, useCallback, useReducer } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { BracketPoolABI } from '@/lib/contracts';

interface ClaimableEntry {
  entryId: number;
  prizeAmount: bigint;
  proof: `0x${string}`[];
}

interface ScorerOutputJSON {
  poolAddress: string;
  merkleRoot: string;
  totalEntries: number;
  prizePool: string;
  entries: Array<{
    entryId: number;
    owner: string;
    picks: string[];
    tiebreaker: string;
    pricePaid: string;
    score: number;
    tiebreakerDistance: number;
    rank: number;
    prizeAmount: string;
  }>;
  proofs: Record<string, string[]>;
}

type FetchState = {
  claimables: ClaimableEntry[];
  fetching: boolean;
  fetchError: string | null;
};

type FetchAction =
  | { type: 'start' }
  | { type: 'success'; claimables: ClaimableEntry[] }
  | { type: 'error'; error: string };

function fetchReducer(state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case 'start': return { ...state, fetching: true, fetchError: null };
    case 'success': return { claimables: action.claimables, fetching: false, fetchError: null };
    case 'error': return { claimables: [], fetching: false, fetchError: action.error };
  }
}

export function useClaim(
  poolAddress: `0x${string}`,
  proofsCID: string,
  userAddress: `0x${string}` | undefined,
) {
  const [{ claimables, fetching, fetchError }, dispatch] = useReducer(fetchReducer, {
    claimables: [],
    fetching: false,
    fetchError: null,
  });
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const { writeContract, data: txHash, reset: resetWrite } = useWriteContract();

  const { isSuccess: confirmed, isLoading: waiting } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Fetch proofs from IPFS
  useEffect(() => {
    if (!proofsCID || !userAddress) return;

    let cancelled = false;
    dispatch({ type: 'start' });

    fetch(`https://ipfs.io/ipfs/${proofsCID}`)
      .then((res) => {
        if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data: ScorerOutputJSON) => {
        if (cancelled) return;

        const userEntries = data.entries.filter(
          (e) => e.owner.toLowerCase() === userAddress.toLowerCase() && BigInt(e.prizeAmount) > BigInt(0),
        );

        const claimables: ClaimableEntry[] = userEntries.map((e) => ({
          entryId: e.entryId,
          prizeAmount: BigInt(e.prizeAmount),
          proof: (data.proofs[e.entryId.toString()] || []) as `0x${string}`[],
        }));

        dispatch({ type: 'success', claimables });
      })
      .catch((err) => {
        if (cancelled) return;
        dispatch({ type: 'error', error: err instanceof Error ? err.message : 'Failed to fetch proofs' });
      });

    return () => {
      cancelled = true;
    };
  }, [proofsCID, userAddress]);

  const claim = useCallback(
    (entryId: number, amount: bigint, proof: `0x${string}`[]) => {
      setClaimError(null);
      setClaimingId(entryId);
      writeContract(
        {
          address: poolAddress,
          abi: BracketPoolABI,
          functionName: 'claim',
          args: [BigInt(entryId), amount, proof],
        },
        {
          onError: (err) => {
            setClaimError(err.message);
            setClaimingId(null);
          },
        },
      );
    },
    [writeContract, poolAddress],
  );

  const reset = useCallback(() => {
    setClaimError(null);
    setClaimingId(null);
    resetWrite();
  }, [resetWrite]);

  return {
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
  };
}
