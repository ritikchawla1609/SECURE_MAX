// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/ISecureMax.sol";

contract AssetRegistry is Ownable, ReentrancyGuard {
    struct Asset {
        bytes32 assetId;
        string assetCode;
        bytes32 contentHash;
        uint8 classification;
        string ownerDid;
        uint8 status;
        uint256 registeredAt;
    }

    struct Assignment {
        bytes32 assetId;
        string assigneeDid;
        uint8 permissions;
        bool isActive;
        uint256 assignedAt;
        uint256 revokedAt;
    }

    mapping(bytes32 => Asset) private assets;
    mapping(bytes32 => mapping(string => Assignment)) private assignments;

    event AssetRegistered(bytes32 indexed assetId, string ownerDid);
    event AssetAssigned(bytes32 indexed assetId, string assigneeDid, uint8 permissions);
    event AssignmentRevoked(bytes32 indexed assetId, string assigneeDid);
    event AssetOwnershipTransferred(bytes32 indexed assetId, string newOwnerDid);

    constructor() Ownable(msg.sender) {}

    function registerAsset(
        bytes32 assetId, 
        string memory assetCode, 
        bytes32 contentHash, 
        uint8 classification, 
        string memory ownerDid
    ) external onlyOwner nonReentrant {
        require(assets[assetId].registeredAt == 0, "Asset already registered");
        assets[assetId] = Asset({
            assetId: assetId,
            assetCode: assetCode,
            contentHash: contentHash,
            classification: classification,
            ownerDid: ownerDid,
            status: 1,
            registeredAt: block.timestamp
        });
        emit AssetRegistered(assetId, ownerDid);
    }

    function assignAsset(bytes32 assetId, string memory assigneeDid, uint8 permissions) external onlyOwner nonReentrant {
        require(assets[assetId].registeredAt != 0, "Asset not found");
        assignments[assetId][assigneeDid] = Assignment({
            assetId: assetId,
            assigneeDid: assigneeDid,
            permissions: permissions,
            isActive: true,
            assignedAt: block.timestamp,
            revokedAt: 0
        });
        emit AssetAssigned(assetId, assigneeDid, permissions);
    }

    function revokeAssignment(bytes32 assetId, string memory assigneeDid) external onlyOwner nonReentrant {
        require(assignments[assetId][assigneeDid].isActive, "Assignment not active");
        assignments[assetId][assigneeDid].isActive = false;
        assignments[assetId][assigneeDid].revokedAt = block.timestamp;
        emit AssignmentRevoked(assetId, assigneeDid);
    }

    function transferAssetOwnership(bytes32 assetId, string memory newOwnerDid) external onlyOwner nonReentrant {
        require(assets[assetId].registeredAt != 0, "Asset not found");
        assets[assetId].ownerDid = newOwnerDid;
        emit AssetOwnershipTransferred(assetId, newOwnerDid);
    }

    function getAsset(bytes32 assetId) external view returns (Asset memory) {
        return assets[assetId];
    }

    function getAssignment(bytes32 assetId, string memory assigneeDid) external view returns (Assignment memory) {
        return assignments[assetId][assigneeDid];
    }

    function isAssigned(bytes32 assetId, string memory assigneeDid) external view returns (bool) {
        return assignments[assetId][assigneeDid].isActive;
    }
}
