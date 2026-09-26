// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ITeam} from "../ITeam.sol";

/// @notice DEMO FIXTURE — the attacker's contract in the hijack step. Declares ITeam and says every
///         address is a member. Pointing a CascadeSubregistry at it would hand the team's role to
///         anyone, which is why `setTeam` requires ROLE_SET_TEAM.
contract AlwaysTrueTeam is ITeam {
    function isMember(address) external pure returns (bool) {
        return true;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(ITeam).interfaceId || interfaceId == 0x01ffc9a7;
    }
}
