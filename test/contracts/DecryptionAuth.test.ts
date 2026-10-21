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

  describe("Authorization Lifecycle", function () {
    const authId = ethers.id("auth-record-01");
    const userDid = "did:securemax:user:vasu";
    const assetId = ethers.id("asset-radar-01");
    const keyId = ethers.id("key-radar-01");

    it("should allow admin to record decryption authorization", async function () {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;

      await expect(decryptionAuth.recordAuthorization(authId, userDid, assetId, keyId, expiresAt))
        .to.emit(decryptionAuth, "DecryptionAuthorized")
        .withArgs(authId, userDid, assetId);

      expect(await decryptionAuth.isAuthorizationValid(authId)).to.be.true;

      const record = await decryptionAuth.getAuthorization(authId);
      expect(record.userDid).to.equal(userDid);
      expect(record.assetId).to.equal(assetId);
      expect(record.keyId).to.equal(keyId);
    });

    it("should reject duplicate authId", async function () {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      await decryptionAuth.recordAuthorization(authId, userDid, assetId, keyId, expiresAt);

      await expect(
        decryptionAuth.recordAuthorization(authId, userDid, assetId, keyId, expiresAt)
      ).to.be.revertedWith("Auth ID already exists");
    });

    it("should allow admin to record completion", async function () {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      await decryptionAuth.recordAuthorization(authId, userDid, assetId, keyId, expiresAt);

      await expect(decryptionAuth.recordCompletion(authId))
        .to.emit(decryptionAuth, "DecryptionCompleted")
        .withArgs(authId);

      // Once completed, authorization is no longer valid for another decryption
      expect(await decryptionAuth.isAuthorizationValid(authId)).to.be.false;
    });

    it("should allow admin to record denial with reason", async function () {
      const denialAuthId = ethers.id("auth-denied-01");
      const reason = "Zero-trust policy violation: unassigned asset";

      await expect(decryptionAuth.recordDenial(denialAuthId, userDid, assetId, reason))
        .to.emit(decryptionAuth, "DecryptionDenied")
        .withArgs(denialAuthId, userDid, assetId, reason);

      expect(await decryptionAuth.isAuthorizationValid(denialAuthId)).to.be.false;
    });

    it("should revert if non-admin attempts to record authorization", async function () {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      await expect(
        decryptionAuth.connect(nonAdmin).recordAuthorization(authId, userDid, assetId, keyId, expiresAt)
      ).to.be.revertedWithCustomError(decryptionAuth, "OwnableUnauthorizedAccount");
    });
  });
});
