// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";

import {IRegistry} from "@ens/v2/registry/interfaces/IRegistry.sol";
import {PermissionedRegistry} from "@ens/v2/registry/PermissionedRegistry.sol";
import {RegistryRolesLib} from "@ens/v2/registry/libraries/RegistryRolesLib.sol";
import {ILabelStore} from "@ens/v2/utils/interfaces/ILabelStore.sol";
import {LibLabel} from "@ens/v2/utils/LibLabel.sol";

import {CascadeSubregistry} from "../src/CascadeSubregistry.sol";
import {ITeam} from "../src/ITeam.sol";
import {TeamRegistry} from "../src/TeamRegistry.sol";
import {NoopLabelStore, AlwaysTrueTeam, OwnerTeam, BadTeam} from "./Cascade.t.sol";

/// The step-0 rule, stated once. For any name resource on a CascadeSubregistry and any account:
///
///   roles = native | (parent.roles(label, team) & regular bits)   if team.isMember(account)
///   roles = native                                                otherwise
///
/// and nothing is ever inherited at ROOT_RESOURCE. The invariant suite drives random sequences of
/// real actions and checks this equation, plus its consequences, after every step. The fuzz suite
/// checks the edges: arbitrary return data from team and parent, arbitrary role bitmaps.
library Rule {
    uint256 internal constant ALL_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111;
    uint256 internal constant REGULAR = type(uint128).max;
}

/// Answers `supportsInterface` properly and returns fixed bytes for anything else (e.g. `isMember`).
contract RawTeam {
    bytes ret;
    constructor(bytes memory r) { ret = r; }
    function supportsInterface(bytes4 id) external pure returns (bool) { return id == type(ITeam).interfaceId || id == 0x01ffc9a7; }
    fallback() external {
        bytes memory r = ret;
        assembly { return(add(r, 32), mload(r)) }
    }
}

/// A parent that returns fixed bytes from every call (e.g. `roles`).
contract RawParent {
    bytes ret;
    constructor(bytes memory r) { ret = r; }
    fallback() external {
        bytes memory r = ret;
        assembly { return(add(r, 32), mload(r)) }
    }
}

