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
    const did = "did:securemax:user1";

    it("should allow owner to assign role", async function () {
      // Role 1 = USER, Permissions bitmask: 0x01 (READ) | 0x02 (DECRYPT) = 3
      await expect(rbacManager.assignRole(did, 1, 3))
        .to.emit(rbacManager, "RoleAssigned")
        .withArgs(did, 1, 3);

      const role = await rbacManager.getRole(did);
      expect(role.did).to.equal(did);
      expect(role.role).to.equal(1);
      expect(role.permissions).to.equal(3);
      expect(role.isActive).to.be.true;
    });

    it("should revert if non-admin tries to assign role", async function () {
      await expect(
        rbacManager.connect(nonAdmin).assignRole(did, 1, 3)
      ).to.be.revertedWithCustomError(rbacManager, "OwnableUnauthorizedAccount");
    });
  });

  describe("Permission Checks & Revocation", function () {
    const did = "did:securemax:engineer";

    beforeEach(async function () {
      // 0x01 = READ, 0x02 = DECRYPT, 0x04 = AUDIT
      await rbacManager.assignRole(did, 2, 3); // permissions = 3 (READ + DECRYPT)
    });

    it("should correctly evaluate hasPermission", async function () {
      expect(await rbacManager.hasPermission(did, 1)).to.be.true; // has READ
      expect(await rbacManager.hasPermission(did, 2)).to.be.true; // has DECRYPT
      expect(await rbacManager.hasPermission(did, 4)).to.be.false; // does not have AUDIT
    });

    it("should allow admin to revoke role and reflect in hasPermission", async function () {
      await expect(rbacManager.revokeRole(did))
        .to.emit(rbacManager, "RoleRevoked")
        .withArgs(did);

      expect(await rbacManager.hasPermission(did, 1)).to.be.false;
      expect(await rbacManager.hasPermission(did, 2)).to.be.false;

      const role = await rbacManager.getRole(did);
      expect(role.isActive).to.be.false;
    });

    it("should revert revokeRole if role is not active", async function () {
      await rbacManager.revokeRole(did);
      await expect(rbacManager.revokeRole(did)).to.be.revertedWith("Role not active");
    });

    it("should revert if non-admin tries to revoke role", async function () {
      await expect(
        rbacManager.connect(nonAdmin).revokeRole(did)
      ).to.be.revertedWithCustomError(rbacManager, "OwnableUnauthorizedAccount");
    });
  });
});
