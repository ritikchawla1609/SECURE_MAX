const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("====================================================");
  console.log("🚀 Deploying Dual-Domain SecureMAX Blockchain Platform");
  console.log("====================================================");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer Address: ${deployer.address}`);

  // 1. IdentityRegistry
  const IdentityRegistryFactory = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistryFactory.deploy();
  await identityRegistry.waitForDeployment();
  const identityAddress = await identityRegistry.getAddress();
  console.log(`✅ IdentityRegistry deployed at: ${identityAddress}`);

  // 2. RBACManager
  const RBACManagerFactory = await ethers.getContractFactory("RBACManager");
  const rbacManager = await RBACManagerFactory.deploy();
  await rbacManager.waitForDeployment();
  const rbacAddress = await rbacManager.getAddress();
  console.log(`✅ RBACManager deployed at: ${rbacAddress}`);

  // 3. AssetRegistry
  const AssetRegistryFactory = await ethers.getContractFactory("AssetRegistry");
  const assetRegistry = await AssetRegistryFactory.deploy();
  await assetRegistry.waitForDeployment();
  const assetAddress = await assetRegistry.getAddress();
  console.log(`✅ AssetRegistry deployed at: ${assetAddress}`);

  // 4. AuditAnchor
  const AuditAnchorFactory = await ethers.getContractFactory("AuditAnchor");
  const auditAnchor = await AuditAnchorFactory.deploy();
  await auditAnchor.waitForDeployment();
  const auditAddress = await auditAnchor.getAddress();
  console.log(`✅ AuditAnchor deployed at: ${auditAddress}`);

  // 5. KeyPolicyManager
  const KeyPolicyManagerFactory = await ethers.getContractFactory("KeyPolicyManager");
  const keyPolicyManager = await KeyPolicyManagerFactory.deploy();
  await keyPolicyManager.waitForDeployment();
  const keyPolicyAddress = await keyPolicyManager.getAddress();
  console.log(`✅ KeyPolicyManager deployed at: ${keyPolicyAddress}`);

  // 6. KeyLifecycle
  const KeyLifecycleFactory = await ethers.getContractFactory("KeyLifecycle");
  const keyLifecycle = await KeyLifecycleFactory.deploy();
  await keyLifecycle.waitForDeployment();
  const keyLifecycleAddress = await keyLifecycle.getAddress();
  console.log(`✅ KeyLifecycle deployed at: ${keyLifecycleAddress}`);

  // 7. DecryptionAuth
  const DecryptionAuthFactory = await ethers.getContractFactory("DecryptionAuth");
  const decryptionAuth = await DecryptionAuthFactory.deploy();
  await decryptionAuth.waitForDeployment();
  const decryptionAuthAddress = await decryptionAuth.getAddress();
  console.log(`✅ DecryptionAuth deployed at: ${decryptionAuthAddress}`);

  const addresses = {
    IdentityRegistry: identityAddress,
    RBACManager: rbacAddress,
    AssetRegistry: assetAddress,
    AuditAnchor: auditAddress,
    KeyPolicyManager: keyPolicyAddress,
    KeyLifecycle: keyLifecycleAddress,
    DecryptionAuth: decryptionAuthAddress
  };

  const networkInfo = await ethers.provider.getNetwork();
  const chainId = networkInfo.chainId.toString();
  
  let networkName = networkInfo.name;
  if (chainId === "11155111") {
    networkName = "sepolia";
  }

  const finalOutput = {
    network: networkName,
    chainId: chainId,
    contracts: addresses
  };

  fs.writeFileSync(
    path.join(__dirname, "../deployed-addresses.json"),
    JSON.stringify(finalOutput, null, 2)
  );

  console.log("✅ Contract addresses exported to deployed-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
