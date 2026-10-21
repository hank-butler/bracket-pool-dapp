import { describe, it, expect } from 'vitest';
import { keccak256, encodeAbiParameters } from 'viem';
import { buildMerkleTree } from '../src/merkle';

const POOL_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const POOL_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

describe('buildMerkleTree', () => {
  it('binds the tree to the pool address (same winners, different pool → different root)', () => {
    const winners = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 10_000_000n },
      { owner: '0x2222222222222222222222222222222222222222', entryId: 1, amount: 9_000_000n },
    ];
    expect(buildMerkleTree(POOL_A, winners).root).not.toBe(buildMerkleTree(POOL_B, winners).root);
  });

  it('leaf hash matches the contract encoding keccak256(keccak256(abi.encode(pool, owner, entryId, amount)))', () => {
    const winner = { owner: '0x1111111111111111111111111111111111111111', entryId: 7, amount: 12_345n };
    const { tree } = buildMerkleTree(POOL_A, [winner, { owner: '0x2222222222222222222222222222222222222222', entryId: 8, amount: 1n }]);

    const expectedLeaf = keccak256(
      keccak256(
        encodeAbiParameters(
          [{ type: 'address' }, { type: 'address' }, { type: 'uint256' }, { type: 'uint256' }],
          [POOL_A, winner.owner as `0x${string}`, BigInt(winner.entryId), winner.amount],
        ),
      ),
    );
    expect(tree.leafHash([POOL_A, winner.owner, BigInt(winner.entryId), winner.amount])).toBe(expectedLeaf);
  });

  it('builds tree with correct leaf encoding', () => {
    const winners = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 19_000_000n },
      { owner: '0x2222222222222222222222222222222222222222', entryId: 1, amount: 1_000_000n },
    ];
    const { root, proofs } = buildMerkleTree(POOL_A, winners);

    expect(root).toMatch(/^0x[0-9a-f]{64}$/);
    expect(proofs[0]).toBeDefined();
    expect(proofs[0].length).toBeGreaterThan(0);
  });

  it('produces deterministic output', () => {
    const winners = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 10_000_000n },
      { owner: '0x2222222222222222222222222222222222222222', entryId: 1, amount: 10_000_000n },
    ];
    const result1 = buildMerkleTree(POOL_A, winners);
    const result2 = buildMerkleTree(POOL_A, winners);
    expect(result1.root).toBe(result2.root);
  });

  it('different inputs produce different roots', () => {
    const winners1 = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 10_000_000n },
    ];
    const winners2 = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 20_000_000n },
    ];
    expect(buildMerkleTree(POOL_A, winners1).root).not.toBe(buildMerkleTree(POOL_A, winners2).root);
  });

  it('generates valid proofs for all winners', () => {
    const winners = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 10_000_000n },
      { owner: '0x2222222222222222222222222222222222222222', entryId: 1, amount: 9_000_000n },
      { owner: '0x3333333333333333333333333333333333333333', entryId: 2, amount: 1_000_001n },
    ];
    const { root, proofs, tree } = buildMerkleTree(POOL_A, winners);

    for (const w of winners) {
      const proof = proofs[w.entryId];
      const verified = tree.verify([POOL_A, w.owner, BigInt(w.entryId), w.amount], proof);
      expect(verified).toBe(true);
    }
  });
});
