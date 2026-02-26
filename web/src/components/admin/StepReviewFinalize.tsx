'use client';

import { useState } from 'react';
import { useFinalize } from '@/hooks/useAdminPool';

interface Props {
  poolAddress: `0x${string}`;
  merkleRoot: `0x${string}`;
  proofsCID: string;
}

export function StepReviewFinalize({ poolAddress, merkleRoot, proofsCID }: Props) {
  const [started, setStarted] = useState(false);
  const { setMerkleRoot, isPending, isConfirming, isSuccess, rootSuccess, error } = useFinalize(poolAddress, proofsCID);

  if (isSuccess) {
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
        onClick={() => { setStarted(true); setMerkleRoot(merkleRoot); }}
        disabled={isPending || isConfirming || started}
      >
        {isPending ? 'Confirm in wallet...' : isConfirming ? 'Finalizing...' : 'Finalize Pool'}
      </button>
      {rootSuccess && !isSuccess && <p className="text-sm mt-2 text-yellow-700">Merkle root set — confirm proofs CID in wallet...</p>}
      {error && <p className="status-error text-sm mt-1">{error.message}</p>}
    </div>
  );
}
