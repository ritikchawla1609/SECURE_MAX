import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { KeyLifecycle } from "../../typechain-types";

describe("KeyLifecycle", function () {
  let keyLifecycle: KeyLifecycle;
  let owner: any;
  let nonAdmin: any;

  // KeyState enum values per ISecureMax:
  // Active = 0, Rotating = 1, Rotated = 2, Revoked = 3, Destroyed = 4
  const KeyState = {
    Active: 0,
    Rotating: 1,
    Rotated: 2,
    Revoked: 3,
    Destroyed: 4,
  };

  beforeEach(async function () {
    [owner, nonAdmin] = await ethers.getSigners();
    const KeyLifecycleFactory = await ethers.getContractFactory("KeyLifecycle");
    keyLifecycle = await KeyLifecycleFactory.deploy();
  });

  describe("Key Registration & Access Control", function () {
    const keyId = ethers.id("key-reg-1");
    const assetId = ethers.id("asset-reg-1");
    const version = 1;
    const algorithm = 1; // e.g. AES-256-GCM

    it("should allow owner to register a key", async function () {
      await expect(keyLifecycle.registerKey(keyId, assetId, version, algorithm))
        .to.emit(keyLifecycle, "KeyRegistered")
        .withArgs(keyId, assetId);

      const meta = await keyLifecycle.getKeyMetadata(keyId);
      expect(meta.keyId).to.equal(keyId);
      expect(meta.assetId).to.equal(assetId);
      expect(meta.version).to.equal(version);
      expect(meta.algorithm).to.equal(algorithm);
      expect(meta.status).to.equal(KeyState.Active);
      expect(meta.createdAt).to.be.gt(0);
      expect(meta.rotatedAt).to.equal(0);
      expect(meta.revokedAt).to.equal(0);
      expect(await keyLifecycle.isKeyActive(keyId)).to.be.true;
    });

    it("should revert if non-admin tries to register a key", async function () {
      await expect(
        keyLifecycle.connect(nonAdmin).registerKey(keyId, assetId, version, algorithm)
      ).to.be.revertedWithCustomError(keyLifecycle, "OwnableUnauthorizedAccount");
    });

    it("should revert if key ID already exists", async function () {
      await keyLifecycle.registerKey(keyId, assetId, version, algorithm);
      await expect(
        keyLifecycle.registerKey(keyId, assetId, version, algorithm)
      ).to.be.revertedWith("Key already exists");
    });

    it("should return false for unregistered key in isKeyActive", async function () {
      const ghostKeyId = ethers.id("key-never-registered");
      expect(await keyLifecycle.isKeyActive(ghostKeyId)).to.be.false;
    });
  });

  describe("Key Rotation", function () {
    const oldKeyId = ethers.id("key-old");
    const newKeyId = ethers.id("key-new");
    const assetId = ethers.id("asset-rotate");
    const initialVersion = 1;
    const newVersion = 2;
    const algorithm = 1;

    beforeEach(async function () {
      await keyLifecycle.registerKey(oldKeyId, assetId, initialVersion, algorithm);
    });

    it("should allow owner to rotate an active key", async function () {
      await expect(keyLifecycle.rotateKey(oldKeyId, newKeyId, newVersion))
        .to.emit(keyLifecycle, "KeyRotated")
        .withArgs(oldKeyId, newKeyId);

      // Verify old key status transitioned to Rotated
      const oldMeta = await keyLifecycle.getKeyMetadata(oldKeyId);
      expect(oldMeta.status).to.equal(KeyState.Rotated);
      expect(oldMeta.rotatedAt).to.be.gt(0);
      expect(await keyLifecycle.isKeyActive(oldKeyId)).to.be.false;

      // Verify new key status is Active and inherits assetId + algorithm
      const newMeta = await keyLifecycle.getKeyMetadata(newKeyId);
      expect(newMeta.keyId).to.equal(newKeyId);
      expect(newMeta.assetId).to.equal(assetId);
      expect(newMeta.version).to.equal(newVersion);
      expect(newMeta.algorithm).to.equal(algorithm);
      expect(newMeta.status).to.equal(KeyState.Active);
      expect(newMeta.createdAt).to.be.gt(0);
      expect(newMeta.rotatedAt).to.equal(0);
      expect(await keyLifecycle.isKeyActive(newKeyId)).to.be.true;
    });

    it("should revert if non-admin tries to rotate key", async function () {
      await expect(
        keyLifecycle.connect(nonAdmin).rotateKey(oldKeyId, newKeyId, newVersion)
      ).to.be.revertedWithCustomError(keyLifecycle, "OwnableUnauthorizedAccount");
    });

    it("should revert if old key does not exist", async function () {
      const ghostKeyId = ethers.id("key-ghost");
      await expect(
        keyLifecycle.rotateKey(ghostKeyId, newKeyId, newVersion)
      ).to.be.revertedWith("Old key not found");
    });

    it("should revert if old key is not active", async function () {
      // First rotate old -> new
      await keyLifecycle.rotateKey(oldKeyId, newKeyId, newVersion);
      // Attempting to rotate oldKey again must fail since it is already Rotated
      const thirdKeyId = ethers.id("key-third");
      await expect(
        keyLifecycle.rotateKey(oldKeyId, thirdKeyId, 3)
      ).to.be.revertedWith("Old key not active");
    });

    it("should revert if new key already exists", async function () {
      const existingKeyId = ethers.id("key-already-there");
      await keyLifecycle.registerKey(existingKeyId, assetId, 1, algorithm);
      await expect(
        keyLifecycle.rotateKey(oldKeyId, existingKeyId, newVersion)
      ).to.be.revertedWith("New key already exists");
    });

    it("should revert if rotating a revoked key", async function () {
      await keyLifecycle.revokeKey(oldKeyId);
      const thirdKeyId = ethers.id("key-third-rotate");
      await expect(
        keyLifecycle.rotateKey(oldKeyId, thirdKeyId, 3)
      ).to.be.revertedWith("Old key not active");
    });
  });

  describe("Key Revocation", function () {
    const keyId = ethers.id("key-revoke");
    const assetId = ethers.id("asset-revoke");

    beforeEach(async function () {
      await keyLifecycle.registerKey(keyId, assetId, 1, 1);
    });

    it("should allow owner to revoke an active key", async function () {
      await expect(keyLifecycle.revokeKey(keyId))
        .to.emit(keyLifecycle, "KeyRevoked")
        .withArgs(keyId);

      const meta = await keyLifecycle.getKeyMetadata(keyId);
      expect(meta.status).to.equal(KeyState.Revoked);
      expect(meta.revokedAt).to.be.gt(0);
      expect(await keyLifecycle.isKeyActive(keyId)).to.be.false;
    });

    it("should allow owner to revoke a rotated key", async function () {
      const rotatedKeyId = ethers.id("key-rotated-target");
      await keyLifecycle.rotateKey(keyId, rotatedKeyId, 2);

      await expect(keyLifecycle.revokeKey(keyId))
        .to.emit(keyLifecycle, "KeyRevoked")
        .withArgs(keyId);

      const meta = await keyLifecycle.getKeyMetadata(keyId);
      expect(meta.status).to.equal(KeyState.Revoked);
      expect(meta.revokedAt).to.be.gt(0);
    });

    it("should revert if non-admin tries to revoke key", async function () {
      await expect(
        keyLifecycle.connect(nonAdmin).revokeKey(keyId)
      ).to.be.revertedWithCustomError(keyLifecycle, "OwnableUnauthorizedAccount");
    });

    it("should revert if key does not exist", async function () {
      const ghostKeyId = ethers.id("key-not-found");
      await expect(
        keyLifecycle.revokeKey(ghostKeyId)
      ).to.be.revertedWith("Key not found");
    });

    it("should revert if key is already revoked", async function () {
      await keyLifecycle.revokeKey(keyId);
      await expect(
        keyLifecycle.revokeKey(keyId)
      ).to.be.revertedWith("Invalid state for revocation");
    });
  });
});