/// Drives the system with random, realistic actions. Every call is made as the account that would
/// really make it (`vm.prank`). Anything that must never succeed or never revert is counted in a
/// ghost variable; the invariants require those counts to stay zero.
contract Handler is Test {
    PermissionedRegistry public parent;
    CascadeSubregistry public cascade;
    TeamRegistry public roster;
    TeamRegistry public roster2;
    AlwaysTrueTeam public alwaysTrue;
    BadTeam public bad;
    address public op;

    address[] public actors;
    uint256[] public names; // labelhashes of subnames on cascade

    /// ghost: regular roles the operator granted each actor natively on each name
    mapping(uint256 => mapping(address => uint256)) public ghostNative;

    uint256 public writeMismatch; // a write's outcome differed from hasRoles just before it
    uint256 public actorGrantSucceeded; // an actor granted a role on cascade (needs admin bits)
    uint256 public actorSetTeamSucceeded; // an actor changed the team pointer
    uint256 public actorRegisterSucceeded; // an actor registered a name (needs a root role)
    uint256 public viewReverted; // a role view reverted (must fail closed, never revert)

    uint256 public joins; // coverage: membership really changes during runs
    uint256 public membershipFailed; // a failed join/leave would make the membership invariants vacuous
    uint256 public allowedWrites; // coverage: some writes really succeed via the team

    uint256 constant DEVOPS = uint256(keccak256("devops")); // labelhash; version bits resolved by the registry
    uint256 constant TEAM_RESOURCE = 1; // TeamRegistry.TEAM_RESOURCE
    uint256 constant ROLE_MEMBER = 1; // TeamRegistry.ROLE_MEMBER
    uint256 internal nextName;

    uint256[6] internal REGISTRY_ROLES = [
        RegistryRolesLib.ROLE_SET_SUBREGISTRY,
        RegistryRolesLib.ROLE_SET_RESOLVER,
        RegistryRolesLib.ROLE_RENEW,
        RegistryRolesLib.ROLE_UNREGISTER,
        RegistryRolesLib.ROLE_REGISTRAR,
        RegistryRolesLib.ROLE_SET_URI
    ];

    constructor(
        PermissionedRegistry p,
        CascadeSubregistry c,
        TeamRegistry r,
        TeamRegistry r2,
        address operator,
        uint256 firstName
    ) {
        (parent, cascade, roster, roster2, op) = (p, c, r, r2, operator);
        alwaysTrue = new AlwaysTrueTeam();
        bad = new BadTeam();
        actors.push(makeAddr("alice"));
        actors.push(makeAddr("bob"));
        actors.push(makeAddr("carol"));
        names.push(firstName);
    }

    function actorCount() external view returns (uint256) { return actors.length; }
    function nameCount() external view returns (uint256) { return names.length; }

    function _actor(uint256 s) internal view returns (address) { return actors[s % actors.length]; }
    function _name(uint256 s) internal view returns (uint256) { return names[s % names.length]; }
    function _role(uint256 s) internal view returns (uint256) { return REGISTRY_ROLES[s % REGISTRY_ROLES.length]; }

    // ── membership (the operator is the roster admin) ─────────────────────

    function join(uint256 a, bool second) external {
        TeamRegistry t = second ? roster2 : roster;
        vm.prank(op); // constants are literals: a view call here would consume the prank
        try t.grantRoles(TEAM_RESOURCE, ROLE_MEMBER, _actor(a)) { joins++; } catch { membershipFailed++; }
    }

    function leave(uint256 a, bool second) external {
        TeamRegistry t = second ? roster2 : roster;
        vm.prank(op);
        try t.revokeRoles(TEAM_RESOURCE, ROLE_MEMBER, _actor(a)) {} catch { membershipFailed++; }
    }

    // ── the parent's grant to the current team ──────────────────────────────

    function parentGrant(uint256 r) external {
        address t = cascade.team();
        vm.prank(op);
        parent.grantRoles(DEVOPS, _role(r), t);
    }

    function parentRevoke(uint256 r) external {
        address t = cascade.team();
        vm.prank(op);
        parent.revokeRoles(DEVOPS, _role(r), t);
    }

    /// Unregister and re-register devops: the EAC resource moves, so the team's grant is gone.
    function reissueParent() external {
        vm.startPrank(op);
        parent.unregister(DEVOPS);
        parent.register("devops", op, IRegistry(address(cascade)), address(0), Rule.ALL_ROLES, uint64(block.timestamp + 365 days));
        vm.stopPrank();
    }

    // ── the operator re-points the team (it holds ROLE_SET_TEAM) ────────────

    function setTeam(uint256 which, uint256 badMode) external {
        address t;
        uint256 w = which % 4;
        if (w == 0) t = address(roster);
        else if (w == 1) t = address(roster2);
        else if (w == 2) t = address(alwaysTrue);
        else { bad.setMode(badMode % 3); t = address(bad); }
        vm.prank(op);
        cascade.setTeam(t);
    }

    // ── subnames and native grants ───────────────────────────────────────────

    function newName() external {
        if (names.length >= 6) return;
        string memory label = string.concat("svc-", vm.toString(nextName++));
        vm.prank(op);
        cascade.register(label, op, IRegistry(address(0)), address(0), RegistryRolesLib.ROLE_RENEW, uint64(block.timestamp + 730 days));
        names.push(LibLabel.id(label));
    }

    function nativeGrant(uint256 n, uint256 a, uint256 r) external {
        (uint256 id, address who, uint256 role) = (_name(n), _actor(a), _role(r));
        vm.prank(op);
        cascade.grantRoles(id, role, who);
        ghostNative[id][who] |= role;
    }

    function nativeRevoke(uint256 n, uint256 a, uint256 r) external {
        (uint256 id, address who, uint256 role) = (_name(n), _actor(a), _role(r));
        vm.prank(op);
        cascade.revokeRoles(id, role, who);
        ghostNative[id][who] &= ~role;
    }

    // ── what actors try ──────────────────────────────────────────────────────

    /// The demo's write. Its outcome must match the public view taken just before it.
    function actorWrite(uint256 n, uint256 a, address newSub) external {
        (uint256 id, address who) = (_name(n), _actor(a));
        bool expected;
        try cascade.hasRoles(id, RegistryRolesLib.ROLE_SET_SUBREGISTRY, who) returns (bool h) { expected = h; }
        catch { viewReverted++; return; }
        vm.prank(who);
        try cascade.setSubregistry(id, IRegistry(newSub)) { if (!expected) writeMismatch++; else allowedWrites++; }
        catch { if (expected) writeMismatch++; }
    }

    /// Members use roles; they can never grant them (no admin bits are inherited).
    function actorGrant(uint256 n, uint256 a, uint256 r, uint256 to) external {
        vm.prank(_actor(a));
        try cascade.grantRoles(_name(n), _role(r), _actor(to)) { actorGrantSucceeded++; } catch {}
    }

    /// The demo's attack: swap the team for one that says yes to everyone.
    function actorSetTeam(uint256 a) external {
        vm.prank(_actor(a));
        try cascade.setTeam(address(alwaysTrue)) { actorSetTeamSucceeded++; } catch {}
    }

    /// Registering needs ROLE_REGISTRAR on root, which is never inherited.
    function actorRegister(uint256 a) external {
        address who = _actor(a);
        vm.prank(who);
        try cascade.register(string.concat("x-", vm.toString(nextName++)), who, IRegistry(address(0)), address(0), 0, uint64(block.timestamp + 1 days)) {
            actorRegisterSucceeded++;
        } catch {}
    }
}

