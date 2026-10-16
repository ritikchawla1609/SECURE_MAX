// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISecureMax {
    enum IdentityStatus { Unregistered, Active, Suspended, Revoked }
    enum AssetClassification { Public, Internal, Confidential, Restricted, High }
    enum KeyState { Active, Rotating, Rotated, Revoked, Destroyed }
    enum AuthResult { Pending, Authorized, Denied, Completed }
}
