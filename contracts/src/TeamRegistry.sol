// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {EnhancedAccessControl} from "@ens/v2/access-control/EnhancedAccessControl.sol";

import {ITeam} from "./ITeam.sol";

/// @title TeamRegistry
/// @notice A team roster held in native ENSv2 Enhanced Access Control. Admins grant and revoke
///         `ROLE_MEMBER` with the stock `grantRoles` / `revokeRoles`; the only bespoke surface is
///         the `isMember` view that `CascadeSubregistry` calls.
/// @dev Inherits EAC's 15-assignees-per-role cap: a small, stable team, not an org chart. Admins can
///      grant the admin role to others (standard EAC), so the admin set is auditable via
///      `EACRolesChanged` but not frozen.
contract TeamRegistry is EnhancedAccessControl, ITeam {
    /// @notice The single resource members are granted on. `grantRoles` rejects `ROOT_RESOURCE`.
    uint256 public constant TEAM_RESOURCE = 1;

    uint256 public constant ROLE_MEMBER = 1 << 0;
    uint256 public constant ROLE_MEMBER_ADMIN = ROLE_MEMBER << 128;

    /// @param admins Accounts that may grant and revoke membership. They are not members themselves.
    constructor(address[] memory admins) {
        for (uint256 i = 0; i < admins.length; ++i) {
            _grantRoles(ROOT_RESOURCE, ROLE_MEMBER_ADMIN, admins[i], false);
        }
    }

    /// @inheritdoc ITeam
    function isMember(address account) external view returns (bool) {
        return hasRoles(TEAM_RESOURCE, ROLE_MEMBER, account);
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(ITeam).interfaceId || super.supportsInterface(interfaceId);
    }
}
