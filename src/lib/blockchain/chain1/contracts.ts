import { Contract, Provider, Signer } from "ethers";

import IdentityRegistryArtifact from "../abi/IdentityRegistry.json";
import RBACManagerArtifact from "../abi/RBACManager.json";
import AssetRegistryArtifact from "../abi/AssetRegistry.json";
import AuditAnchorArtifact from "../abi/AuditAnchor.json";
import deployedAddresses from "../../../../deployed-addresses.json";

export function getIdentityRegistryContract(providerOrSigner: Provider | Signer): Contract {
  const address = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || (deployedAddresses.contracts as any).IdentityRegistry;
  if (!address) throw new Error("NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS not set");
  return new Contract(address, IdentityRegistryArtifact.abi, providerOrSigner);
}

export function getRBACManagerContract(providerOrSigner: Provider | Signer): Contract {
  const address = process.env.NEXT_PUBLIC_RBAC_MANAGER_ADDRESS || (deployedAddresses.contracts as any).RBACManager;
  if (!address) throw new Error("NEXT_PUBLIC_RBAC_MANAGER_ADDRESS not set");
  return new Contract(address, RBACManagerArtifact.abi, providerOrSigner);
}

export function getAssetRegistryContract(providerOrSigner: Provider | Signer): Contract {
  const address = process.env.NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS || (deployedAddresses.contracts as any).AssetRegistry;
  if (!address) throw new Error("NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS not set");
  return new Contract(address, AssetRegistryArtifact.abi, providerOrSigner);
}

export function getAuditAnchorContract(providerOrSigner: Provider | Signer): Contract {
  const address = process.env.NEXT_PUBLIC_AUDIT_ANCHOR_ADDRESS || (deployedAddresses.contracts as any).AuditAnchor;
  if (!address) throw new Error("NEXT_PUBLIC_AUDIT_ANCHOR_ADDRESS not set");
  return new Contract(address, AuditAnchorArtifact.abi, providerOrSigner);
}
