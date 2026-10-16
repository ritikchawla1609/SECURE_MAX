// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/ISecureMax.sol";

contract DecryptionAuth is Ownable, ReentrancyGuard {
    struct AuthorizationRecord {
        bytes32 authId;
        string userDid;
        bytes32 assetId;
        bytes32 keyId;
        ISecureMax.AuthResult result;
        uint256 timestamp;
        uint256 expiresAt;
    }

    mapping(bytes32 => AuthorizationRecord) private authorizations;

    event DecryptionAuthorized(bytes32 indexed authId, string userDid, bytes32 indexed assetId);
    event DecryptionCompleted(bytes32 indexed authId);
    event DecryptionDenied(bytes32 indexed authId, string userDid, bytes32 indexed assetId, string reason);

    constructor() Ownable(msg.sender) {}

    function recordAuthorization(bytes32 authId, string memory userDid, bytes32 assetId, bytes32 keyId, uint256 expiresAt) external onlyOwner nonReentrant {
        require(authorizations[authId].timestamp == 0, "Auth ID already exists");
        authorizations[authId] = AuthorizationRecord({
            authId: authId,
            userDid: userDid,
            assetId: assetId,
            keyId: keyId,
            result: ISecureMax.AuthResult.Authorized,
            timestamp: block.timestamp,
            expiresAt: expiresAt
        });
        emit DecryptionAuthorized(authId, userDid, assetId);
    }

    function recordCompletion(bytes32 authId) external onlyOwner nonReentrant {
        require(authorizations[authId].timestamp != 0, "Auth ID not found");
        require(authorizations[authId].result == ISecureMax.AuthResult.Authorized, "Not authorized");
        authorizations[authId].result = ISecureMax.AuthResult.Completed;
        emit DecryptionCompleted(authId);
    }

    function recordDenial(bytes32 authId, string memory userDid, bytes32 assetId, string memory reason) external onlyOwner nonReentrant {
        require(authorizations[authId].timestamp == 0, "Auth ID already exists");
        authorizations[authId] = AuthorizationRecord({
            authId: authId,
            userDid: userDid,
            assetId: assetId,
            keyId: bytes32(0),
            result: ISecureMax.AuthResult.Denied,
            timestamp: block.timestamp,
            expiresAt: block.timestamp
        });
        emit DecryptionDenied(authId, userDid, assetId, reason);
    }

    function getAuthorization(bytes32 authId) external view returns (AuthorizationRecord memory) {
        return authorizations[authId];
    }

    function isAuthorizationValid(bytes32 authId) external view returns (bool) {
        AuthorizationRecord memory auth = authorizations[authId];
        if (auth.timestamp == 0) return false;
        if (auth.result != ISecureMax.AuthResult.Authorized) return false;
        if (block.timestamp > auth.expiresAt) return false;
        return true;
    }
}
