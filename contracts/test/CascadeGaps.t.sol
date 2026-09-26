// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";

import {IEnhancedAccessControl} from "@ens/v2/access-control/interfaces/IEnhancedAccessControl.sol";
import {IRegistry} from "@ens/v2/registry/interfaces/IRegistry.sol";
import {PermissionedRegistry} from "@ens/v2/registry/PermissionedRegistry.sol";
import {RegistryRolesLib} from "@ens/v2/registry/libraries/RegistryRolesLib.sol";
import {ILabelStore} from "@ens/v2/utils/interfaces/ILabelStore.sol";
import {LibLabel} from "@ens/v2/utils/LibLabel.sol";

import {CascadeSubregistry} from "../src/CascadeSubregistry.sol";
import {CascadeSubregistryV2} from "../src/CascadeSubregistryV2.sol";
import {TeamRegistry} from "../src/TeamRegistry.sol";
import {NestedTeam} from "../src/teams/NestedTeam.sol";
import {NoopLabelStore} from "./Cascade.t.sol";

// Access-control gaps named after pitch 3 (docs/feedback/ens-pitch-3.md §6): approved operators,
// actions members might try, expiry, the 15-member cap, and v1 vs v2 equivalence. Each scenario runs
// against both v1 (`CascadeSubregistry`) and v2 (`CascadeSubregistryV2`, one team, depth 1).
uint256 constant ALL = 0x1111111111111111111111111111111111111111111111111111111111111111;
uint256 constant SET_SUB = RegistryRolesLib.ROLE_SET_SUBREGISTRY;
uint256 constant RENEW = RegistryRolesLib.ROLE_RENEW;
uint256 constant UNREG = RegistryRolesLib.ROLE_UNREGISTER;
uint256 constant DEVOPS = uint256(keccak256("devops"));

