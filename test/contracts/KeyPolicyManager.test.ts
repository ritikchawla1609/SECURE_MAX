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

  describe("Access Control & Policy Creation", function () {
    const policyId = ethers.id("policy-001");
    const keyId = ethers.id("key-001");
    const policyType = 1; // e.g. Time-Bound Access
    const conditionsHash = ethers.id("conditions-v1");

    it("should allow owner to create policy", async function () {
      await expect(keyPolicyManager.createPolicy(policyId, keyId, policyType, conditionsHash))
        .to.emit(keyPolicyManager, "PolicyCreated")
        .withArgs(policyId, keyId);

      const policy = await keyPolicyManager.getPolicy(policyId);
      expect(policy.policyId).to.equal(policyId);
      expect(policy.keyId).to.equal(keyId);
      expect(policy.policyType).to.equal(policyType);
      expect(policy.conditionsHash).to.equal(conditionsHash);
      expect(policy.isActive).to.be.true;
      expect(policy.createdAt).to.be.gt(0);
      expect(policy.updatedAt).to.equal(policy.createdAt);
      expect(await keyPolicyManager.isPolicyActive(policyId)).to.be.true;
    });

    it("should revert if non-admin tries to create policy", async function () {
      await expect(
        keyPolicyManager.connect(nonAdmin).createPolicy(policyId, keyId, policyType, conditionsHash)
      ).to.be.revertedWithCustomError(keyPolicyManager, "OwnableUnauthorizedAccount");
    });

    it("should revert if policy ID already exists", async function () {
      await keyPolicyManager.createPolicy(policyId, keyId, policyType, conditionsHash);
      await expect(
        keyPolicyManager.createPolicy(policyId, keyId, policyType, conditionsHash)
      ).to.be.revertedWith("Policy already exists");
    });

    it("should return false for unregistered policy in isPolicyActive", async function () {
      const ghostPolicyId = ethers.id("policy-never-created");
      expect(await keyPolicyManager.isPolicyActive(ghostPolicyId)).to.be.false;
    });
  });

  describe("Policy Update", function () {
    const policyId = ethers.id("policy-update");
    const keyId = ethers.id("key-update");
    const policyType = 2;
    const initialHash = ethers.id("initial-conditions");
    const newHash = ethers.id("updated-conditions");

    beforeEach(async function () {
      await keyPolicyManager.createPolicy(policyId, keyId, policyType, initialHash);
    });

    it("should allow owner to update policy conditions", async function () {
      await expect(keyPolicyManager.updatePolicy(policyId, newHash))
        .to.emit(keyPolicyManager, "PolicyUpdated")
        .withArgs(policyId);

      const policy = await keyPolicyManager.getPolicy(policyId);
      expect(policy.conditionsHash).to.equal(newHash);
      expect(policy.updatedAt).to.be.gte(policy.createdAt);
    });

    it("should revert if non-admin tries to update policy", async function () {
      await expect(
        keyPolicyManager.connect(nonAdmin).updatePolicy(policyId, newHash)
      ).to.be.revertedWithCustomError(keyPolicyManager, "OwnableUnauthorizedAccount");
    });

    it("should revert if policy does not exist", async function () {
      const nonExistentPolicyId = ethers.id("policy-nonexistent");
      await expect(
        keyPolicyManager.updatePolicy(nonExistentPolicyId, newHash)
      ).to.be.revertedWith("Policy not found");
    });

    it("should revert update if policy is deactivated", async function () {
      await keyPolicyManager.deactivatePolicy(policyId);
      await expect(
        keyPolicyManager.updatePolicy(policyId, newHash)
      ).to.be.revertedWith("Policy is inactive");
    });
  });

  describe("Policy Deactivation", function () {
    const policyId = ethers.id("policy-deactivate");
    const keyId = ethers.id("key-deactivate");
    const conditionsHash = ethers.id("conditions");

    beforeEach(async function () {
      await keyPolicyManager.createPolicy(policyId, keyId, 1, conditionsHash);
    });

    it("should allow owner to deactivate policy", async function () {
      await expect(keyPolicyManager.deactivatePolicy(policyId))
        .to.emit(keyPolicyManager, "PolicyDeactivated")
        .withArgs(policyId);

      const policy = await keyPolicyManager.getPolicy(policyId);
      expect(policy.isActive).to.be.false;
      expect(await keyPolicyManager.isPolicyActive(policyId)).to.be.false;
    });

    it("should revert if non-admin tries to deactivate policy", async function () {
      await expect(
        keyPolicyManager.connect(nonAdmin).deactivatePolicy(policyId)
      ).to.be.revertedWithCustomError(keyPolicyManager, "OwnableUnauthorizedAccount");
    });

    it("should revert deactivation if policy does not exist", async function () {
      const nonExistentPolicyId = ethers.id("policy-ghost");
      await expect(
        keyPolicyManager.deactivatePolicy(nonExistentPolicyId)
      ).to.be.revertedWith("Policy not found");
    });

    it("should revert deactivation if policy is already inactive", async function () {
      await keyPolicyManager.deactivatePolicy(policyId);
      await expect(
        keyPolicyManager.deactivatePolicy(policyId)
      ).to.be.revertedWith("Policy is inactive");
    });
  });
});
