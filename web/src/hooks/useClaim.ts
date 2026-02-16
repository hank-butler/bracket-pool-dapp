import { useState, useEffect, useCallback } from 'react';
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

export function useClaim(
  poolAddress: `0x${string}`,
  proofsCID: string,
  userAddress: `0x${string}` | undefined,
) {
  const [claimables, setClaimables] = useState<ClaimableEntry[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const { writeContract, data: txHash, reset: resetWrite } = useWriteContract();

  const { isSuccess: confirmed, isLoading: waiting } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Fetch proofs from IPFS
  useEffect(() => {
    if (!proofsCID || !userAddress) {
      setClaimables([]);
      return;
    }

    let cancelled = false;
    setFetching(true);
    setFetchError(null);

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

        const result: ClaimableEntry[] = userEntries.map((e) => ({
          entryId: e.entryId,
          prizeAmount: BigInt(e.prizeAmount),
          proof: (data.proofs[e.entryId.toString()] || []) as `0x${string}`[],
        }));

        setClaimables(result);
        setFetching(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : 'Failed to fetch proofs');
        setFetching(false);
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
