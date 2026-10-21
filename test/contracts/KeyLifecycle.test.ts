import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { KeyLifecycle } from "../../typechain-types";

describe("KeyLifecycle", function () {
  let keyLifecycle: KeyLifecycle;
  let owner: any;
  let nonAdmin: any;

  beforeEach(async function () {
    [owner, nonAdmin] = await ethers.getSigners();
    const KeyLifecycleFactory = await ethers.getContractFactory("KeyLifecycle");
    keyLifecycle = await KeyLifecycleFactory.deploy();
  });

  describe("Key Lifecycle Management", function () {
    const keyId = ethers.id("key-v1-radar");
    const assetId = ethers.id("asset-radar");
    const version = 1;
    const algorithm = 1; // AES-256-GCM

    it("should allow admin to register key metadata", async function () {
      await expect(keyLifecycle.registerKey(keyId, assetId, version, algorithm))
        .to.emit(keyLifecycle, "KeyRegistered")
        .withArgs(keyId, assetId);

      expect(await keyLifecycle.isKeyActive(keyId)).to.be.true;

      const metadata = await keyLifecycle.getKeyMetadata(keyId);
      expect(metadata.keyId).to.equal(keyId);
      expect(metadata.assetId).to.equal(assetId);
      expect(metadata.version).to.equal(version);
    });

    it("should reject duplicate keyId registration", async function () {
      await keyLifecycle.registerKey(keyId, assetId, version, algorithm);
      await expect(
        keyLifecycle.registerKey(keyId, assetId, version, algorithm)
      ).to.be.revertedWith("Key already exists");
    });

    it("should allow admin to rotate key", async function () {
      await keyLifecycle.registerKey(keyId, assetId, version, algorithm);
      const newKeyId = ethers.id("key-v2-radar");

      await expect(keyLifecycle.rotateKey(keyId, newKeyId, 2))
        .to.emit(keyLifecycle, "KeyRotated")
        .withArgs(keyId, newKeyId);

      // Old key is now rotated (inactive for new encryption)
      expect(await keyLifecycle.isKeyActive(keyId)).to.be.false;
      // New key is active
      expect(await keyLifecycle.isKeyActive(newKeyId)).to.be.true;
    });

    it("should allow admin to revoke key", async function () {
      await keyLifecycle.registerKey(keyId, assetId, version, algorithm);

      await expect(keyLifecycle.revokeKey(keyId))
        .to.emit(keyLifecycle, "KeyRevoked")
        .withArgs(keyId);

      expect(await keyLifecycle.isKeyActive(keyId)).to.be.false;
    });

    it("should revert if non-admin attempts key lifecycle operations", async function () {
      await expect(
        keyLifecycle.connect(nonAdmin).registerKey(keyId, assetId, version, algorithm)
      ).to.be.revertedWithCustomError(keyLifecycle, "OwnableUnauthorizedAccount");
    });
  });
});