/// forge-config: default.invariant.runs = 64
/// forge-config: default.invariant.depth = 100
contract CascadeInvariantTest is Test {
    PermissionedRegistry parent;
    CascadeSubregistry cascade;
    Handler handler;
    address op = makeAddr("operator");

    uint256 constant DEVOPS = uint256(keccak256("devops"));

    function setUp() public {
        ILabelStore labels = new NoopLabelStore();
        vm.startPrank(op);
        parent = new PermissionedRegistry(labels, op, Rule.ALL_ROLES);
        cascade = new CascadeSubregistry(labels, op, Rule.ALL_ROLES);
        address[] memory admins = new address[](1);
        admins[0] = op;
        TeamRegistry roster = new TeamRegistry(admins);
        TeamRegistry roster2 = new TeamRegistry(admins);
        uint64 exp = uint64(block.timestamp + 365 days);
        parent.register("devops", op, IRegistry(address(cascade)), address(0), Rule.ALL_ROLES, exp);
        parent.grantRoles(DEVOPS, RegistryRolesLib.ROLE_SET_SUBREGISTRY, address(roster));
        cascade.setParent(IRegistry(address(parent)), "devops");
        cascade.setTeam(address(roster));
        cascade.register("ci", op, IRegistry(address(0)), address(0), RegistryRolesLib.ROLE_RENEW, exp * 2);
        vm.stopPrank();

        handler = new Handler(parent, cascade, roster, roster2, op, LibLabel.id("ci"));
        targetContract(address(handler));
    }

    /// What the rule says an account's roles on a name are, computed independently of Cascade:
    /// the stored roles, plus the parent's current grant to the current team (regular bits only)
    /// if the team — asked directly — says the account is a member.
    function _expected(uint256 id, address who) internal view returns (uint256 r) {
        r = handler.ghostNative(id, who);
        address t = cascade.team();
        if (t == address(handler.bad())) return r; // reverts, loops or returns 1 byte: never a member
        if (!ITeam(t).isMember(who)) return r;
        r |= parent.roles(DEVOPS, t) & Rule.REGULAR;
    }

    /// The rule itself: every role view equals the equation, for every actor on every name.
    function invariant_rolesFollowTheRule() public view {
        for (uint256 n; n < handler.nameCount(); ++n) {
            uint256 id = handler.names(n);
            for (uint256 a; a < handler.actorCount(); ++a) {
                address who = handler.actors(a);
                assertEq(cascade.roles(id, who), _expected(id, who), "roles() != native | inherited");
            }
        }
    }

    /// Inheritance never writes: stored roles are exactly what the operator granted natively.
    function invariant_storedRolesUntouched() public view {
        for (uint256 n; n < handler.nameCount(); ++n) {
            uint256 id = handler.names(n);
            for (uint256 a; a < handler.actorCount(); ++a) {
                address who = handler.actors(a);
                assertEq(cascade.nativeRoles(id, who), handler.ghostNative(id, who), "stored roles changed");
            }
        }
    }

    /// No admin bit ever reaches an actor, so no actor can ever grant.
    function invariant_noAdminBits() public view {
        for (uint256 n; n < handler.nameCount(); ++n) {
            for (uint256 a; a < handler.actorCount(); ++a) {
                assertEq(cascade.roles(handler.names(n), handler.actors(a)) >> 128, 0, "admin bit inherited");
            }
        }
        assertEq(handler.actorGrantSucceeded(), 0, "an actor granted a role");
    }

    /// Nothing is inherited at root: no actor holds any registry-wide role, so none can register or swap the team.
    function invariant_rootNeverInherited() public view {
        for (uint256 a; a < handler.actorCount(); ++a) {
            address who = handler.actors(a);
            for (uint256 bit; bit < 128; bit += 4) {
                assertFalse(cascade.hasRootRoles(1 << bit, who), "root role inherited");
            }
        }
        assertEq(handler.actorRegisterSucceeded(), 0, "an actor registered a name");
        assertEq(handler.actorSetTeamSucceeded(), 0, "an actor changed the team");
    }

    /// Joins and leaves really take effect (guards against a vacuous pass, e.g. a consumed prank).
    function invariant_membershipActuallyChanges() public view {
        assertEq(handler.membershipFailed(), 0, "a join or leave failed: membership invariants would be vacuous");
    }

    /// Views agree with writes, and views never revert whatever the team or parent does.
    function invariant_viewsAgreeWithWrites() public view {
        assertEq(handler.writeMismatch(), 0, "write outcome differed from hasRoles");
        assertEq(handler.viewReverted(), 0, "a role view reverted");
    }
}

