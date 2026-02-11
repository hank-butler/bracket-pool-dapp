import { StandardMerkleTree } from '@openzeppelin/merkle-tree';

export interface WinnerLeaf {
  owner: string;
  entryId: number;
  amount: bigint;
}

export interface MerkleResult {
  root: string;
  proofs: Record<number, string[]>;
  tree: StandardMerkleTree<[string, bigint, bigint]>;
}

export function buildMerkleTree(winners: WinnerLeaf[]): MerkleResult {
  if (winners.length === 0) {
    throw new Error('Cannot build Merkle tree with no winners');
  }
  const values: [string, bigint, bigint][] = winners.map(w => [
    w.owner,
    BigInt(w.entryId),
    w.amount,
  ]);

  const tree = StandardMerkleTree.of(values, ['address', 'uint256', 'uint256']);

  const proofs: Record<number, string[]> = {};
  for (const [i, v] of tree.entries()) {
    const entryId = Number(v[1]);
    proofs[entryId] = tree.getProof(i);
  }

  return {
    root: tree.root,
    proofs,
    tree,
  };
}
