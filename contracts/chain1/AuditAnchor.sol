// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AuditAnchor is Ownable, ReentrancyGuard {
    struct Anchor {
        uint256 batchStartId;
        uint256 batchEndId;
        bytes32 merkleRoot;
        uint256 anchoredAt;
    }

    Anchor[] private anchors;
    mapping(uint256 => uint256) private batchStartIndex;

    event MerkleRootAnchored(uint256 batchStartId, uint256 batchEndId, bytes32 merkleRoot);

    constructor() Ownable(msg.sender) {}

    function anchorMerkleRoot(uint256 batchStartId, uint256 batchEndId, bytes32 merkleRoot) external onlyOwner nonReentrant {
        require(batchEndId >= batchStartId, "Invalid batch range");
        Anchor memory newAnchor = Anchor({
            batchStartId: batchStartId,
            batchEndId: batchEndId,
            merkleRoot: merkleRoot,
            anchoredAt: block.timestamp
        });
        anchors.push(newAnchor);
        batchStartIndex[batchStartId] = anchors.length - 1;
        emit MerkleRootAnchored(batchStartId, batchEndId, merkleRoot);
    }

    function getAnchor(uint256 index) external view returns (Anchor memory) {
        require(index < anchors.length, "Index out of bounds");
        return anchors[index];
    }

    function getLatestAnchor() external view returns (Anchor memory) {
        require(anchors.length > 0, "No anchors found");
        return anchors[anchors.length - 1];
    }

    function getAnchorCount() external view returns (uint256) {
        return anchors.length;
    }
}