/// Edge cases with random inputs.
contract CascadeFuzzTest is Test {
    PermissionedRegistry parent;
    CascadeSubregistry cascade;
    TeamRegistry roster;
    address op = makeAddr("operator");
    address member = makeAddr("member");
    uint256 child;

    uint256 constant DEVOPS = uint256(keccak256("devops"));
    uint256 constant SET_SUB = RegistryRolesLib.ROLE_SET_SUBREGISTRY;

    function setUp() public {
        ILabelStore labels = new NoopLabelStore();
        vm.startPrank(op);
        parent = new PermissionedRegistry(labels, op, Rule.ALL_ROLES);
        cascade = new CascadeSubregistry(labels, op, Rule.ALL_ROLES);
        address[] memory admins = new address[](1);
        admins[0] = op;
        roster = new TeamRegistry(admins);
        uint64 exp = uint64(block.timestamp + 365 days);
        parent.register("devops", op, IRegistry(address(cascade)), address(0), Rule.ALL_ROLES, exp);
        cascade.setParent(IRegistry(address(parent)), "devops");
        cascade.setTeam(address(roster));
        child = cascade.register("ci", op, IRegistry(address(0)), address(0), RegistryRolesLib.ROLE_RENEW, exp * 2);
        roster.grantRoles(roster.TEAM_RESOURCE(), roster.ROLE_MEMBER(), member);
        vm.stopPrank();
    }

    /// Whatever bytes a team returns from isMember, checks never revert, only an exact ABI `true`
    /// counts as membership, and the native owner can always still write.
    function testFuzz_teamReturnDataFailsClosed(bytes calldata ret) public {
        vm.assume(ret.length <= 96); // short, exact and over-long answers; stays well under the 30k cap
        RawTeam t = new RawTeam(ret);
        vm.startPrank(op);
        cascade.setTeam(address(t));
        parent.grantRoles(DEVOPS, SET_SUB, address(t));
        vm.stopPrank();

        bool isTrue = ret.length >= 32 && uint256(bytes32(ret[:32])) == 1;
        assertEq(cascade.roles(child, member), isTrue ? SET_SUB : 0);
        assertEq(cascade.hasRoles(child, SET_SUB, member), isTrue);

        vm.prank(op);
        cascade.setSubregistry(child, IRegistry(address(0xBEEF)));
        assertEq(address(cascade.getSubregistry("ci")), address(0xBEEF));
    }

    /// Whatever bytes the parent returns from roles(), checks never revert and only the regular
    /// half of a well-formed answer is inherited.
    function testFuzz_parentReturnDataFailsClosed(bytes calldata ret) public {
        vm.assume(ret.length <= 256);
        RawParent p = new RawParent(ret);
        vm.prank(op);
        cascade.setParent(IRegistry(address(p)), "devops");

        uint256 expected = ret.length >= 32 ? uint256(bytes32(ret[:32])) & Rule.REGULAR : 0;
        assertEq(cascade.roles(child, member), expected);
        assertEq(cascade.roles(child, makeAddr("stranger")), 0);

        vm.prank(op);
        cascade.setSubregistry(child, IRegistry(address(0xBEEF)));
    }

    /// Whatever roles — regular and admin — a team-owned parent name holds, members inherit
    /// exactly the regular half and can grant nothing.
    function testFuzz_adminBitsNeverInherited(uint256 bitmap) public {
        bitmap &= Rule.ALL_ROLES;
        OwnerTeam ot = new OwnerTeam(member);
        CascadeSubregistry c2 = new CascadeSubregistry(new NoopLabelStore(), op, Rule.ALL_ROLES);
        vm.startPrank(op);
        parent.register("ops", address(ot), IRegistry(address(c2)), address(0), bitmap, uint64(block.timestamp + 365 days));
        c2.setParent(IRegistry(address(parent)), "ops");
        c2.setTeam(address(ot));
        uint256 id = c2.register("db", op, IRegistry(address(0)), address(0), 0, uint64(block.timestamp + 365 days));
        vm.stopPrank();

        assertEq(c2.roles(id, member), bitmap & Rule.REGULAR, "exactly the regular half");
        vm.prank(member);
        vm.expectRevert();
        c2.grantRoles(id, SET_SUB, makeAddr("friend"));
    }

    /// Whatever regular roles the parent grants the team, a member holds none of them at root.
    function testFuzz_rootNeverInherited(uint256 bitmap) public {
        bitmap &= Rule.ALL_ROLES & Rule.REGULAR;
        vm.assume(bitmap != 0);
        vm.prank(op);
        parent.grantRoles(DEVOPS, bitmap, address(roster));

        assertEq(cascade.roles(child, member), bitmap, "inherited on the name");
        for (uint256 bit; bit < 128; bit += 4) {
            if (bitmap & (1 << bit) != 0) assertFalse(cascade.hasRootRoles(1 << bit, member), "inherited at root");
        }
        vm.prank(member);
        vm.expectRevert();
        cascade.register("x", member, IRegistry(address(0)), address(0), 0, uint64(block.timestamp + 1 days));
    }

    /// Any account that is not a member gets nothing from the team, whatever the parent grants.
    function testFuzz_nonMemberGetsNothing(address who, uint256 bitmap) public {
        vm.assume(who != member && who != op);
        bitmap &= Rule.ALL_ROLES & Rule.REGULAR;
        if (bitmap != 0) {
            vm.prank(op);
            parent.grantRoles(DEVOPS, bitmap, address(roster));
        }
        assertEq(cascade.roles(child, who), 0);
    }
}
