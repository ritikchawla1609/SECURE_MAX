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

  describe("Anchoring Operations", function () {
    const batchStart = 1;
    const batchEnd = 100;
    const root = ethers.id("merkle-root-batch-1");

    it("should allow admin to anchor a Merkle root batch", async function () {
      await expect(auditAnchor.anchorMerkleRoot(batchStart, batchEnd, root))
        .to.emit(auditAnchor, "MerkleRootAnchored")
        .withArgs(batchStart, batchEnd, root);

      expect(await auditAnchor.getAnchorCount()).to.equal(1);
      const anchor = await auditAnchor.getAnchor(0);
      expect(anchor.batchStartId).to.equal(batchStart);
      expect(anchor.batchEndId).to.equal(batchEnd);
      expect(anchor.merkleRoot).to.equal(root);

      const latest = await auditAnchor.getLatestAnchor();
      expect(latest.merkleRoot).to.equal(root);
    });

    it("should reject invalid batch range where batchEndId < batchStartId", async function () {
      await expect(auditAnchor.anchorMerkleRoot(100, 50, root))
        .to.be.revertedWith("Invalid batch range");
    });

    it("should revert if non-admin tries to anchor a Merkle root", async function () {
      await expect(
        auditAnchor.connect(nonAdmin).anchorMerkleRoot(batchStart, batchEnd, root)
      ).to.be.revertedWithCustomError(auditAnchor, "OwnableUnauthorizedAccount");
    });

    it("should revert when requesting latest anchor if none exists", async function () {
      await expect(auditAnchor.getLatestAnchor()).to.be.revertedWith("No anchors found");
    });
  });
});
