// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";

import {IEnhancedAccessControl} from "@ens/v2/access-control/interfaces/IEnhancedAccessControl.sol";
import {IRegistry} from "@ens/v2/registry/interfaces/IRegistry.sol";
import {PermissionedRegistry} from "@ens/v2/registry/PermissionedRegistry.sol";
import {RegistryRolesLib} from "@ens/v2/registry/libraries/RegistryRolesLib.sol";
import {ILabelStore} from "@ens/v2/utils/interfaces/ILabelStore.sol";
import {LibLabel} from "@ens/v2/utils/LibLabel.sol";

import {CascadeSubregistryV2} from "../src/CascadeSubregistryV2.sol";
import {ITeam} from "../src/ITeam.sol";
import {TeamRegistry} from "../src/TeamRegistry.sol";
import {NestedTeam} from "../src/teams/NestedTeam.sol";
import {HatsTeam, IHats} from "../src/teams/HatsTeam.sol";
import {SafeTeam, ISafeOwners} from "../src/teams/SafeTeam.sol";
import {NoopLabelStore, AlwaysTrueTeam, BadTeam, UndeclaredTeam} from "./Cascade.t.sol";

uint256 constant ALL_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111;
uint256 constant REGULAR = type(uint128).max;
uint256 constant SET_SUB = RegistryRolesLib.ROLE_SET_SUBREGISTRY;
uint256 constant SET_RES = RegistryRolesLib.ROLE_SET_RESOLVER;
uint256 constant TEAM_RES = 1; // TeamRegistry / NestedTeam TEAM_RESOURCE
uint256 constant MEMBER = 1; // ROLE_MEMBER

contract MockHats is IHats {
    mapping(address => mapping(uint256 => bool)) public wears;
    uint256 public burn; // gas an "eligibility module" burns per check
    function setWearer(address a, uint256 hat, bool w) external { wears[a][hat] = w; }
    function setBurn(uint256 b) external { burn = b; }
    function isWearerOfHat(address a, uint256 hat) external view returns (bool) {
        uint256 stop = gasleft() > burn ? gasleft() - burn : 0;
        while (gasleft() > stop) {}
        return wears[a][hat];
    }
}

contract MockSafe is ISafeOwners {
    mapping(address => bool) public owner;
    function setOwner(address a, bool o) external { owner[a] = o; }
    function isOwner(address a) external view returns (bool) { return owner[a]; }
}

/// A registry-shaped contract an attacker controls: fixed answers, and raw bytes for getParent().
contract HostileRegistry {
    address public child;
    uint256 public grant;
    bytes public parentRet;
    function set(address c, uint256 g, bytes calldata p) external { (child, grant, parentRet) = (c, g, p); }
    function getSubregistry(string calldata) external view returns (address) { return child; }
    function roles(uint256, address) external view returns (uint256) { return grant; }
    fallback() external {
        bytes memory r = parentRet;
        assembly { return(add(r, 32), mload(r)) }
    }
}

