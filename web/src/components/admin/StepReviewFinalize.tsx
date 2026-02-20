'use client';

import { useEffect, useState } from 'react';
import { useFinalize } from '@/hooks/useAdminPool';

interface Props {
  poolAddress: `0x${string}`;
  merkleRoot: `0x${string}`;
  proofsCID: string;
}

export function StepReviewFinalize({ poolAddress, merkleRoot, proofsCID }: Props) {
  const [phase, setPhase] = useState<'review' | 'setRoot' | 'setCID' | 'done'>('review');
  const { setMerkleRoot, setProofsCID, isPending, isConfirming, isSuccess, error } = useFinalize(poolAddress);

  // After setMerkleRoot confirms, move on to setProofsCID
  useEffect(() => {
    if (isSuccess && phase === 'setRoot') {
      setPhase('setCID');
      setProofsCID(proofsCID);
    }
    if (isSuccess && phase === 'setCID') {
      setPhase('done');
    }
  }, [isSuccess, phase, proofsCID, setProofsCID]);

  if (phase === 'done') {
    return (
      <div className="panel-90s p-4 mb-4">
        <h2 className="text-lg mb-2">Step 4: Finalized ✓</h2>
        <p className="text-sm text-green-700">Merkle root and proofs CID posted on-chain. Claims are open.</p>
      </div>
    );
  }

  return (
    <div className="panel-90s p-4 mb-4">
      <h2 className="text-lg mb-2">Step 4: Review &amp; Finalize</h2>
      <p className="text-sm mb-3">
        Review the scorer output before committing on-chain. This transfers the 5% fee to treasury and opens prize claims.
      </p>
      <table className="table-90s mb-4 w-full">
        <tbody>
          <tr>
            <th className="text-left pr-4 py-1">Merkle Root</th>
            <td><code className="text-xs break-all">{merkleRoot}</code></td>
          </tr>
          <tr>
            <th className="text-left pr-4 py-1">Proofs IPFS CID</th>
            <td><code className="text-xs">{proofsCID}</code></td>
          </tr>
        </tbody>
      </table>
      <button
        className="btn-90s"
        onClick={() => { setPhase('setRoot'); setMerkleRoot(merkleRoot); }}
        disabled={isPending || isConfirming || phase !== 'review'}
      >
        {isPending ? 'Confirm in wallet...' : isConfirming ? 'Finalizing...' : 'Finalize Pool'}
      </button>
      {phase === 'setCID' && <p className="text-sm mt-2">Setting proofs CID...</p>}
      {error && <p className="status-error text-sm mt-1">{error.message}</p>}
    </div>
  );
}
