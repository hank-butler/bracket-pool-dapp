import { StandardMerkleTree } from '@openzeppelin/merkle-tree';

export interface WinnerLeaf {
  owner: string;
  entryId: number;
  amount: bigint;
}

export interface MerkleResult {
  root: string;
  proofs: Record<number, string[]>;
  tree: StandardMerkleTree<[string, string, bigint, bigint]>;
}

// Leaf layout must match BracketPool.claim():
// keccak256(bytes.concat(keccak256(abi.encode(address(this), msg.sender, entryId, amount))))
// The pool address binds each tree to one pool so proofs can't replay across pools.
export function buildMerkleTree(poolAddress: string, winners: WinnerLeaf[]): MerkleResult {
  if (winners.length === 0) {
    throw new Error('Cannot build Merkle tree with no winners');
  }
  const values: [string, string, bigint, bigint][] = winners.map(w => [
    poolAddress,
    w.owner,
    BigInt(w.entryId),
    w.amount,
  ]);

  const tree = StandardMerkleTree.of(values, ['address', 'address', 'uint256', 'uint256']);

  const proofs: Record<number, string[]> = {};
  for (const [i, v] of tree.entries()) {
    const entryId = Number(v[2]);
    proofs[entryId] = tree.getProof(i);
  }

  return {
    root: tree.root,
    proofs,
    tree,
  };
}