/// The name tree for every v2 test: `.eth` (stock) → acme-corp (stock OrgRegistry) → devops
/// (CascadeSubregistryV2) → ci. Each registry's parent pointer is set with stock `setParent`.
abstract contract V2Fixture is Test {
    address op = makeAddr("operator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    PermissionedRegistry root;
    PermissionedRegistry org;
    CascadeSubregistryV2 v2;
    TeamRegistry dev;
    TeamRegistry sec;
    uint256 ci;
    uint64 exp;

    uint256 constant ACME = uint256(keccak256("acme-corp"));
    uint256 constant DEVOPS = uint256(keccak256("devops"));

    function setUp() public virtual {
        ILabelStore labels = new NoopLabelStore();
        exp = uint64(block.timestamp + 365 days);
        vm.startPrank(op);
        root = new PermissionedRegistry(labels, op, ALL_ROLES);
        org = new PermissionedRegistry(labels, op, ALL_ROLES);
        v2 = new CascadeSubregistryV2(labels, op, ALL_ROLES);
        root.register("acme-corp", op, IRegistry(address(org)), address(0), ALL_ROLES, exp);
        org.setParent(IRegistry(address(root)), "acme-corp");
        org.register("devops", op, IRegistry(address(v2)), address(0), ALL_ROLES, exp * 2);
        v2.setParent(IRegistry(address(org)), "devops");
        ci = v2.register("ci", op, IRegistry(address(0)), address(0), RegistryRolesLib.ROLE_RENEW, exp * 3);
        address[] memory admins = new address[](1);
        admins[0] = op;
        dev = new TeamRegistry(admins);
        sec = new TeamRegistry(admins);
        v2.addTeam(address(dev));
        v2.addTeam(address(sec));
        vm.stopPrank();
    }

    function _join(TeamRegistry t, address who) internal { vm.prank(op); t.grantRoles(TEAM_RES, MEMBER, who); }
    function _leave(TeamRegistry t, address who) internal { vm.prank(op); t.revokeRoles(TEAM_RES, MEMBER, who); }

    function _canSetSub(address who) internal returns (bool) {
        vm.prank(who);
        try v2.setSubregistry(ci, IRegistry(address(0xBEEF))) { return true; } catch { return false; }
    }

    function _canSetResolver(address who) internal returns (bool) {
        vm.prank(who);
        try v2.setResolver(ci, address(0xBEEF)) { return true; } catch { return false; }
    }
}

contract CascadeV2Test is V2Fixture {
    // ── default: behaves like v1 (one hop) ─────────────────────────────────

    function test_defaultDepthIsOneHop_sequence() public {
        vm.prank(op);
        org.grantRoles(DEVOPS, SET_SUB, address(dev));
        assertEq(v2.depth(), 1);
        assertFalse(_canSetSub(alice), "not a member");
        _join(dev, alice);
        assertTrue(v2.hasRoles(ci, SET_SUB, alice));
        assertTrue(_canSetSub(alice), "member");
        _leave(dev, alice);
        assertFalse(_canSetSub(alice), "left");
        assertEq(v2.nativeRoles(ci, alice), 0, "nothing ever stored");
    }

    // ── step 1: many teams per role ─────────────────────────────────────────

    function test_manyTeams_eachGetsItsOwnRole() public {
        vm.startPrank(op);
        org.grantRoles(DEVOPS, SET_SUB, address(dev)); // devops edits
        org.grantRoles(DEVOPS, SET_RES, address(sec)); // security sets resolvers
        vm.stopPrank();
        _join(dev, alice);
        _join(sec, bob);
        _join(dev, carol);
        _join(sec, carol);

        assertTrue(_canSetSub(alice));
        assertFalse(_canSetResolver(alice));
        assertFalse(_canSetSub(bob));
        assertTrue(_canSetResolver(bob));
        assertEq(v2.roles(ci, carol), SET_SUB | SET_RES, "member of both gets both");

        CascadeSubregistryV2.Explanation memory e = v2.explain(ci, SET_RES, bob);
        assertTrue(e.allowed && !e.native);
        assertEq(e.team, address(sec));
        assertEq(e.level, 1);
        assertEq(e.ancestor, address(org));
        assertEq(e.label, "devops");
    }

    function test_removeTeam_cutsOnlyThatTeam() public {
        vm.startPrank(op);
        org.grantRoles(DEVOPS, SET_SUB, address(dev));
        org.grantRoles(DEVOPS, SET_RES, address(sec));
        vm.stopPrank();
        _join(dev, carol);
        _join(sec, carol);
        vm.expectEmit(true, true, false, false, address(v2));
        emit CascadeSubregistryV2.TeamRemoved(address(sec), op);
        vm.prank(op);
        v2.removeTeam(address(sec));
        assertEq(v2.roles(ci, carol), SET_SUB);
        assertEq(v2.teams().length, 1);
    }

    function test_addTeam_guards() public {
        address outsider = makeAddr("outsider");
        address fake = address(new AlwaysTrueTeam());
        vm.expectRevert(abi.encodeWithSelector(
            IEnhancedAccessControl.EACUnauthorizedAccountRoles.selector, 0, v2.ROLE_SET_TEAM(), outsider));
        vm.prank(outsider);
        v2.addTeam(fake);

        vm.startPrank(op);
        vm.expectRevert(abi.encodeWithSelector(CascadeSubregistryV2.TeamNotContract.selector, alice));
        v2.addTeam(alice);
        address u = address(new UndeclaredTeam());
        vm.expectRevert(abi.encodeWithSelector(CascadeSubregistryV2.TeamInterfaceUnsupported.selector, u));
        v2.addTeam(u);
        vm.expectRevert(abi.encodeWithSelector(CascadeSubregistryV2.TeamAlreadyAdded.selector, address(dev)));
        v2.addTeam(address(dev));
        v2.addTeam(fake);
        v2.addTeam(address(new AlwaysTrueTeam()));
        address fifth = address(new AlwaysTrueTeam()); // created first: expectRevert applies to the next call
        vm.expectRevert(CascadeSubregistryV2.TooManyTeams.selector);
        v2.addTeam(fifth);
        vm.expectRevert(abi.encodeWithSelector(CascadeSubregistryV2.TeamNotFound.selector, alice));
        v2.removeTeam(alice);
        vm.stopPrank();
    }

    function test_noTeams_nothingInherited() public {
        vm.startPrank(op);
        org.grantRoles(DEVOPS, SET_SUB, address(dev));
        v2.removeTeam(address(dev));
        v2.removeTeam(address(sec));
        vm.stopPrank();
        _join(dev, alice);
        assertEq(v2.roles(ci, alice), 0);
    }

    // ── step 3: multi-hop names ─────────────────────────────────────────────

    function test_multiHop_grandparentGrantNeedsDepth() public {
        vm.prank(op);
        root.grantRoles(ACME, SET_SUB, address(dev)); // shared at acme-corp.eth, two levels up
        _join(dev, alice);
        assertFalse(_canSetSub(alice), "depth 1 sees only devops");

        vm.expectEmit(true, false, false, true, address(v2));
        emit CascadeSubregistryV2.DepthUpdated(1, 2, op);
        vm.prank(op);
        v2.setDepth(2);
        assertTrue(_canSetSub(alice), "depth 2 sees acme-corp");

        CascadeSubregistryV2.Explanation memory e = v2.explain(ci, SET_SUB, alice);
        assertEq(e.level, 2);
        assertEq(e.ancestor, address(root));
        assertEq(e.label, "acme-corp");
        (address[] memory a, string[] memory l) = v2.ancestry();
        assertEq(a.length, 2);
        assertEq(a[0], address(org));
        assertEq(l[1], "acme-corp");
    }

    function test_multiHop_depthBeyondTreeIsHarmless() public {
        vm.prank(op);
        root.grantRoles(ACME, SET_SUB, address(dev));
        _join(dev, alice);
        vm.prank(op);
        v2.setDepth(3); // root has no parent: the walk ends after two levels
        (address[] memory a, ) = v2.ancestry();
        assertEq(a.length, 2);
        assertTrue(_canSetSub(alice));
    }

    function test_multiHop_brokenLinkStopsTheWalk() public {
        vm.startPrank(op);
        root.grantRoles(ACME, SET_SUB, address(dev));
        v2.setDepth(2);
        root.setSubregistry(ACME, IRegistry(address(0xDEAD))); // acme-corp no longer points at org
        vm.stopPrank();
        _join(dev, alice);
        assertFalse(_canSetSub(alice), "org claims acme-corp as parent, but acme-corp disowned it");
        (address[] memory a, ) = v2.ancestry();
        assertEq(a.length, 1);
    }

    function test_multiHop_lyingParentPointerIgnored() public {
        // A second tree whose top grants the team; org falsely claims it as parent.
        PermissionedRegistry other = new PermissionedRegistry(new NoopLabelStore(), op, ALL_ROLES);
        vm.startPrank(op);
        other.register("acme-corp", op, IRegistry(address(0xBEEF)), address(0), ALL_ROLES, exp);
        other.grantRoles(ACME, SET_SUB, address(dev));
        org.setParent(IRegistry(address(other)), "acme-corp");
        v2.setDepth(2);
        vm.stopPrank();
        _join(dev, alice);
        assertFalse(_canSetSub(alice));
    }

    function test_multiHop_reissueAtTopCuts() public {
        vm.startPrank(op);
        root.grantRoles(ACME, SET_SUB, address(dev));
        v2.setDepth(2);
        vm.stopPrank();
        _join(dev, alice);
        assertTrue(_canSetSub(alice));
        vm.startPrank(op);
        root.unregister(ACME);
        root.register("acme-corp", op, IRegistry(address(org)), address(0), ALL_ROLES, exp);
        vm.stopPrank();
        assertFalse(_canSetSub(alice), "grant was on the old registration");
    }

    function test_multiHop_expiryAtTopCuts() public {
        vm.startPrank(op);
        root.grantRoles(ACME, SET_SUB, address(dev));
        org.grantRoles(DEVOPS, SET_RES, address(dev));
        v2.setDepth(2);
        vm.stopPrank();
        _join(dev, alice);
        vm.warp(exp + 1); // acme-corp expired; devops and ci have not
        assertEq(v2.roles(ci, alice), SET_RES, "level 1 still counts, level 2 is gone");
    }

    function test_multiHop_rootAndAdminNeverInherited() public {
        vm.startPrank(op);
        root.grantRoles(ACME, RegistryRolesLib.ROLE_REGISTRAR | SET_SUB, address(dev));
        v2.setDepth(2);
        vm.stopPrank();
        _join(dev, alice);
        assertFalse(v2.hasRootRoles(RegistryRolesLib.ROLE_REGISTRAR, alice));
        assertEq(v2.roles(ci, alice) >> 128, 0);
        vm.startPrank(alice);
        vm.expectRevert();
        v2.register("x", alice, IRegistry(address(0)), address(0), 0, uint64(block.timestamp + 1 days));
        vm.expectRevert();
        v2.grantRoles(ci, SET_SUB, bob);
        vm.stopPrank();
    }

    function test_setDepth_guards() public {
        vm.startPrank(op);
        vm.expectRevert(abi.encodeWithSelector(CascadeSubregistryV2.DepthOutOfRange.selector, 0));
        v2.setDepth(0);
        vm.expectRevert(abi.encodeWithSelector(CascadeSubregistryV2.DepthOutOfRange.selector, 4));
        v2.setDepth(4);
        vm.stopPrank();
        vm.prank(alice);
        vm.expectRevert();
        v2.setDepth(2);
    }

    function testFuzz_hostileAncestorFailsClosed(uint256 grant, bytes calldata parentRet) public {
        vm.assume(parentRet.length <= 400);
        HostileRegistry h = new HostileRegistry();
        h.set(address(v2), grant, parentRet); // points back down, so level 1 is accepted
        vm.startPrank(op);
        v2.setParent(IRegistry(address(h)), "devops");
        v2.setDepth(3);
        vm.stopPrank();
        _join(dev, alice);
        assertEq(v2.roles(ci, alice), grant & REGULAR, "exactly the regular half, never a revert");
        assertEq(v2.roles(ci, bob), 0);
        vm.prank(op);
        v2.setSubregistry(ci, IRegistry(address(0xC0))); // owner unaffected
    }

    function test_gas_worstCaseIsBounded() public {
        vm.startPrank(op);
        v2.removeTeam(address(dev));
        v2.removeTeam(address(sec));
        for (uint256 i; i < 4; ++i) {
            BadTeam b = new BadTeam();
            b.setMode(1); // infinite loop
            v2.addTeam(address(b));
            org.grantRoles(DEVOPS, 1 << (4 * (i + 5)), address(b));
        }
        v2.setDepth(3);
        vm.stopPrank();
        uint256 g = gasleft();
        v2.hasRoles(ci, SET_SUB, alice);
        uint256 used = g - gasleft();
        emit log_named_uint("worst-case lookup gas (4 looping teams, depth 3)", used);
        assertLt(used, 4 * v2.MEMBER_CALL_GAS() + 16 * v2.PARENT_CALL_GAS() + 200_000);
    }

    function test_fastPath_nativeOwnerWriteMakesNoLookups() public {
        vm.startPrank(op);
        org.grantRoles(DEVOPS, SET_SUB, address(dev));
        root.grantRoles(ACME, SET_RES, address(dev));
        v2.setDepth(3);
        vm.stopPrank();
        // The operator holds SET_SUBREGISTRY natively (registry-wide, at root): no ancestor or team
        // may be consulted during its write.
        vm.expectCall(address(org), abi.encodeWithSelector(IEnhancedAccessControl.roles.selector), 0);
        vm.expectCall(address(root), abi.encodeWithSelector(IEnhancedAccessControl.roles.selector), 0);
        vm.expectCall(address(dev), abi.encodeWithSelector(ITeam.isMember.selector), 0);
        vm.prank(op);
        v2.setSubregistry(ci, IRegistry(address(0x1)));
    }

    function test_fastPath_memberStillLooksUp() public {
        vm.prank(op);
        org.grantRoles(DEVOPS, SET_SUB, address(dev));
        _join(dev, alice);
        vm.expectCall(address(dev), abi.encodeWithSelector(ITeam.isMember.selector, alice));
        assertTrue(_canSetSub(alice));
    }

    function test_gas_nativeOwnerCost() public {
        vm.startPrank(op);
        org.grantRoles(DEVOPS, SET_SUB, address(dev));
        v2.setSubregistry(ci, IRegistry(address(0x1)));
        uint256 g = gasleft();
        v2.setSubregistry(ci, IRegistry(address(0x2)));
        uint256 twoTeamsDepth1 = g - gasleft();
        v2.setDepth(3);
        g = gasleft();
        v2.setSubregistry(ci, IRegistry(address(0x3)));
        uint256 twoTeamsDepth3 = g - gasleft();
        vm.stopPrank();
        emit log_named_uint("native owner setSubregistry, 2 teams, depth 1 (local, warm)", twoTeamsDepth1);
        emit log_named_uint("native owner setSubregistry, 2 teams, depth 3 (local, warm)", twoTeamsDepth3);
    }
}

contract TeamsTest is V2Fixture {
    // ── step 2: teams of teams ─────────────────────────────────────────────

    function _nested() internal returns (NestedTeam t) {
        address[] memory admins = new address[](1);
        admins[0] = op;
        t = new NestedTeam(admins);
    }

    function test_nested_membershipFlowsUp() public {
        NestedTeam company = _nested();
        NestedTeam platform = _nested();
        vm.startPrank(op);
        platform.addSubTeam(address(dev)); // a plain TeamRegistry inside
        company.addSubTeam(address(platform));
        vm.stopPrank();
        _join(dev, alice);
        assertTrue(platform.isMember(alice));
        assertTrue(company.isMember(alice));
        assertFalse(company.isMember(bob));
        _leave(dev, alice);
        assertFalse(company.isMember(alice));
    }

    function test_nested_depthLimit() public {
        NestedTeam[5] memory chain;
        for (uint256 i; i < 5; ++i) chain[i] = _nested();
        vm.startPrank(op);
        for (uint256 i; i < 4; ++i) chain[i].addSubTeam(address(chain[i + 1]));
        chain[4].grantRoles(TEAM_RES, MEMBER, alice);
        chain[3].grantRoles(TEAM_RES, MEMBER, bob);
        vm.stopPrank();
        assertFalse(chain[0].isMember(alice), "four levels down is beyond MAX_NESTING (3)");
        assertTrue(chain[0].isMember(bob), "three levels down is within it");
        assertTrue(chain[1].isMember(alice));
    }

    function test_nested_cycleEnds() public {
        NestedTeam a = _nested();
        NestedTeam b = _nested();
        vm.startPrank(op);
        a.addSubTeam(address(b));
        b.addSubTeam(address(a));
        b.grantRoles(TEAM_RES, MEMBER, alice);
        vm.stopPrank();
        assertTrue(a.isMember(alice));
        uint256 g = gasleft();
        assertFalse(a.isMember(bob), "a non-member in a cycle is simply not a member");
        assertLt(g - gasleft(), 100_000, "the cycle ends at the depth limit");
    }

    function test_nested_brokenSubTeamDoesNotBlockOthers() public {
        NestedTeam company = _nested();
        BadTeam bad = new BadTeam(); // mode 0: reverts
        vm.startPrank(op);
        company.addSubTeam(address(bad));
        company.addSubTeam(address(dev));
        vm.stopPrank();
        _join(dev, alice);
        assertTrue(company.isMember(alice));
        for (uint256 m = 1; m < 3; ++m) {
            bad.setMode(m); // 1: burns all gas it is given, 2: returns 1 byte
            if (m == 2) assertTrue(company.isMember(alice));
        }
    }

    function test_nested_guards() public {
        NestedTeam company = _nested();
        vm.startPrank(op);
        vm.expectRevert(abi.encodeWithSelector(NestedTeam.SubTeamInvalid.selector, address(company)));
        company.addSubTeam(address(company));
        vm.expectRevert(abi.encodeWithSelector(NestedTeam.SubTeamInvalid.selector, alice));
        company.addSubTeam(alice);
        company.addSubTeam(address(dev));
        vm.expectRevert(abi.encodeWithSelector(NestedTeam.SubTeamAlreadyAdded.selector, address(dev)));
        company.addSubTeam(address(dev));
        company.addSubTeam(address(sec));
        company.addSubTeam(address(new AlwaysTrueTeam()));
        company.addSubTeam(address(new AlwaysTrueTeam()));
        address fifth = address(new AlwaysTrueTeam());
        vm.expectRevert(NestedTeam.TooManySubTeams.selector);
        company.addSubTeam(fifth);
        vm.stopPrank();
        vm.prank(alice);
        vm.expectRevert();
        company.addSubTeam(address(dev));
    }

    function test_nested_asCascadeTeam() public {
        NestedTeam company = _nested();
        vm.startPrank(op);
        company.addSubTeam(address(dev));
        v2.addTeam(address(company));
        org.grantRoles(DEVOPS, SET_SUB, address(company));
        vm.stopPrank();
        _join(dev, alice);
        assertTrue(_canSetSub(alice), "member of a sub-team inherits through the parent team");
        _leave(dev, alice);
        assertFalse(_canSetSub(alice));
    }

    // ── step 4: bring your own roster ───────────────────────────────────────

    function test_hats_wearerInherits() public {
        MockHats hats = new MockHats();
        HatsTeam ht = new HatsTeam(hats, 42);
        vm.startPrank(op);
        v2.addTeam(address(ht));
        org.grantRoles(DEVOPS, SET_SUB, address(ht));
        vm.stopPrank();
        assertFalse(_canSetSub(alice));
        hats.setWearer(alice, 42, true);
        assertTrue(_canSetSub(alice), "wearing the hat is membership");
        hats.setWearer(alice, 42, false);
        assertFalse(_canSetSub(alice));
    }

    function test_hats_expensiveEligibilityFailsClosed() public {
        MockHats hats = new MockHats();
        HatsTeam ht = new HatsTeam(hats, 42);
        vm.startPrank(op);
        v2.addTeam(address(ht));
        org.grantRoles(DEVOPS, SET_SUB, address(ht));
        vm.stopPrank();
        hats.setWearer(alice, 42, true);
        hats.setBurn(150_000); // more than MEMBER_CALL_GAS
        assertFalse(_canSetSub(alice), "over the cap: denied, never allowed");
        vm.prank(op);
        v2.setSubregistry(ci, IRegistry(address(0xC0))); // owner unaffected
    }

    function test_safe_ownersInherit() public {
        MockSafe safe = new MockSafe();
        SafeTeam st = new SafeTeam(safe);
        vm.startPrank(op);
        v2.addTeam(address(st));
        org.grantRoles(DEVOPS, SET_RES, address(st));
        vm.stopPrank();
        safe.setOwner(bob, true);
        assertTrue(_canSetResolver(bob));
        assertFalse(_canSetSub(bob), "only the role the parent granted the Safe");
        safe.setOwner(bob, false);
        assertFalse(_canSetResolver(bob));
    }
}

/// Random action sequences over teams × levels; the rule checked after every step.
contract V2Handler is Test {
    PermissionedRegistry public root;
    PermissionedRegistry public org;
    CascadeSubregistryV2 public v2;
    address public op;
    TeamRegistry[2] public rosters;
    address[4] public pool; // candidate teams: two rosters, always-yes, misbehaving
    BadTeam public bad;
    address[3] public actors;
    uint256 public ci;

    mapping(address => uint256) public ghostNative; // on ci
    uint256 public writeMismatch;
    uint256 public actorConfigSucceeded;
    uint256 public joins;
    uint256 public membershipFailed;

    uint256 constant ACME = uint256(keccak256("acme-corp"));
    uint256 constant DEVOPS = uint256(keccak256("devops"));
    uint256[5] internal ROLES = [SET_SUB, SET_RES, RegistryRolesLib.ROLE_RENEW, RegistryRolesLib.ROLE_REGISTRAR, RegistryRolesLib.ROLE_UNREGISTER];

    constructor(PermissionedRegistry r, PermissionedRegistry o, CascadeSubregistryV2 c, TeamRegistry a, TeamRegistry b, address operator, uint256 ciId) {
        (root, org, v2, op, ci) = (r, o, c, operator, ciId);
        rosters[0] = a;
        rosters[1] = b;
        bad = new BadTeam();
        pool = [address(a), address(b), address(new AlwaysTrueTeam()), address(bad)];
        actors = [makeAddr("alice"), makeAddr("bob"), makeAddr("carol")];
    }

    /// Membership changes are try/caught and failures counted: if a join ever silently failed (e.g. a
    /// consumed prank), the membership invariants would pass vacuously. `membershipFailed` must stay 0.
    function join(uint256 r, uint256 a) external {
        vm.prank(op);
        try rosters[r % 2].grantRoles(TEAM_RES, MEMBER, actors[a % 3]) { joins++; } catch { membershipFailed++; }
    }

    function leave(uint256 r, uint256 a) external {
        vm.prank(op);
        try rosters[r % 2].revokeRoles(TEAM_RES, MEMBER, actors[a % 3]) {} catch { membershipFailed++; }
    }

    function grantAt(bool top, uint256 t, uint256 role) external {
        vm.prank(op);
        if (top) root.grantRoles(ACME, ROLES[role % 5], pool[t % 4]);
        else org.grantRoles(DEVOPS, ROLES[role % 5], pool[t % 4]);
    }

    function revokeAt(bool top, uint256 t, uint256 role) external {
        vm.prank(op);
        if (top) root.revokeRoles(ACME, ROLES[role % 5], pool[t % 4]);
        else org.revokeRoles(DEVOPS, ROLES[role % 5], pool[t % 4]);
    }

    function toggleTeam(uint256 t, uint256 mode) external {
        address team = pool[t % 4];
        bad.setMode(mode % 3);
        address[] memory cur = v2.teams();
        bool present;
        for (uint256 i; i < cur.length; ++i) if (cur[i] == team) present = true;
        vm.prank(op);
        if (present) v2.removeTeam(team);
        else v2.addTeam(team);
    }

    function setDepth(uint256 d) external { vm.prank(op); v2.setDepth(1 + d % 3); }

    function reissue(bool top) external {
        vm.startPrank(op);
        if (top) {
            root.unregister(ACME);
            root.register("acme-corp", op, IRegistry(address(org)), address(0), ALL_ROLES, uint64(block.timestamp + 365 days));
        } else {
            org.unregister(DEVOPS);
            org.register("devops", op, IRegistry(address(v2)), address(0), ALL_ROLES, uint64(block.timestamp + 730 days));
        }
        vm.stopPrank();
    }

    function nativeGrant(uint256 a, uint256 role, bool grant) external {
        (address who, uint256 r) = (actors[a % 3], ROLES[role % 5]);
        vm.prank(op);
        if (grant) { v2.grantRoles(ci, r, who); ghostNative[who] |= r; }
        else { v2.revokeRoles(ci, r, who); ghostNative[who] &= ~r; }
    }

    function actorWrite(uint256 a) external {
        address who = actors[a % 3];
        bool expected = v2.hasRoles(ci, SET_SUB, who);
        vm.prank(who);
        try v2.setSubregistry(ci, IRegistry(address(0xBEEF))) { if (!expected) writeMismatch++; }
        catch { if (expected) writeMismatch++; }
    }

    function actorConfigure(uint256 a, uint256 which) external {
        vm.prank(actors[a % 3]);
        uint256 w = which % 3;
        bool ok;
        if (w == 0) try v2.addTeam(pool[2]) { ok = true; } catch {}
        else if (w == 1) try v2.setDepth(3) { ok = true; } catch {}
        else try v2.register("x", actors[a % 3], IRegistry(address(0)), address(0), 0, uint64(block.timestamp + 1 days)) { ok = true; } catch {}
        if (ok) actorConfigSucceeded++;
    }

    function actorAt(uint256 i) external view returns (address) { return actors[i]; }
}

/// forge-config: default.invariant.runs = 64
/// forge-config: default.invariant.depth = 80
contract CascadeV2InvariantTest is V2Fixture {
    V2Handler handler;

    function setUp() public override {
        super.setUp();
        handler = new V2Handler(root, org, v2, dev, sec, op, ci);
        targetContract(address(handler));
    }

    /// The rule, computed independently from the known tree: level 1 is (org, devops) if org points
    /// at v2; level 2 is (root, acme-corp) if depth ≥ 2 and root points at org; there is no level 3.
    function _expected(address who) internal view returns (uint256 r) {
        r = handler.ghostNative(who);
        bool l1 = address(org.getSubregistry("devops")) == address(v2);
        bool l2 = l1 && v2.depth() >= 2 && address(root.getSubregistry("acme-corp")) == address(org);
        address[] memory ts = v2.teams();
        for (uint256 i; i < ts.length; ++i) {
            address t = ts[i];
            if (t == address(handler.bad()) || !ITeam(t).isMember(who)) continue;
            if (l1) r |= org.roles(DEVOPS, t) & REGULAR;
            if (l2) r |= root.roles(ACME, t) & REGULAR;
        }
    }

    function invariant_rolesFollowTheRule() public view {
        for (uint256 a; a < 3; ++a) {
            address who = handler.actorAt(a);
            assertEq(v2.roles(ci, who), _expected(who), "roles() != native | inherited over teams x levels");
            assertEq(v2.nativeRoles(ci, who), handler.ghostNative(who), "stored roles changed");
            for (uint256 bit; bit < 128; bit += 4) assertFalse(v2.hasRootRoles(1 << bit, who), "root inherited");
        }
    }

    function invariant_writesAndConfigGuarded() public view {
        assertEq(handler.writeMismatch(), 0, "write outcome differed from hasRoles");
        assertEq(handler.actorConfigSucceeded(), 0, "an actor changed teams/depth or registered");
    }

    function invariant_membershipActuallyChanges() public view {
        assertEq(handler.membershipFailed(), 0, "a join or leave failed: membership invariants would be vacuous");
    }
}
