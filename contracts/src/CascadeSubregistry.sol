// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IEnhancedAccessControl} from "@ens/v2/access-control/interfaces/IEnhancedAccessControl.sol";
import {PermissionedRegistry} from "@ens/v2/registry/PermissionedRegistry.sol";
import {ILabelStore} from "@ens/v2/utils/interfaces/ILabelStore.sol";
import {LibLabel} from "@ens/v2/utils/LibLabel.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import {ITeam} from "./ITeam.sol";

/// @title CascadeSubregistry
/// @notice A `PermissionedRegistry` whose subnames inherit, one hop up, the roles the parent registry
///         grants a team contract on this registry's own name — for as long as the caller is a member.
///
/// @dev Mechanism. The fallthrough is an override of EAC's `_getRoles(resource, account)`, the hook EAC
///      documents for injecting role logic at read time and which `PermissionedRegistry` itself uses to
///      give ERC1155-approved operators the token owner's roles. For any non-root resource, an account's
///      roles are its own roles plus — if `team.isMember(account)` — the regular (non-admin) roles the
///      parent grants `team` on this registry's label. Because it is the hook, every consumer agrees:
///      `_checkRoles` on writes, the public `hasRoles` / `roles` views, and `explain`.
///
///      What cannot be inherited:
///        * Admin roles (upper 128 bits) are masked off, so members can never grant or revoke anything
///          (`_getSettableRoles` / `_getRevokableRoles` derive only from admin bits).
///        * Nothing on `ROOT_RESOURCE`: register, setParent, setTeam, upgrades stay native-only.
///
///      Trust assumption, deliberate: whoever holds `ROLE_SET_TEAM` on this registry is trusted to point
///      it at a genuine, well-behaved team contract. `setTeam` rejects non-contracts and contracts that
///      do not report `ITeam` via ERC-165, but a contract can lie about ERC-165; the role holder is the
///      real safeguard, exactly as a namespace admin is for any registry.
///
///      Invalidation. The pointer confers nothing by itself. The inherited roles are read live from
///      `parent.roles(label, team)`, which PermissionedRegistry scopes to the parent entry's current EAC
///      resource. When the parent name is unregistered, expires, or is re-registered, that resource
///      version changes and the team's grant stops applying — the same way every native grant on it
///      does. (Token-ID regeneration on grant/revoke does not change the resource, and transfers keep
///      third-party grants in place; both are stock ENSv2 behaviour, not specific to this contract.)
///
///      External calls. Both run inside view functions, so the EVM issues them as STATICCALLs: a
///      callback cannot modify any state, and write paths finish all checks before any effect. Each call
///      carries a fixed gas cap, so a misbehaving parent or team fails closed instead of consuming the
///      transaction's gas.
///
///      Scope. One hop only: a grant two levels above a subname is not found. A deeper tree needs a
///      CascadeSubregistry, correctly pointed at its own team and parent, at each level that should
///      inherit.
contract CascadeSubregistry is PermissionedRegistry {
    /// @notice Why a role check passed or failed. `explain` returns it; it is computed from the same
    ///         `_getRoles` hook the write path uses.
    struct Explanation {
        bool native; // caller holds the role here, on the name or on root, without inheritance
        address parent; // parent registry, from `setParent`
        string label; // this registry's label in the parent
        address team; // team contract the parent grant is checked for
        bool parentGrantsTeam; // parent.roles(label, team) contains the role (regular bits only)
        bool member; // team.isMember(caller), whether or not the decision needed it
        bool allowed; // what a write would decide (before its separate expiry check)
    }

    /// @notice Root role gating `setTeam`. Nybble 10, unused by RegistryRolesLib.
    uint256 public constant ROLE_SET_TEAM = 1 << 40;
    uint256 public constant ROLE_SET_TEAM_ADMIN = ROLE_SET_TEAM << 128;

    /// @notice Gas forwarded to the parent's `roles()` and the team's `isMember()`.
    uint256 public constant PARENT_CALL_GAS = 50_000;
    uint256 public constant MEMBER_CALL_GAS = 30_000;

    uint256 private constant REGULAR_ROLES = type(uint128).max;

    /// @notice The team whose members may inherit the parent's grant. Inert unless the parent grants it.
    address public team;

    event TeamPointerUpdated(address indexed oldTeam, address indexed newTeam, address indexed changedBy);

    error TeamNotContract(address team);
    error TeamInterfaceUnsupported(address team);

    constructor(ILabelStore labelStore, address rootAccount, uint256 roleBitmap)
        PermissionedRegistry(labelStore, rootAccount, roleBitmap)
    {}

    /// @notice Point the fallthrough at a team contract. Requires `ROLE_SET_TEAM` on root.
    function setTeam(address newTeam) external onlyRootRoles(ROLE_SET_TEAM) {
        if (newTeam.code.length == 0) revert TeamNotContract(newTeam);
        if (!ERC165Checker.supportsInterface(newTeam, type(ITeam).interfaceId)) revert TeamInterfaceUnsupported(newTeam);
        emit TeamPointerUpdated(team, newTeam, msg.sender);
        team = newTeam;
    }

    /// @notice The account's own roles on `anyId` (name or root), without anything inherited from the team.
    ///         `roles` / `hasRoles` include the inheritance; this is the stock-EAC-only view.
    function nativeRoles(uint256 anyId, address account) external view returns (uint256) {
        return super._getRoles(ROOT_RESOURCE, account) | super._getRoles(getResource(anyId), account);
    }

    /// @notice Explain whether `account` may exercise `roleBitmap` on `anyId`, and why.
    function explain(uint256 anyId, uint256 roleBitmap, address account)
        external
        view
        returns (Explanation memory e)
    {
        uint256 resource = getResource(anyId);
        e.native = (super._getRoles(ROOT_RESOURCE, account) | super._getRoles(resource, account)) & roleBitmap == roleBitmap;
        (e.parent, e.label, e.team) = (address(_parentRegistry), _childLabel, team);
        if (resource != ROOT_RESOURCE) {
            uint256 granted = _teamGrant();
            e.parentGrantsTeam = granted & roleBitmap == roleBitmap;
            if (e.team != address(0)) e.member = _isMember(account); // reported as a fact, even when not consulted
        }
        // The decision itself, through the same hook `_checkRoles` uses.
        e.allowed = hasRoles(anyId, roleBitmap, account);
    }

    /// @dev The fallthrough. See the contract-level notes.
    function _getRoles(uint256 resource, address account) internal view override returns (uint256 roleBitmap) {
        roleBitmap = super._getRoles(resource, account);
        if (resource == ROOT_RESOURCE) return roleBitmap;
        uint256 granted = _teamGrant();
        if (granted != 0 && _isMember(account)) roleBitmap |= granted;
    }

    /// @dev Regular roles the parent currently grants `team` on this registry's label; 0 on any failure.
    function _teamGrant() internal view returns (uint256) {
        address parent = address(_parentRegistry);
        if (team == address(0) || parent.code.length == 0 || parent == address(this)) return 0;
        (bool ok, uint256 r) = _staticUint(parent, PARENT_CALL_GAS,
            abi.encodeCall(IEnhancedAccessControl.roles, (LibLabel.id(_childLabel), team)));
        return ok ? r & REGULAR_ROLES : 0;
    }

    /// @dev `team.isMember(account)`, capped; false on any failure, including malformed return data.
    function _isMember(address account) internal view returns (bool) {
        (bool ok, uint256 r) = _staticUint(team, MEMBER_CALL_GAS, abi.encodeCall(ITeam.isMember, (account)));
        return ok && r == 1;
    }

    /// @dev A capped STATICCALL returning one word. Unlike try/catch, never reverts on short or
    ///      malformed return data, so a misbehaving callee cannot brick native checks on this registry.
    function _staticUint(address target, uint256 gasCap, bytes memory data) private view returns (bool ok, uint256 word) {
        bytes memory ret;
        (ok, ret) = target.staticcall{gas: gasCap}(data);
        if (!ok || ret.length < 32) return (false, 0);
        word = abi.decode(ret, (uint256));
    }
}
