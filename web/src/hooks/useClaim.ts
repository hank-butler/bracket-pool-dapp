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

const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
];
const GATEWAY_TIMEOUT_MS = 10_000;

// A single slow or blocked gateway must not make prizes unclaimable.
async function fetchProofsJSON(cid: string): Promise<ScorerOutputJSON> {
  let lastError: unknown;
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const res = await fetch(`${gateway}${cid}`, { signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All IPFS gateways failed');
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

    fetchProofsJSON(proofsCID)
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
