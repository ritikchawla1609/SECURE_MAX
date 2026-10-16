import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { IdentityRegistry } from "../../typechain-types";

describe("IdentityRegistry", function () {
  let identityRegistry: IdentityRegistry;
  let owner: any;
  let nonAdmin: any;

  beforeEach(async function () {
    [owner, nonAdmin] = await ethers.getSigners();
    const IdentityRegistryFactory = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistryFactory.deploy();
  });

  describe("Access Control", function () {
    it("should allow admin to register identity", async function () {
      const did = "did:securemax:user1";
      const nameHash = ethers.id("Alice");
      
      await expect(identityRegistry.registerIdentity(nonAdmin.address, did, nameHash, 1))
        .to.emit(identityRegistry, "IdentityRegistered")
        .withArgs(did, nonAdmin.address, 1);
        
      const identity = await identityRegistry.getIdentity(did);
      expect(identity.owner).to.equal(nonAdmin.address);
      expect(identity.did).to.equal(did);
      expect(identity.role).to.equal(1);
    });

    it("should revert if non-admin tries to register identity", async function () {
      const did = "did:securemax:user2";
      const nameHash = ethers.id("Bob");
      
      // We expect the custom Ownable error from OpenZeppelin v5
      await expect(
        identityRegistry.connect(nonAdmin).registerIdentity(nonAdmin.address, did, nameHash, 1)
      ).to.be.revertedWithCustomError(identityRegistry, "OwnableUnauthorizedAccount");
    });
  });

  describe("State Mutations", function () {
    const did = "did:securemax:user3";
    const nameHash = ethers.id("Charlie");

    beforeEach(async function () {
      await identityRegistry.registerIdentity(nonAdmin.address, did, nameHash, 1);
    });

    it("should correctly update role", async function () {
      await expect(identityRegistry.updateRole(did, 2))
        .to.emit(identityRegistry, "RoleUpdated")
        .withArgs(did, 1, 2);

      const identity = await identityRegistry.getIdentity(did);
      expect(identity.role).to.equal(2);
    });

    it("should correctly update status", async function () {
      // 2 is Suspended
      await expect(identityRegistry.updateStatus(did, 2))
        .to.emit(identityRegistry, "IdentityStatusChanged")
        .withArgs(did, 2);

      const isActive = await identityRegistry.isActive(did);
      expect(isActive).to.be.false;
    });
  });
});
