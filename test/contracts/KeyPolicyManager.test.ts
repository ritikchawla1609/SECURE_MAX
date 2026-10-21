import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { KeyPolicyManager } from "../../typechain-types";

describe("KeyPolicyManager", function () {
  let keyPolicyManager: KeyPolicyManager;
  let owner: any;
  let nonAdmin: any;

  beforeEach(async function () {
    [owner, nonAdmin] = await ethers.getSigners();
    const KeyPolicyManagerFactory = await ethers.getContractFactory("KeyPolicyManager");
    keyPolicyManager = await KeyPolicyManagerFactory.deploy();
  });

  describe("Policy Administration", function () {
    const policyId = ethers.id("policy-bel-radar");
    const keyId = ethers.id("key-radar-01");
    const policyType = 1; // Strict Zero-Trust
    const conditionsHash = ethers.id("condition:time_restricted_p256_only");

    it("should allow admin to create a key policy", async function () {
      await expect(keyPolicyManager.createPolicy(policyId, keyId, policyType, conditionsHash))
        .to.emit(keyPolicyManager, "PolicyCreated")
        .withArgs(policyId, keyId);

      expect(await keyPolicyManager.isPolicyActive(policyId)).to.be.true;

      const policy = await keyPolicyManager.getPolicy(policyId);
      expect(policy.policyId).to.equal(policyId);
      expect(policy.keyId).to.equal(keyId);
      expect(policy.conditionsHash).to.equal(conditionsHash);
    });

    it("should reject duplicate policyId creation", async function () {
      await keyPolicyManager.createPolicy(policyId, keyId, policyType, conditionsHash);
      await expect(
        keyPolicyManager.createPolicy(policyId, keyId, policyType, conditionsHash)
      ).to.be.revertedWith("Policy already exists");
    });

    it("should allow admin to update policy conditions hash", async function () {
      await keyPolicyManager.createPolicy(policyId, keyId, policyType, conditionsHash);
      const newConditionsHash = ethers.id("condition:updated_policy_v2");

      await expect(keyPolicyManager.updatePolicy(policyId, newConditionsHash))
        .to.emit(keyPolicyManager, "PolicyUpdated")
        .withArgs(policyId);

      const policy = await keyPolicyManager.getPolicy(policyId);
      expect(policy.conditionsHash).to.equal(newConditionsHash);
    });

    it("should allow admin to deactivate policy", async function () {
      await keyPolicyManager.createPolicy(policyId, keyId, policyType, conditionsHash);

      await expect(keyPolicyManager.deactivatePolicy(policyId))
        .to.emit(keyPolicyManager, "PolicyDeactivated")
        .withArgs(policyId);

      expect(await keyPolicyManager.isPolicyActive(policyId)).to.be.false;
    });

    it("should revert if non-admin attempts policy management", async function () {
      await expect(
        keyPolicyManager.connect(nonAdmin).createPolicy(policyId, keyId, policyType, conditionsHash)
      ).to.be.revertedWithCustomError(keyPolicyManager, "OwnableUnauthorizedAccount");
    });
  });
});
