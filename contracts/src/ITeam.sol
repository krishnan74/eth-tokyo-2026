// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice What `CascadeSubregistry` asks a team contract. Team contracts must also report this
///         interface through ERC-165, which `setTeam` checks.
interface ITeam {
    function isMember(address account) external view returns (bool);
}