/// One parent (`acme-corp.eth`'s registry) holding `devops`, whose subregistry is a v1 or a v2 Cascade.
abstract contract TwoTrees is Test {
    address op = makeAddr("operator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    PermissionedRegistry parent1;
    PermissionedRegistry parent2;
    CascadeSubregistry c1;
    CascadeSubregistryV2 c2;
    TeamRegistry team;
    uint64 exp;

    function setUp() public virtual {
        ILabelStore labels = new NoopLabelStore();
        exp = uint64(block.timestamp + 365 days);
        address[] memory admins = new address[](1);
        admins[0] = op;
        vm.startPrank(op);
        team = new TeamRegistry(admins);
        parent1 = new PermissionedRegistry(labels, op, ALL);
        parent2 = new PermissionedRegistry(labels, op, ALL);
        c1 = new CascadeSubregistry(labels, op, ALL);
        c2 = new CascadeSubregistryV2(labels, op, ALL);
        parent1.register("devops", op, IRegistry(address(c1)), address(0), ALL, exp);
        parent2.register("devops", op, IRegistry(address(c2)), address(0), ALL, exp);
        c1.setParent(IRegistry(address(parent1)), "devops");
        c2.setParent(IRegistry(address(parent2)), "devops");
        c1.setTeam(address(team));
        c2.addTeam(address(team));
        parent1.grantRoles(DEVOPS, SET_SUB, address(team));
        parent2.grantRoles(DEVOPS, SET_SUB, address(team));
        vm.stopPrank();
    }

    function _join(address who) internal { vm.prank(op); team.grantRoles(1, 1, who); }

    /// The two registries as the common interface, so each scenario runs on both.
    function _both() internal view returns (PermissionedRegistry[2] memory r) {
        r[0] = PermissionedRegistry(address(c1));
        r[1] = PermissionedRegistry(address(c2));
    }

    function _register(PermissionedRegistry r, string memory label, address owner, uint256 roles, uint64 expiry) internal returns (uint256) {
        vm.prank(op);
        return r.register(label, owner, IRegistry(address(0)), address(0), roles, expiry);
    }

    function _canSetSub(PermissionedRegistry r, uint256 id, address who) internal returns (bool ok) {
        vm.prank(who);
        try r.setSubregistry(id, IRegistry(address(0xBEEF))) { ok = true; } catch {}
    }
}

contract CascadeGapsTest is TwoTrees {
    // ── 1. approved operators ────────────────────────────────────────────────

    /// A member approving someone passes nothing on: approval shares an *owner's* roles, and membership
    /// is per account.
    function test_operatorOfMemberGetsNothing() public {
        _join(alice);
        PermissionedRegistry[2] memory r = _both();
        for (uint256 i; i < 2; ++i) {
            uint256 id = _register(r[i], "ci", op, RENEW, exp);
            vm.prank(alice);
            r[i].setApprovalForAll(bob, true);
            assertTrue(_canSetSub(r[i], id, alice), "the member can");
            assertFalse(r[i].hasRoles(id, SET_SUB, bob), "the member's operator holds nothing");
            assertFalse(_canSetSub(r[i], id, bob), "and can't write");
        }
    }

    /// An owner's operator gets the owner's *stored* roles on the name, never the owner's inherited ones
    /// (stock `PermissionedRegistry` merges `super._getRoles(resource, owner)`, which is below Cascade).
    function test_operatorOfOwnerGetsOnlyStoredRoles() public {
        _join(alice);
        PermissionedRegistry[2] memory r = _both();
        for (uint256 i; i < 2; ++i) {
            uint256 id = _register(r[i], "own", alice, RENEW, exp); // alice owns it and inherits SET_SUB
            vm.prank(alice);
            r[i].setApprovalForAll(bob, true);
            assertTrue(r[i].hasRoles(id, SET_SUB, alice), "owner inherits SET_SUB");
            assertTrue(r[i].hasRoles(id, RENEW, bob), "operator gets the owner's stored RENEW");
            assertFalse(r[i].hasRoles(id, SET_SUB, bob), "but not the owner's inherited SET_SUB");
            assertFalse(_canSetSub(r[i], id, bob));
        }
    }

    // ── 2. actions a member might try ────────────────────────────────────────

    function test_memberCannotRevokeOrTransfer() public {
        _join(alice);
        PermissionedRegistry[2] memory r = _both();
        for (uint256 i; i < 2; ++i) {
            uint256 id = _register(r[i], "ci", op, RENEW, exp);
            vm.startPrank(alice);
            vm.expectRevert();
            r[i].revokeRoles(id, RENEW, op);
            uint256 tokenId = r[i].getTokenId(id);
            vm.expectRevert();
            r[i].safeTransferFrom(op, alice, tokenId, 1, "");
            vm.stopPrank();
        }
    }

    /// Inheritance gives members whatever regular roles the parent grants the team — including
    /// destructive ones. Without an UNREGISTER grant a member can't unregister; with one, they can.
    function test_memberUnregistersOnlyIfTheParentGrantsIt() public {
        _join(alice);
        PermissionedRegistry[2] memory r = _both();
        PermissionedRegistry[2] memory parents = [parent1, parent2];
        for (uint256 i; i < 2; ++i) {
            uint256 id = _register(r[i], "ci", op, RENEW, exp);
            vm.prank(alice);
            vm.expectRevert();
            r[i].unregister(id);
            vm.prank(op);
            parents[i].grantRoles(DEVOPS, UNREG, address(team));
            vm.prank(alice);
            r[i].unregister(id);
            assertEq(r[i].getOwner(id), address(0), "unregistered by the member");
        }
    }

    // ── 3. expiry ────────────────────────────────────────────────────────────

    /// On an expired name every write reverts, whatever the member inherits. (`hasRoles` still reports
    /// the inherited role there — a named limitation — but the write path checks expiry first.)
    function test_memberCannotActOnExpiredName() public {
        _join(alice);
        PermissionedRegistry[2] memory r = _both();
        for (uint256 i; i < 2; ++i) {
            uint256 id = _register(r[i], "tmp", op, RENEW, uint64(block.timestamp + 1 days));
            assertTrue(_canSetSub(r[i], id, alice), "while live");
        }
        vm.warp(block.timestamp + 2 days);
        for (uint256 i; i < 2; ++i) {
            uint256 id = LibLabel.id("tmp");
            assertFalse(_canSetSub(r[i], id, alice), "after expiry");
        }
    }

    // ── 4. the 15-member cap ─────────────────────────────────────────────────

    function test_rosterCapIs15() public {
        address[] memory admins = new address[](1);
        admins[0] = op;
        TeamRegistry t = new TeamRegistry(admins);
        NestedTeam n = new NestedTeam(admins);
        vm.startPrank(op);
        for (uint160 i = 1; i <= 15; ++i) {
            t.grantRoles(1, 1, address(i));
            n.grantRoles(1, 1, address(i));
        }
        vm.expectRevert(abi.encodeWithSelector(IEnhancedAccessControl.EACMaxAssignees.selector, 1, 1));
        t.grantRoles(1, 1, address(uint160(16)));
        vm.expectRevert(abi.encodeWithSelector(IEnhancedAccessControl.EACMaxAssignees.selector, 1, 1));
        n.grantRoles(1, 1, address(uint160(16)));
        vm.stopPrank();
    }
}

/// Random actions applied identically to a v1 tree and a v2 tree (one team, depth 1). v2 at depth 1
/// must behave exactly like v1: same roles, same write outcomes, after every step.
contract V1V2Handler is Test {
    PermissionedRegistry public p1;
    PermissionedRegistry public p2;
    PermissionedRegistry public c1;
    PermissionedRegistry public c2;
    TeamRegistry public team;
    address public op;
    address[3] public actors;
    uint256 public outcomeMismatch;
    uint256 public joins;
    bool public expiredParentSeen;
    uint256[4] ROLES = [SET_SUB, RegistryRolesLib.ROLE_SET_RESOLVER, RENEW, UNREG];

    constructor(PermissionedRegistry p1_, PermissionedRegistry p2_, address c1_, address c2_, TeamRegistry team_, address op_) {
        (p1, p2, c1, c2, team, op) = (p1_, p2_, PermissionedRegistry(c1_), PermissionedRegistry(c2_), team_, op_);
        actors = [makeAddr("alice"), makeAddr("bob"), makeAddr("carol")];
    }

    function actorAt(uint256 i) external view returns (address) { return actors[i]; }

    function join(uint256 a) external { vm.prank(op); team.grantRoles(1, 1, actors[a % 3]); joins++; }
    function leave(uint256 a) external { vm.prank(op); team.revokeRoles(1, 1, actors[a % 3]); }

    function parentGrant(uint256 role, bool grant) external {
        uint256 r = ROLES[role % 4];
        vm.startPrank(op);
        if (grant) { p1.grantRoles(DEVOPS, r, address(team)); p2.grantRoles(DEVOPS, r, address(team)); }
        else { p1.revokeRoles(DEVOPS, r, address(team)); p2.revokeRoles(DEVOPS, r, address(team)); }
        vm.stopPrank();
    }

    function nativeGrant(uint256 a, uint256 role, bool grant) external {
        uint256 r = ROLES[role % 4];
        address who = actors[a % 3];
        vm.startPrank(op);
        if (grant) { c1.grantRoles(LibLabel.id("ci"), r, who); c2.grantRoles(LibLabel.id("ci"), r, who); }
        else { c1.revokeRoles(LibLabel.id("ci"), r, who); c2.revokeRoles(LibLabel.id("ci"), r, who); }
        vm.stopPrank();
    }

    function reissueParent() external {
        vm.startPrank(op);
        if (p1.getExpiry(DEVOPS) > block.timestamp) p1.unregister(DEVOPS);
        p1.register("devops", op, IRegistry(address(c1)), address(0), ALL, uint64(block.timestamp + 365 days));
        if (p2.getExpiry(DEVOPS) > block.timestamp) p2.unregister(DEVOPS);
        p2.register("devops", op, IRegistry(address(c2)), address(0), ALL, uint64(block.timestamp + 365 days));
        vm.stopPrank();
    }

    /// Up to 90 days per step, so runs regularly cross the parent's one-year expiry as well as the file's.
    function warp(uint256 d) external { vm.warp(block.timestamp + (d % 90 days)); expiredParentSeen = expiredParentSeen || p1.getExpiry(DEVOPS) <= block.timestamp; }

    function reissueChild() external {
        if (c1.getExpiry(LibLabel.id("ci")) > block.timestamp && c2.getExpiry(LibLabel.id("ci")) > block.timestamp) return;
        vm.startPrank(op);
        if (c1.getExpiry(LibLabel.id("ci")) <= block.timestamp) c1.register("ci", op, IRegistry(address(0)), address(0), RENEW, uint64(block.timestamp + 60 days));
        if (c2.getExpiry(LibLabel.id("ci")) <= block.timestamp) c2.register("ci", op, IRegistry(address(0)), address(0), RENEW, uint64(block.timestamp + 60 days));
        vm.stopPrank();
    }

    function _try(PermissionedRegistry c, address who, uint256 w) internal returns (bool ok) {
        uint256 id = LibLabel.id("ci");
        uint64 e = c.getExpiry(id);
        vm.prank(who);
        if (w == 0) try c.setSubregistry(id, IRegistry(address(0xBEEF))) { ok = true; } catch {}
        else if (w == 1) try c.setResolver(id, address(0xBEEF)) { ok = true; } catch {}
        else if (w == 2) try c.renew(id, e) { ok = true; } catch {}
        else try c.unregister(id) { ok = true; } catch {}
    }

    function actorWrite(uint256 a, uint256 w) external {
        address who = actors[a % 3];
        bool r1 = _try(c1, who, w % 4);
        bool r2 = _try(c2, who, w % 4);
        if (r1 != r2) outcomeMismatch++;
    }
}

/// forge-config: default.invariant.runs = 64
/// forge-config: default.invariant.depth = 80
contract CascadeV1V2EquivalenceTest is TwoTrees {
    V1V2Handler handler;

    function setUp() public override {
        super.setUp();
        _register(PermissionedRegistry(address(c1)), "ci", op, RENEW, uint64(block.timestamp + 60 days));
        _register(PermissionedRegistry(address(c2)), "ci", op, RENEW, uint64(block.timestamp + 60 days));
        handler = new V1V2Handler(parent1, parent2, address(c1), address(c2), team, op);
        targetContract(address(handler));
    }

    function invariant_v2AtDepth1MatchesV1() public view {
        uint256 id = LibLabel.id("ci");
        for (uint256 i; i < 3; ++i) {
            address who = handler.actorAt(i);
            assertEq(c2.roles(id, who), c1.roles(id, who), "roles differ between v1 and v2");
            assertEq(c2.nativeRoles(id, who), c1.nativeRoles(id, who), "stored roles differ");
        }
        assertEq(handler.outcomeMismatch(), 0, "a write succeeded on one and failed on the other");
    }

    function afterInvariant() public view {
        assertGt(handler.joins(), 0, "no one ever joined");
    }
}

/// One targeted check that the random runs can't guarantee: an expired parent ends inheritance in v1
/// and v2 alike (v1 through the parent's own role lookup, v2 also through `getSubregistry` returning 0).
contract CascadeExpiredParentTest is TwoTrees {
    function test_expiredParentEndsInheritanceInBoth() public {
        _join(alice);
        PermissionedRegistry[2] memory r = _both();
        uint256[2] memory ids;
        for (uint256 i; i < 2; ++i) ids[i] = _register(r[i], "ci", op, RENEW, uint64(exp + 365 days));
        for (uint256 i; i < 2; ++i) assertTrue(r[i].hasRoles(ids[i], SET_SUB, alice), "while the parent is live");
        vm.warp(exp + 1); // devops expired in both parents; ci is still live
        for (uint256 i; i < 2; ++i) {
            assertFalse(_canSetSub(r[i], ids[i], alice), "no inherited write after the parent expires");
        }
        assertEq(c1.roles(ids[0], alice), c2.roles(ids[1], alice), "v1 and v2 agree");
    }
}
