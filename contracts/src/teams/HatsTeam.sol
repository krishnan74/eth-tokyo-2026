// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ITeam} from "../ITeam.sol";

/// @notice The one Hats Protocol call the adapter needs. `isWearerOfHat` already accounts for the
///         hat's eligibility and toggle modules.
interface IHats {
    function isWearerOfHat(address wearer, uint256 hatId) external view returns (bool);
}

/// @title HatsTeam
/// @notice Roadmap step 4, bring your own roster: whoever wears `hatId` is a member. Membership is
///         managed entirely in Hats; nothing is copied here and nothing about ENS changes.
/// @dev Hats may call its own eligibility modules; if that exceeds the caller's gas cap, the answer is
///      "not a member" (Cascade fails closed).
contract HatsTeam is ITeam {
    IHats public immutable hats;
    uint256 public immutable hatId;

    constructor(IHats hats_, uint256 hatId_) {
        (hats, hatId) = (hats_, hatId_);
    }

    /// @inheritdoc ITeam
    function isMember(address account) external view returns (bool) {
        return hats.isWearerOfHat(account, hatId);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(ITeam).interfaceId || interfaceId == 0x01ffc9a7;
    }
}
