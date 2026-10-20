// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract KeyPolicyManager is Ownable, ReentrancyGuard {
    struct KeyPolicy {
        bytes32 policyId;
        bytes32 keyId;
        uint8 policyType;
        bytes32 conditionsHash;
        bool isActive;
        uint256 createdAt;
        uint256 updatedAt;
    }

    mapping(bytes32 => KeyPolicy) private policies;

    event PolicyCreated(bytes32 indexed policyId, bytes32 indexed keyId);
    event PolicyUpdated(bytes32 indexed policyId);
    event PolicyDeactivated(bytes32 indexed policyId);

    constructor() Ownable(msg.sender) {}

    function createPolicy(bytes32 policyId, bytes32 keyId, uint8 policyType, bytes32 conditionsHash) external onlyOwner nonReentrant {
        require(policies[policyId].createdAt == 0, "Policy already exists");
        policies[policyId] = KeyPolicy({
            policyId: policyId,
            keyId: keyId,
            policyType: policyType,
            conditionsHash: conditionsHash,
            isActive: true,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        emit PolicyCreated(policyId, keyId);
    }

    function updatePolicy(bytes32 policyId, bytes32 newConditionsHash) external onlyOwner nonReentrant {
        require(policies[policyId].createdAt != 0, "Policy not found");
        require(policies[policyId].isActive, "Policy is inactive");
        policies[policyId].conditionsHash = newConditionsHash;
        policies[policyId].updatedAt = block.timestamp;
        emit PolicyUpdated(policyId);
    }

    function deactivatePolicy(bytes32 policyId) external onlyOwner nonReentrant {
        require(policies[policyId].createdAt != 0, "Policy not found");
        require(policies[policyId].isActive, "Policy is inactive");
        policies[policyId].isActive = false;
        policies[policyId].updatedAt = block.timestamp;
        emit PolicyDeactivated(policyId);
    }

    function getPolicy(bytes32 policyId) external view returns (KeyPolicy memory) {
        return policies[policyId];
    }

    function isPolicyActive(bytes32 policyId) external view returns (bool) {
        return policies[policyId].isActive;
    }
}
