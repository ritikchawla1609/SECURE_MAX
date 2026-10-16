import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { AssetRegistry } from "../../typechain-types";

describe("AssetRegistry", function () {
  let assetRegistry: AssetRegistry;
  let owner: any;
  let nonAdmin: any;

  beforeEach(async function () {
    [owner, nonAdmin] = await ethers.getSigners();
    const AssetRegistryFactory = await ethers.getContractFactory("AssetRegistry");
    assetRegistry = await AssetRegistryFactory.deploy();
  });

  describe("Access Control", function () {
    const assetId = ethers.id("asset1");
    const assetCode = "ASSET-001";
    const contentHash = ethers.id("content1");
    const classification = 2; // Confidential
    const ownerDid = "did:securemax:user1";

    it("should allow admin to register asset", async function () {
      await expect(
        assetRegistry.registerAsset(assetId, assetCode, contentHash, classification, ownerDid)
      ).to.emit(assetRegistry, "AssetRegistered").withArgs(assetId, ownerDid);

      const asset = await assetRegistry.getAsset(assetId);
      expect(asset.ownerDid).to.equal(ownerDid);
      expect(asset.classification).to.equal(classification);
    });

    it("should revert if non-admin tries to register asset", async function () {
      await expect(
        assetRegistry.connect(nonAdmin).registerAsset(assetId, assetCode, contentHash, classification, ownerDid)
      ).to.be.revertedWithCustomError(assetRegistry, "OwnableUnauthorizedAccount");
    });
  });

  describe("Assignments", function () {
    const assetId = ethers.id("asset2");
    const ownerDid = "did:securemax:owner";
    const assigneeDid = "did:securemax:assignee";

    beforeEach(async function () {
      await assetRegistry.registerAsset(
        assetId,
        "ASSET-002",
        ethers.id("content2"),
        1,
        ownerDid
      );
    });

    it("should allow admin to assign asset", async function () {
      // Permission 1: can_read
      await expect(assetRegistry.assignAsset(assetId, assigneeDid, 1))
        .to.emit(assetRegistry, "AssetAssigned")
        .withArgs(assetId, assigneeDid, 1);

      expect(await assetRegistry.isAssigned(assetId, assigneeDid)).to.be.true;
    });

    it("should allow admin to revoke assignment", async function () {
      await assetRegistry.assignAsset(assetId, assigneeDid, 1);
      
      await expect(assetRegistry.revokeAssignment(assetId, assigneeDid))
        .to.emit(assetRegistry, "AssignmentRevoked")
        .withArgs(assetId, assigneeDid);

      expect(await assetRegistry.isAssigned(assetId, assigneeDid)).to.be.false;
    });
  });
});
