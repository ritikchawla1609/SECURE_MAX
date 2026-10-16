// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/ISecureMax.sol";

contract IdentityRegistry is Ownable, Pausable, ReentrancyGuard {
    struct Identity {
        address owner;
        string did;
        bytes32 nameHash;
        uint8 role;
        ISecureMax.IdentityStatus status;
        uint256 registeredAt;
        uint256 updatedAt;
    }

    mapping(string => Identity) private identities;

    event IdentityRegistered(string did, address owner, uint8 role);
    event IdentityStatusChanged(string did, ISecureMax.IdentityStatus status);
    event RoleUpdated(string did, uint8 oldRole, uint8 newRole);

    constructor() Ownable(msg.sender) {}

    function registerIdentity(address _owner, string memory did, bytes32 nameHash, uint8 role) external onlyOwner whenNotPaused nonReentrant {
        require(identities[did].owner == address(0), "DID already registered");
        identities[did] = Identity({
            owner: _owner,
            did: did,
            nameHash: nameHash,
            role: role,
            status: ISecureMax.IdentityStatus.Active,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp
        });
        emit IdentityRegistered(did, _owner, role);
    }

    function updateStatus(string memory did, ISecureMax.IdentityStatus status) external onlyOwner whenNotPaused nonReentrant {
        require(identities[did].owner != address(0), "Identity not found");
        identities[did].status = status;
        identities[did].updatedAt = block.timestamp;
        emit IdentityStatusChanged(did, status);
    }

    function updateRole(string memory did, uint8 role) external onlyOwner whenNotPaused nonReentrant {
        require(identities[did].owner != address(0), "Identity not found");
        uint8 oldRole = identities[did].role;
        identities[did].role = role;
        identities[did].updatedAt = block.timestamp;
        emit RoleUpdated(did, oldRole, role);
    }

    function getIdentity(string memory did) external view returns (Identity memory) {
        return identities[did];
    }

    function isActive(string memory did) external view returns (bool) {
        return identities[did].status == ISecureMax.IdentityStatus.Active;
    }
}
