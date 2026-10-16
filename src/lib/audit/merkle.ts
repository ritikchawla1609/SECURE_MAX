import crypto from 'crypto';

/**
 * Lightweight, zero-dependency Merkle Tree generator.
 * Used for creating cryptographic proofs of audit logs (Phase 3/4).
 */
export class MerkleTree {
  private leaves: string[];
  private layers: string[][];

  constructor(leaves: string[]) {
    this.leaves = leaves.map(leaf => this.hashNode(leaf));
    this.layers = [this.leaves];
    this.buildTree();
  }

  private hashNode(data: string): string {
    const raw = crypto.createHash('sha256').update(data).digest('hex');
    return raw.startsWith('0x') ? raw : `0x${raw}`;
  }

  private buildTree() {
    let currentLayer = this.leaves;
    while (currentLayer.length > 1) {
      const nextLayer = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        // If odd number of nodes, duplicate the last node
        const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
        
        // Sort hashes to ensure deterministic tree structure regardless of order
        const [a, b] = [left, right].sort();
        nextLayer.push(this.hashNode(a + b));
      }
      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  /**
   * Returns the Merkle Root (the top hash of the tree)
   */
  public getRoot(): string {
    if (this.layers.length === 0 || this.layers[this.layers.length - 1].length === 0) {
      return this.hashNode('');
    }
    return this.layers[this.layers.length - 1][0];
  }

  /**
   * Generates a Merkle Proof for a given leaf
   */
  public getProof(leaf: string): string[] {
    const hashedLeaf = this.hashNode(leaf);
    let index = this.leaves.indexOf(hashedLeaf);
    if (index === -1) return [];

    const proof = [];
    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      const isRightNode = index % 2 === 1;
      const pairIndex = isRightNode ? index - 1 : Math.min(index + 1, layer.length - 1);
      
      proof.push(layer[pairIndex]);
      index = Math.floor(index / 2);
    }
    return proof;
  }

  /**
   * Verifies a given leaf against a root using a proof
   */
  public static verifyProof(leaf: string, proof: string[], root: string): boolean {
    let computedHash = crypto.createHash('sha256').update(leaf).digest('hex');
    computedHash = computedHash.startsWith('0x') ? computedHash : `0x${computedHash}`;

    for (const p of proof) {
      const [a, b] = [computedHash, p].sort();
      const raw = crypto.createHash('sha256').update(a + b).digest('hex');
      computedHash = raw.startsWith('0x') ? raw : `0x${raw}`;
    }

    return computedHash === root;
  }
}
