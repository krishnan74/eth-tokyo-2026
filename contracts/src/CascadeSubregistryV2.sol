// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import {IEnhancedAccessControl} from "@ens/v2/access-control/interfaces/IEnhancedAccessControl.sol";
import {PermissionedRegistry} from "@ens/v2/registry/PermissionedRegistry.sol";
import {IRegistry} from "@ens/v2/registry/interfaces/IRegistry.sol";
import {ILabelStore} from "@ens/v2/utils/interfaces/ILabelStore.sol";
import {LibLabel} from "@ens/v2/utils/LibLabel.sol";

import {ITeam} from "./ITeam.sol";

/// @title CascadeSubregistryV2
/// @notice Roadmap steps 1 and 3 on top of the one-hop rule: several teams per registry, and
///         inheritance from ancestors further up the name tree. Not deployed; the live demo runs
///         `CascadeSubregistry` (v1).
/// @dev The rule, for any name resource (never ROOT_RESOURCE) and any account:
///
///        roles = native  ∪  ⋃ over teams t, levels k ≤ depth, where t.isMember(account):
///                              ancestor_k.roles(label_k, t) & regular bits
///
///      ancestor_1 / label_1 is this registry's parent and its label there (stock `setParent`);
///      each further level comes from the previous ancestor's own `getParent()`. A level counts only
///      if the ancestor really points down to the registry below it (`getSubregistry(label)`), which
///      also cuts inheritance when any name on the path expires. The walk stops at the first level
///      that fails, so a broken link hides everything above it.
///
///      Same invariants as v1: the logic lives only in the `_getRoles` hook (views agree with writes),
///      it only ever adds roles, admin bits are masked, nothing is inherited at root, and every
///      external call is a gas-capped STATICCALL that fails closed. Worst-case lookup cost is bounded
///      by MAX_TEAMS × MAX_DEPTH parent reads, MAX_DEPTH link checks and MAX_TEAMS membership calls.
contract CascadeSubregistryV2 is PermissionedRegistry {
    /// @notice Which team and which level supplied an inherited role, for `explain`.
    struct Explanation {
        bool native; // caller holds the roles here without inheritance
        bool allowed; // what a write would decide (before its separate expiry check)
        address team; // first team whose grant covers the roles for this caller, or 0
        uint256 level; // 1 = parent, 2 = grandparent, …; 0 if none
        address ancestor; // registry holding that grant
        string label; // the label the grant is on, in that registry
    }

    uint256 public constant ROLE_SET_TEAM = 1 << 40;
    uint256 public constant ROLE_SET_TEAM_ADMIN = ROLE_SET_TEAM << 128;

    uint256 public constant MAX_TEAMS = 4;
    uint256 public constant MAX_DEPTH = 3;

    uint256 public constant PARENT_CALL_GAS = 50_000;
    uint256 public constant LINK_CALL_GAS = 50_000;
    /// @notice Higher than v1's 30k so nested teams and roster adapters (Hats, Safe) fit.
    uint256 public constant MEMBER_CALL_GAS = 100_000;

    uint256 private constant REGULAR_ROLES = type(uint128).max;
    uint256 private constant MAX_RETURN = 320; // bytes accepted from getParent(); longer is ignored

    address[] private _teams;

    /// @notice How many levels up the tree to inherit from. 1 = the parent only (v1 behaviour).
    uint256 public depth = 1;

    event TeamAdded(address indexed team, address indexed changedBy);
    event TeamRemoved(address indexed team, address indexed changedBy);
    event DepthUpdated(uint256 oldDepth, uint256 newDepth, address indexed changedBy);

    error TeamNotContract(address team);
    error TeamInterfaceUnsupported(address team);
    error TeamAlreadyAdded(address team);
    error TeamNotFound(address team);
    error TooManyTeams();
    error DepthOutOfRange(uint256 depth);

    constructor(ILabelStore labelStore, address rootAccount, uint256 roleBitmap)
        PermissionedRegistry(labelStore, rootAccount, roleBitmap)
    {}

    // ── configuration (root role ROLE_SET_TEAM) ─────────────────────────────

    function addTeam(address team) external onlyRootRoles(ROLE_SET_TEAM) {
        if (team.code.length == 0) revert TeamNotContract(team);
        if (!ERC165Checker.supportsInterface(team, type(ITeam).interfaceId)) revert TeamInterfaceUnsupported(team);
        if (_teams.length >= MAX_TEAMS) revert TooManyTeams();
        for (uint256 i; i < _teams.length; ++i) if (_teams[i] == team) revert TeamAlreadyAdded(team);
        _teams.push(team);
        emit TeamAdded(team, msg.sender);
    }

    function removeTeam(address team) external onlyRootRoles(ROLE_SET_TEAM) {
        uint256 n = _teams.length;
        for (uint256 i; i < n; ++i) {
            if (_teams[i] == team) {
                _teams[i] = _teams[n - 1];
                _teams.pop();
                emit TeamRemoved(team, msg.sender);
                return;
            }
        }
        revert TeamNotFound(team);
    }

    function setDepth(uint256 newDepth) external onlyRootRoles(ROLE_SET_TEAM) {
        if (newDepth == 0 || newDepth > MAX_DEPTH) revert DepthOutOfRange(newDepth);
        emit DepthUpdated(depth, newDepth, msg.sender);
        depth = newDepth;
    }

    function teams() external view returns (address[] memory) {
        return _teams;
    }

    // ── views ────────────────────────────────────────────────────────────────

    /// @notice The account's own roles on `anyId` (name or root), without anything inherited.
    function nativeRoles(uint256 anyId, address account) external view returns (uint256) {
        return super._getRoles(ROOT_RESOURCE, account) | super._getRoles(getResource(anyId), account);
    }

    /// @notice The verified path the rule reads from: ancestors[k-1] holds this registry's subtree
    ///         under labels[k-1]. Shorter than `depth` when a link is missing or broken.
    function ancestry() public view returns (address[] memory ancestors, string[] memory labels) {
        (IRegistry[MAX_DEPTH] memory a, string[MAX_DEPTH] memory l, uint256 n) = _ancestry();
        ancestors = new address[](n);
        labels = new string[](n);
        for (uint256 k; k < n; ++k) (ancestors[k], labels[k]) = (address(a[k]), l[k]);
    }

    /// @notice Whether `account` may exercise `roleBitmap` on `anyId`, and which team and level
    ///         supplied it. The decision itself comes from the same hook the write path uses.
    function explain(uint256 anyId, uint256 roleBitmap, address account) external view returns (Explanation memory e) {
        uint256 resource = getResource(anyId);
        e.native = _nativeRoles(resource, account) & roleBitmap == roleBitmap;
        e.allowed = hasRoles(anyId, roleBitmap, account);
        if (resource == ROOT_RESOURCE) return e;
        (IRegistry[MAX_DEPTH] memory a, string[MAX_DEPTH] memory l, uint256 n) = _ancestry();
        for (uint256 i; i < _teams.length; ++i) {
            address t = _teams[i];
            for (uint256 k; k < n; ++k) {
                if (_grantAt(a[k], l[k], t) & roleBitmap == roleBitmap && _isMember(t, account)) {
                    (e.team, e.level, e.ancestor, e.label) = (t, k + 1, address(a[k]), l[k]);
                    return e;
                }
            }
        }
    }

    function _nativeRoles(uint256 resource, address account) internal view returns (uint256) {
        return super._getRoles(ROOT_RESOURCE, account) | super._getRoles(resource, account);
    }

    // ── the rule ─────────────────────────────────────────────────────────────

    /// @dev Native-first fast path for writes: if the caller's stored roles (on the name or on root,
    ///      including stock approved-operator roles) already cover the check, no team or ancestor is
    ///      consulted. The outcome is identical to the full check, because inheritance only ever adds
    ///      roles — it just spares native owners the lookups. Views (`hasRoles`, `roles`) are not
    ///      overridable in PermissionedRegistry and always compute the full answer.
    function _checkRoles(uint256 resource, uint256 roleBitmap, address account) internal view override {
        if (_nativeRoles(resource, account) & roleBitmap == roleBitmap) return;
        super._checkRoles(resource, roleBitmap, account);
    }


    function _getRoles(uint256 resource, address account) internal view override returns (uint256 roleBitmap) {
        roleBitmap = super._getRoles(resource, account);
        if (resource == ROOT_RESOURCE) return roleBitmap;
        uint256 nTeams = _teams.length;
        if (nTeams == 0) return roleBitmap;
        (IRegistry[MAX_DEPTH] memory a, string[MAX_DEPTH] memory l, uint256 n) = _ancestry();
        if (n == 0) return roleBitmap;
        for (uint256 i; i < nTeams; ++i) {
            address t = _teams[i];
            uint256 granted;
            for (uint256 k; k < n; ++k) granted |= _grantAt(a[k], l[k], t);
            // Membership is asked only when this team would add something new.
            if (granted & ~roleBitmap != 0 && _isMember(t, account)) roleBitmap |= granted;
        }
    }

    /// @dev Walks up from this registry, keeping each level only if the ancestor points back down.
    function _ancestry() internal view returns (IRegistry[MAX_DEPTH] memory a, string[MAX_DEPTH] memory l, uint256 n) {
        address child = address(this);
        IRegistry p = _parentRegistry;
        string memory label = _childLabel;
        uint256 d = depth;
        while (n < d) {
            if (address(p).code.length == 0 || address(p) == address(this) || !_pointsTo(p, label, child)) break;
            (a[n], l[n]) = (p, label);
            ++n;
            if (n == d) break;
            bool ok;
            child = address(p);
            (ok, p, label) = _parentOf(p);
            if (!ok) break;
        }
    }

    /// @dev Regular roles `registry` grants `team` on `label`; 0 on any failure.
    function _grantAt(IRegistry registry, string memory label, address team) internal view returns (uint256) {
        (bool ok, uint256 r) = _staticUint(address(registry), PARENT_CALL_GAS,
            abi.encodeCall(IEnhancedAccessControl.roles, (LibLabel.id(label), team)));
        return ok ? r & REGULAR_ROLES : 0;
    }

    /// @dev `registry.getSubregistry(label) == child`; false on any failure. Expired names return 0.
    function _pointsTo(IRegistry registry, string memory label, address child) internal view returns (bool) {
        (bool ok, uint256 r) = _staticUint(address(registry), LINK_CALL_GAS, abi.encodeCall(IRegistry.getSubregistry, (label)));
        return ok && r == uint256(uint160(child));
    }

    /// @dev `team.isMember(account)`, capped; false on any failure, including malformed return data.
    function _isMember(address team, address account) internal view returns (bool) {
        (bool ok, uint256 r) = _staticUint(team, MEMBER_CALL_GAS, abi.encodeCall(ITeam.isMember, (account)));
        return ok && r == 1;
    }

    /// @dev `registry.getParent()`, capped and decoded without trusting the callee: malformed data
    ///      is caught by decoding in a self-call, so it can only end the walk, never revert it.
    function _parentOf(IRegistry registry) internal view returns (bool ok, IRegistry parent, string memory label) {
        bytes memory data = abi.encodeCall(IRegistry.getParent, ());
        uint256 gasCap = PARENT_CALL_GAS;
        uint256 size;
        assembly ("memory-safe") {
            ok := staticcall(gasCap, registry, add(data, 32), mload(data), 0, 0)
            size := returndatasize()
        }
        if (!ok || size < 64 || size > MAX_RETURN) return (false, parent, label);
        bytes memory ret = new bytes(size); // copied only after the size check: no return bomb
        assembly ("memory-safe") {
            returndatacopy(add(ret, 32), 0, size)
        }
        try this.decodeParent(ret) returns (IRegistry p, string memory s) {
            return (true, p, s);
        } catch {
            return (false, parent, label);
        }
    }

    /// @dev Helper for `_parentOf`; external so a decoding revert can be caught. Pure, harmless to call.
    function decodeParent(bytes memory data) external pure returns (IRegistry, string memory) {
        return abi.decode(data, (IRegistry, string));
    }

    /// @dev A capped STATICCALL returning one word; never reverts on short or malformed return data,
    ///      and copies only the first word, so an oversized reply cannot inflate the caller's gas.
    function _staticUint(address target, uint256 gasCap, bytes memory data) private view returns (bool ok, uint256 word) {
        assembly ("memory-safe") {
            ok := staticcall(gasCap, target, add(data, 32), mload(data), 0, 0)
            switch and(ok, iszero(lt(returndatasize(), 32)))
            case 1 {
                returndatacopy(0, 0, 32)
                word := mload(0)
            }
            default { ok := 0 }
        }
    }
}
