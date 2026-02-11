import { describe, it, expect } from 'vitest';
import { buildMerkleTree } from '../src/merkle';

describe('buildMerkleTree', () => {
  it('builds tree with correct leaf encoding', () => {
    const winners = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 19_000_000n },
      { owner: '0x2222222222222222222222222222222222222222', entryId: 1, amount: 1_000_000n },
    ];
    const { root, proofs } = buildMerkleTree(winners);

    expect(root).toMatch(/^0x[0-9a-f]{64}$/);
    expect(proofs[0]).toBeDefined();
    expect(proofs[0].length).toBeGreaterThan(0);
  });

  it('produces deterministic output', () => {
    const winners = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 10_000_000n },
      { owner: '0x2222222222222222222222222222222222222222', entryId: 1, amount: 10_000_000n },
    ];
    const result1 = buildMerkleTree(winners);
    const result2 = buildMerkleTree(winners);
    expect(result1.root).toBe(result2.root);
  });

  it('different inputs produce different roots', () => {
    const winners1 = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 10_000_000n },
    ];
    const winners2 = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 20_000_000n },
    ];
    expect(buildMerkleTree(winners1).root).not.toBe(buildMerkleTree(winners2).root);
  });

  it('generates valid proofs for all winners', () => {
    const winners = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 10_000_000n },
      { owner: '0x2222222222222222222222222222222222222222', entryId: 1, amount: 9_000_000n },
      { owner: '0x3333333333333333333333333333333333333333', entryId: 2, amount: 1_000_001n },
    ];
    const { root, proofs, tree } = buildMerkleTree(winners);

    for (const w of winners) {
      const proof = proofs[w.entryId];
      const verified = tree.verify([w.owner, BigInt(w.entryId), w.amount], proof);
      expect(verified).toBe(true);
    }
  });
});
