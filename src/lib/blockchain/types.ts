export interface ChainIdentity {
  owner: string;
  did: string;
  nameHash: string;
  role: number;
  status: number;
  registeredAt: bigint;
  updatedAt: bigint;
}

export interface ChainAsset {
  assetId: string;
  assetCode: string;
  contentHash: string;
  classification: number;
  ownerDid: string;
  status: number;
  registeredAt: bigint;
}

export interface ChainAssignment {
  assetId: string;
  assigneeDid: string;
  permissions: number;
  isActive: boolean;
  assignedAt: bigint;
  revokedAt: bigint;
}

export interface ChainKeyMetadata {
  keyId: string;
  assetId: string;
  version: bigint;
  status: number;
  algorithm: number;
  createdAt: bigint;
  rotatedAt: bigint;
  revokedAt: bigint;
}

export interface ChainKeyPolicy {
  policyId: string;
  keyId: string;
  policyType: number;
  conditionsHash: string;
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface ChainAuthRecord {
  authId: string;
  userDid: string;
  assetId: string;
  keyId: string;
  result: number;
  timestamp: bigint;
  expiresAt: bigint;
}

export interface ChainAnchor {
  batchStartId: bigint;
  batchEndId: bigint;
  merkleRoot: string;
  anchoredAt: bigint;
}
