// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ITeam} from "../ITeam.sol";

/// @notice The one Safe call the adapter needs.
interface ISafeOwners {
    function isOwner(address owner) external view returns (bool);
}

/// @title SafeTeam
/// @notice Roadmap step 4, bring your own roster: the owners of a Safe are the members. Adding or
///         removing a Safe owner changes access on every inheriting name immediately.
contract SafeTeam is ITeam {
    ISafeOwners public immutable safe;

    constructor(ISafeOwners safe_) {
        safe = safe_;
    }

    /// @inheritdoc ITeam
    function isMember(address account) external view returns (bool) {
        return safe.isOwner(account);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(ITeam).interfaceId || interfaceId == 0x01ffc9a7;
    }
}
