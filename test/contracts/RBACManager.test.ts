import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { RBACManager } from "../../typechain-types";

describe("RBACManager", function () {
  let rbacManager: RBACManager;
  let owner: any;
  let nonAdmin: any;

  beforeEach(async function () {
    [owner, nonAdmin] = await ethers.getSigners();
    const RBACManagerFactory = await ethers.getContractFactory("RBACManager");
    rbacManager = await RBACManagerFactory.deploy();
  });

  describe("Access Control", function () {
    const did = "did:securemax:user:eng01";
    const role = 2; // ENGINEER
    const permissions = 0x05; // Bits 0 and 2

    it("should allow admin to assign a role with bitmask permissions", async function () {
      await expect(rbacManager.assignRole(did, role, permissions))
        .to.emit(rbacManager, "RoleAssigned")
        .withArgs(did, role, permissions);

      const assignment = await rbacManager.getRole(did);
      expect(assignment.did).to.equal(did);
      expect(assignment.role).to.equal(role);
      expect(assignment.permissions).to.equal(permissions);
      expect(assignment.isActive).to.be.true;

      expect(await rbacManager.hasPermission(did, 0x01)).to.be.true;
      expect(await rbacManager.hasPermission(did, 0x04)).to.be.true;
      expect(await rbacManager.hasPermission(did, 0x02)).to.be.false;
    });

    it("should revert if non-admin tries to assign a role", async function () {
      await expect(
        rbacManager.connect(nonAdmin).assignRole(did, role, permissions)
      ).to.be.revertedWithCustomError(rbacManager, "OwnableUnauthorizedAccount");
    });
  });

  describe("Role Revocation", function () {
    const did = "did:securemax:user:eng02";

    beforeEach(async function () {
      await rbacManager.assignRole(did, 2, 0x07);
    });

    it("should allow admin to revoke an active role", async function () {
      await expect(rbacManager.revokeRole(did))
        .to.emit(rbacManager, "RoleRevoked")
        .withArgs(did);

      const assignment = await rbacManager.getRole(did);
      expect(assignment.isActive).to.be.false;
      expect(await rbacManager.hasPermission(did, 0x01)).to.be.false;
    });

    it("should revert when revoking an already inactive role", async function () {
      await rbacManager.revokeRole(did);
      await expect(rbacManager.revokeRole(did)).to.be.revertedWith("Role not active");
    });

    it("should revert if non-admin tries to revoke a role", async function () {
      await expect(
        rbacManager.connect(nonAdmin).revokeRole(did)
      ).to.be.revertedWithCustomError(rbacManager, "OwnableUnauthorizedAccount");
    });
  });
});
