import { ethers, Contract, Provider, Signer } from "ethers";

const KeyPolicyManagerABI = [
  "function createPolicy(bytes32 policyId, bytes32 keyId, uint8 policyType, bytes32 conditionsHash) external",
  "function updatePolicy(bytes32 policyId, bytes32 newConditionsHash) external",
  "function deactivatePolicy(bytes32 policyId) external",
  "function getPolicy(bytes32 policyId) external view returns (tuple(bytes32 policyId, bytes32 keyId, uint8 policyType, bytes32 conditionsHash, bool isActive, uint256 createdAt, uint256 updatedAt))",
  "function isPolicyActive(bytes32 policyId) external view returns (bool)"
];

const KeyLifecycleABI = [
  "function registerKey(bytes32 keyId, bytes32 assetId, uint256 version, uint8 algorithm) external",
  "function rotateKey(bytes32 oldKeyId, bytes32 newKeyId, uint256 newVersion) external",
  "function revokeKey(bytes32 keyId) external",
  "function getKeyMetadata(bytes32 keyId) external view returns (tuple(bytes32 keyId, bytes32 assetId, uint256 version, uint8 status, uint8 algorithm, uint256 createdAt, uint256 rotatedAt, uint256 revokedAt))",
  "function isKeyActive(bytes32 keyId) external view returns (bool)"
];

const DecryptionAuthABI = [
  "function recordAuthorization(bytes32 authId, string memory userDid, bytes32 assetId, bytes32 keyId, uint256 expiresAt) external",
  "function recordCompletion(bytes32 authId) external",
  "function recordDenial(bytes32 authId, string memory userDid, bytes32 assetId, string memory reason) external",
  "function getAuthorization(bytes32 authId) external view returns (tuple(bytes32 authId, string userDid, bytes32 assetId, bytes32 keyId, uint8 result, uint256 timestamp, uint256 expiresAt))",
  "function isAuthorizationValid(bytes32 authId) external view returns (bool)"
];

export function getKeyPolicyManagerContract(providerOrSigner: Provider | Signer): Contract {
  const address = process.env.NEXT_PUBLIC_KEY_POLICY_MANAGER_ADDRESS;
  if (!address) throw new Error("NEXT_PUBLIC_KEY_POLICY_MANAGER_ADDRESS not set");
  return new Contract(address, KeyPolicyManagerABI, providerOrSigner);
}

export function getKeyLifecycleContract(providerOrSigner: Provider | Signer): Contract {
  const address = process.env.NEXT_PUBLIC_KEY_LIFECYCLE_ADDRESS;
  if (!address) throw new Error("NEXT_PUBLIC_KEY_LIFECYCLE_ADDRESS not set");
  return new Contract(address, KeyLifecycleABI, providerOrSigner);
}

export function getDecryptionAuthContract(providerOrSigner: Provider | Signer): Contract {
  const address = process.env.NEXT_PUBLIC_DECRYPTION_AUTH_ADDRESS;
  if (!address) throw new Error("NEXT_PUBLIC_DECRYPTION_AUTH_ADDRESS not set");
  return new Contract(address, DecryptionAuthABI, providerOrSigner);
}
