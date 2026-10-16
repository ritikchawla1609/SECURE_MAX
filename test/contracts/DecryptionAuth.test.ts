import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { DecryptionAuth } from "../../typechain-types";

describe("DecryptionAuth", function () {
  let decryptionAuth: DecryptionAuth;
  let owner: any;
  let nonAdmin: any;

  beforeEach(async function () {
    [owner, nonAdmin] = await ethers.getSigners();
    const DecryptionAuthFactory = await ethers.getContractFactory("DecryptionAuth");
    decryptionAuth = await DecryptionAuthFactory.deploy();
  });

  describe("Access Control", function () {
    const authId = ethers.id("auth-1");
    const userDid = "did:securemax:user1";
    const assetId = ethers.id("asset-1");
    const keyId = ethers.id("key-1");

    it("should allow owner to record authorization", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiresAt = (latestBlock?.timestamp ?? 0) + 3600;

      await expect(decryptionAuth.recordAuthorization(authId, userDid, assetId, keyId, expiresAt))
        .to.emit(decryptionAuth, "DecryptionAuthorized")
        .withArgs(authId, userDid, assetId);

      const record = await decryptionAuth.getAuthorization(authId);
      expect(record.userDid).to.equal(userDid);
      expect(record.assetId).to.equal(assetId);
      expect(record.keyId).to.equal(keyId);
      expect(record.result).to.equal(1); // ISecureMax.AuthResult.Authorized
      expect(await decryptionAuth.isAuthorizationValid(authId)).to.be.true;
    });

    it("should revert if non-admin tries to record authorization", async function () {
      await expect(
        decryptionAuth.connect(nonAdmin).recordAuthorization(authId, userDid, assetId, keyId, 1000)
      ).to.be.revertedWithCustomError(decryptionAuth, "OwnableUnauthorizedAccount");
    });
  });

  describe("Lifecycle & Validity", function () {
    const authId = ethers.id("auth-lifecycle");
    const userDid = "did:securemax:analyst";
    const assetId = ethers.id("asset-secret");
    const keyId = ethers.id("key-secret");

    it("should handle recordCompletion correctly", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiresAt = (latestBlock?.timestamp ?? 0) + 1800;

      await decryptionAuth.recordAuthorization(authId, userDid, assetId, keyId, expiresAt);
      expect(await decryptionAuth.isAuthorizationValid(authId)).to.be.true;

      await expect(decryptionAuth.recordCompletion(authId))
        .to.emit(decryptionAuth, "DecryptionCompleted")
        .withArgs(authId);

      const record = await decryptionAuth.getAuthorization(authId);
      expect(record.result).to.equal(3); // Completed
      expect(await decryptionAuth.isAuthorizationValid(authId)).to.be.false;
    });

    it("should record denial correctly", async function () {
      const denialAuthId = ethers.id("auth-denied");
      await expect(
        decryptionAuth.recordDenial(denialAuthId, userDid, assetId, "Insufficient clearance")
      )
        .to.emit(decryptionAuth, "DecryptionDenied")
        .withArgs(denialAuthId, userDid, assetId, "Insufficient clearance");

      const record = await decryptionAuth.getAuthorization(denialAuthId);
      expect(record.result).to.equal(2); // Denied
      expect(await decryptionAuth.isAuthorizationValid(denialAuthId)).to.be.false;
    });

    it("should reject duplicate authId", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiresAt = (latestBlock?.timestamp ?? 0) + 1800;

      await decryptionAuth.recordAuthorization(authId, userDid, assetId, keyId, expiresAt);
      await expect(
        decryptionAuth.recordAuthorization(authId, userDid, assetId, keyId, expiresAt)
      ).to.be.revertedWith("Auth ID already exists");
    });

    it("should return false for expired authorization", async function () {
      const expiredAuthId = ethers.id("auth-expired");
      const latestBlock = await ethers.provider.getBlock("latest");
      // Set expiresAt in the past
      const pastTime = (latestBlock?.timestamp ?? 1000) - 100;

      await decryptionAuth.recordAuthorization(expiredAuthId, userDid, assetId, keyId, pastTime);
      expect(await decryptionAuth.isAuthorizationValid(expiredAuthId)).to.be.false;
    });

    it("should return false for non-existent authId in isAuthorizationValid", async function () {
      const nonExistent = ethers.id("auth-ghost");
      expect(await decryptionAuth.isAuthorizationValid(nonExistent)).to.be.false;
    });

    it("should revert if non-admin tries to record completion", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const testAuthId = ethers.id("auth-owner-check");
      await decryptionAuth.recordAuthorization(testAuthId, userDid, assetId, keyId, (latestBlock?.timestamp ?? 0) + 1800);
      await expect(
        decryptionAuth.connect(nonAdmin).recordCompletion(testAuthId)
      ).to.be.revertedWithCustomError(decryptionAuth, "OwnableUnauthorizedAccount");
    });

    it("should revert if non-admin tries to record denial", async function () {
      const testAuthId = ethers.id("auth-denial-check");
      await expect(
        decryptionAuth.connect(nonAdmin).recordDenial(testAuthId, userDid, assetId, "Unauthorized")
      ).to.be.revertedWithCustomError(decryptionAuth, "OwnableUnauthorizedAccount");
    });

    it("should revert recordCompletion if authId does not exist", async function () {
      const ghostAuthId = ethers.id("auth-does-not-exist");
      await expect(
        decryptionAuth.recordCompletion(ghostAuthId)
      ).to.be.revertedWith("Auth ID not found");
    });

    it("should revert recordCompletion if already completed", async function () {
      const testAuthId = ethers.id("auth-double-complete");
      const latestBlock = await ethers.provider.getBlock("latest");
      await decryptionAuth.recordAuthorization(testAuthId, userDid, assetId, keyId, (latestBlock?.timestamp ?? 0) + 1800);
      await decryptionAuth.recordCompletion(testAuthId);
      await expect(
        decryptionAuth.recordCompletion(testAuthId)
      ).to.be.revertedWith("Not authorized");
    });
  });
});
