// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RBACManager is Ownable, ReentrancyGuard {
    struct RoleAssignment {
        string did;
        uint8 role;
        uint256 permissions;
        uint256 assignedAt;
        bool isActive;
    }

    mapping(string => RoleAssignment) private assignments;

    event RoleAssigned(string did, uint8 role, uint256 permissions);
    event RoleRevoked(string did);

    constructor() Ownable(msg.sender) {}

    function assignRole(string memory did, uint8 role, uint256 permissions) external onlyOwner nonReentrant {
        assignments[did] = RoleAssignment({
            did: did,
            role: role,
            permissions: permissions,
            assignedAt: block.timestamp,
            isActive: true
        });
        emit RoleAssigned(did, role, permissions);
    }

    function revokeRole(string memory did) external onlyOwner nonReentrant {
        require(assignments[did].isActive, "Role not active");
        assignments[did].isActive = false;
        emit RoleRevoked(did);
    }

    function hasPermission(string memory did, uint256 permissionBit) external view returns (bool) {
        if (!assignments[did].isActive) return false;
        return (assignments[did].permissions & permissionBit) == permissionBit;
    }

    function getRole(string memory did) external view returns (RoleAssignment memory) {
        return assignments[did];
    }
}
