import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { AuditAnchor } from "../../typechain-types";

describe("AuditAnchor", function () {
  let auditAnchor: AuditAnchor;
  let owner: any;
  let nonAdmin: any;

  beforeEach(async function () {
    [owner, nonAdmin] = await ethers.getSigners();
    const AuditAnchorFactory = await ethers.getContractFactory("AuditAnchor");
    auditAnchor = await AuditAnchorFactory.deploy();
  });

  describe("Access Control", function () {
    const root = ethers.keccak256(ethers.toUtf8Bytes("batch-root-1"));

    it("should allow owner to anchor Merkle root", async function () {
      await expect(auditAnchor.anchorMerkleRoot(1, 100, root))
        .to.emit(auditAnchor, "MerkleRootAnchored")
        .withArgs(1, 100, root);

      expect(await auditAnchor.getAnchorCount()).to.equal(1);
      const anchor = await auditAnchor.getLatestAnchor();
      expect(anchor.batchStartId).to.equal(1);
      expect(anchor.batchEndId).to.equal(100);
      expect(anchor.merkleRoot).to.equal(root);
    });

    it("should revert if non-admin tries to anchor", async function () {
      await expect(
        auditAnchor.connect(nonAdmin).anchorMerkleRoot(1, 100, root)
      ).to.be.revertedWithCustomError(auditAnchor, "OwnableUnauthorizedAccount");
    });
  });

  describe("Validation & Retrieval", function () {
    const root1 = ethers.keccak256(ethers.toUtf8Bytes("batch-root-1"));
    const root2 = ethers.keccak256(ethers.toUtf8Bytes("batch-root-2"));

    it("should revert if batch range is invalid", async function () {
      await expect(
        auditAnchor.anchorMerkleRoot(100, 50, root1)
      ).to.be.revertedWith("Invalid batch range");
    });

    it("should revert getLatestAnchor if no anchors exist", async function () {
      await expect(auditAnchor.getLatestAnchor()).to.be.revertedWith("No anchors found");
    });

    it("should revert getAnchor if index out of bounds", async function () {
      await expect(auditAnchor.getAnchor(0)).to.be.revertedWith("Index out of bounds");
    });

    it("should retrieve anchor by index correctly", async function () {
      await auditAnchor.anchorMerkleRoot(1, 50, root1);
      await auditAnchor.anchorMerkleRoot(51, 100, root2);

      expect(await auditAnchor.getAnchorCount()).to.equal(2);

      const first = await auditAnchor.getAnchor(0);
      expect(first.batchStartId).to.equal(1);
      expect(first.batchEndId).to.equal(50);
      expect(first.merkleRoot).to.equal(root1);

      const second = await auditAnchor.getAnchor(1);
      expect(second.batchStartId).to.equal(51);
      expect(second.batchEndId).to.equal(100);
      expect(second.merkleRoot).to.equal(root2);
    });
  });
});
