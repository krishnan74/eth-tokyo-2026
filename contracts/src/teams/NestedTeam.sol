// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import {EnhancedAccessControl} from "@ens/v2/access-control/EnhancedAccessControl.sol";

import {ITeam} from "../ITeam.sol";

/// @notice A team that can contain other teams, with the nesting depth passed along so cycles end.
interface INestedTeam is ITeam {
    function isMemberWithin(address account, uint256 levels) external view returns (bool);
}

/// @title NestedTeam
/// @notice Roadmap step 2, teams of teams. A roster in native EAC (like `TeamRegistry`) that can also
///         include up to MAX_SUBTEAMS other teams: an account is a member if it holds `ROLE_MEMBER`
///         here, or is a member of a sub-team, looking at most MAX_NESTING levels down.
/// @dev Cascade needs no change: it still asks `isMember` once per team, inside its own gas cap.
///      Sub-teams are called with low-level STATICCALLs and a length check, so a broken sub-team
///      counts as "not a member" without affecting the others. No per-call cap is set here: the whole
///      lookup runs inside the caller's capped call, so a sub-team that burns gas can only make this
///      team answer "no" (fail closed). A cycle (A includes B includes A) ends at the depth limit.
contract NestedTeam is EnhancedAccessControl, INestedTeam {
    uint256 public constant TEAM_RESOURCE = 1;

    uint256 public constant ROLE_MEMBER = 1 << 0;
    uint256 public constant ROLE_MEMBER_ADMIN = ROLE_MEMBER << 128;
    /// @notice Root role for adding and removing sub-teams.
    uint256 public constant ROLE_SUBTEAMS = 1 << 4;
    uint256 public constant ROLE_SUBTEAMS_ADMIN = ROLE_SUBTEAMS << 128;

    uint256 public constant MAX_SUBTEAMS = 4;
    uint256 public constant MAX_NESTING = 3;

    struct SubTeam {
        address team;
        bool nested; // supports INestedTeam, so the remaining depth is passed down
    }

    SubTeam[] private _subTeams;

    event SubTeamAdded(address indexed team, address indexed changedBy);
    event SubTeamRemoved(address indexed team, address indexed changedBy);

    error SubTeamInvalid(address team);
    error SubTeamAlreadyAdded(address team);
    error SubTeamNotFound(address team);
    error TooManySubTeams();

    /// @param admins Accounts that may manage members and sub-teams. They are not members themselves.
    constructor(address[] memory admins) {
        for (uint256 i = 0; i < admins.length; ++i) {
            _grantRoles(ROOT_RESOURCE, ROLE_MEMBER_ADMIN | ROLE_SUBTEAMS | ROLE_SUBTEAMS_ADMIN, admins[i], false);
        }
    }

    function addSubTeam(address team) external onlyRootRoles(ROLE_SUBTEAMS) {
        if (team == address(this) || team.code.length == 0 || !ERC165Checker.supportsInterface(team, type(ITeam).interfaceId)) {
            revert SubTeamInvalid(team);
        }
        if (_subTeams.length >= MAX_SUBTEAMS) revert TooManySubTeams();
        for (uint256 i; i < _subTeams.length; ++i) if (_subTeams[i].team == team) revert SubTeamAlreadyAdded(team);
        _subTeams.push(SubTeam(team, ERC165Checker.supportsInterface(team, type(INestedTeam).interfaceId)));
        emit SubTeamAdded(team, msg.sender);
    }

    function removeSubTeam(address team) external onlyRootRoles(ROLE_SUBTEAMS) {
        uint256 n = _subTeams.length;
        for (uint256 i; i < n; ++i) {
            if (_subTeams[i].team == team) {
                _subTeams[i] = _subTeams[n - 1];
                _subTeams.pop();
                emit SubTeamRemoved(team, msg.sender);
                return;
            }
        }
        revert SubTeamNotFound(team);
    }

    function subTeams() external view returns (address[] memory list) {
        list = new address[](_subTeams.length);
        for (uint256 i; i < list.length; ++i) list[i] = _subTeams[i].team;
    }

    /// @inheritdoc ITeam
    function isMember(address account) external view returns (bool) {
        return _isMemberWithin(account, MAX_NESTING);
    }

    /// @inheritdoc INestedTeam
    function isMemberWithin(address account, uint256 levels) external view returns (bool) {
        return _isMemberWithin(account, levels > MAX_NESTING ? MAX_NESTING : levels);
    }

    function _isMemberWithin(address account, uint256 levels) internal view returns (bool) {
        if (hasRoles(TEAM_RESOURCE, ROLE_MEMBER, account)) return true;
        if (levels == 0) return false;
        for (uint256 i; i < _subTeams.length; ++i) {
            SubTeam memory s = _subTeams[i];
            bytes memory call = s.nested
                ? abi.encodeCall(INestedTeam.isMemberWithin, (account, levels - 1))
                : abi.encodeCall(ITeam.isMember, (account));
            if (_staticTrue(s.team, call)) return true;
        }
        return false;
    }

    /// @dev STATICCALL that is true only for an ABI-encoded `true`; copies one word at most.
    function _staticTrue(address target, bytes memory data) private view returns (bool yes) {
        assembly ("memory-safe") {
            let ok := staticcall(gas(), target, add(data, 32), mload(data), 0, 0)
            if and(ok, iszero(lt(returndatasize(), 32))) {
                returndatacopy(0, 0, 32)
                yes := eq(mload(0), 1)
            }
        }
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(ITeam).interfaceId || interfaceId == type(INestedTeam).interfaceId
            || super.supportsInterface(interfaceId);
    }
}
