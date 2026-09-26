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
import {ITeam} from "../src/ITeam.sol";
import {TeamRegistry} from "../src/TeamRegistry.sol";

contract NoopLabelStore is ILabelStore {
    function setLabel(string calldata) external {}
    function getLabel(uint256) external pure returns (string memory) {}
    function supportsInterface(bytes4) external pure returns (bool) { return true; }
}

/// An attacker's team: claims ITeam and says everyone is a member.
contract AlwaysTrueTeam is ITeam {
    function isMember(address) external pure returns (bool) { return true; }
    function supportsInterface(bytes4 id) external pure returns (bool) { return id == type(ITeam).interfaceId || id == 0x01ffc9a7; }
}

/// A team that can own a name (accepts ERC1155) with a single member.
contract OwnerTeam is ITeam {
    address immutable m;
    constructor(address member) { m = member; }
    function isMember(address a) external view returns (bool) { return a == m; }
    function supportsInterface(bytes4 id) external pure returns (bool) { return id == type(ITeam).interfaceId || id == 0x01ffc9a7; }
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) { return this.onERC1155Received.selector; }
}

/// Has isMember but does not declare ITeam via ERC-165.
contract UndeclaredTeam {
    function isMember(address) external pure returns (bool) { return true; }
}

/// Misbehaving teams, all declaring ITeam: revert, burn gas, return garbage.
contract BadTeam {
    uint256 public mode; // 0 revert, 1 burn gas, 2 short return
    function setMode(uint256 m) external { mode = m; }
    function supportsInterface(bytes4 id) external pure returns (bool) { return id == type(ITeam).interfaceId || id == 0x01ffc9a7; }
    fallback() external {
        uint256 m = mode;
        if (m == 0) revert("no");
        if (m == 1) { while (true) {} }
        assembly { mstore(0, 1) return(0, 1) } // 1 byte
    }
}

/// The Block 5 sequence plus the audit items: a stock PermissionedRegistry as the parent
/// (`acme-corp.eth`'s registry), `devops` registered in it with CascadeSubregistry beneath, and
/// TeamRegistry granted ROLE_SET_SUBREGISTRY on `devops` by an ordinary EAC grant.
contract CascadeTest is Test {
    uint256 constant ALL_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111;
    uint256 constant SET_SUB = RegistryRolesLib.ROLE_SET_SUBREGISTRY;
    uint256 constant TEAM = 1; // TeamRegistry.TEAM_RESOURCE
    uint256 constant MEMBER = 1; // TeamRegistry.ROLE_MEMBER

    address op = makeAddr("operator");
    address outsider = makeAddr("outsider");

    PermissionedRegistry parent;
    CascadeSubregistry cascade;
    TeamRegistry team;
    uint256 child;
    uint64 exp;

    function setUp() public {
        ILabelStore labels = new NoopLabelStore();
        vm.startPrank(op);
        parent = new PermissionedRegistry(labels, op, ALL_ROLES);
        cascade = new CascadeSubregistry(labels, op, ALL_ROLES);
        address[] memory admins = new address[](1);
        admins[0] = op;
        team = new TeamRegistry(admins);

        exp = uint64(block.timestamp + 365 days);
        parent.register("devops", op, IRegistry(address(cascade)), address(0), ALL_ROLES, exp);
        parent.grantRoles(LibLabel.id("devops"), SET_SUB, address(team));
        cascade.setParent(IRegistry(address(parent)), "devops");
        cascade.setTeam(address(team));
        child = cascade.register("ci", op, IRegistry(address(0)), address(0), RegistryRolesLib.ROLE_RENEW, exp * 2);
        vm.stopPrank();
    }

    function _join() internal { vm.prank(op); team.grantRoles(TEAM, MEMBER, outsider); }
    function _leave() internal { vm.prank(op); team.revokeRoles(TEAM, MEMBER, outsider); }

    function _write() internal {
        vm.prank(outsider);
        cascade.setSubregistry(child, IRegistry(address(0xBEEF)));
    }

    function _expectDenied() internal {
        vm.expectRevert(abi.encodeWithSelector(
            IEnhancedAccessControl.EACUnauthorizedAccountRoles.selector,
            cascade.getResource(child), SET_SUB, outsider));
        _write();
    }

    // ── the core sequence ────────────────────────────────────────────────────

    function test_sequence_denyGrantAllowRevokeDeny() public {
        _expectDenied();
        CascadeSubregistry.Explanation memory e = cascade.explain(child, SET_SUB, outsider);
        assertTrue(!e.native && e.parentGrantsTeam && !e.member && !e.allowed, "denied: fallthrough ran, not a member");

        _join();
        _write();
        assertEq(address(cascade.getSubregistry("ci")), address(0xBEEF));
        e = cascade.explain(child, SET_SUB, outsider);
        assertTrue(!e.native && e.parentGrantsTeam && e.member && e.allowed, "allowed via team");
        assertEq(e.parent, address(parent));
        assertEq(e.label, "devops");

        _leave();
        _expectDenied();
    }

    // ── A1: the _getRoles hook means every view agrees with the write path ──

    function test_hasRolesAgreesWithWrites() public {
        assertFalse(cascade.hasRoles(child, SET_SUB, outsider));
        _join();
        assertTrue(cascade.hasRoles(child, SET_SUB, outsider), "public hasRoles reports the inherited role");
        assertEq(cascade.roles(child, outsider) & SET_SUB, SET_SUB, "roles() includes it");
        _leave();
        assertFalse(cascade.hasRoles(child, SET_SUB, outsider));
    }

    function test_onlyTheRoleTheTeamHolds() public {
        _join();
        vm.prank(outsider);
        vm.expectRevert();
        cascade.setResolver(child, address(0xBEEF)); // team holds SET_SUBREGISTRY, not SET_RESOLVER
    }

    function test_memberCannotRegisterOrGrant() public {
        _join();
        vm.startPrank(outsider);
        vm.expectRevert();
        cascade.register("x", outsider, IRegistry(address(0)), address(0), 0, uint64(block.timestamp + 1 days));
        vm.expectRevert();
        cascade.grantRoles(child, SET_SUB, outsider);
        vm.stopPrank();
    }

    function test_adminBitsOnParentAreNotInherited() public {
        // Names only receive admin bits at registration, so give a team-owned label SET_SUB and its admin.
        OwnerTeam ot = new OwnerTeam(outsider);
        CascadeSubregistry c2 = new CascadeSubregistry(new NoopLabelStore(), op, ALL_ROLES);
        vm.startPrank(op);
        parent.register("ops", address(ot), IRegistry(address(c2)), address(0), SET_SUB | (SET_SUB << 128), exp);
        c2.setParent(IRegistry(address(parent)), "ops");
        c2.setTeam(address(ot));
        uint256 id = c2.register("db", op, IRegistry(address(0)), address(0), 0, exp);
        vm.stopPrank();
        assertEq(parent.roles(LibLabel.id("ops"), address(ot)) >> 128, SET_SUB, "parent really grants the admin bit");
        assertEq(c2.roles(id, outsider), SET_SUB, "only the regular bit is inherited");
        vm.prank(outsider);
        vm.expectRevert();
        c2.grantRoles(id, SET_SUB, makeAddr("friend"));
    }

    function test_rootNeverFallsThrough() public {
        vm.prank(op);
        parent.grantRoles(LibLabel.id("devops"), RegistryRolesLib.ROLE_REGISTRAR, address(team));
        _join();
        assertFalse(cascade.hasRootRoles(RegistryRolesLib.ROLE_REGISTRAR, outsider));
    }

    // ── A2: the team pointer is gated and audited ───────────────────────────

    function test_outsiderCannotSetTeam() public {
        address fake = address(new AlwaysTrueTeam());
        vm.expectRevert(abi.encodeWithSelector(
            IEnhancedAccessControl.EACUnauthorizedAccountRoles.selector, 0, cascade.ROLE_SET_TEAM(), outsider));
        vm.prank(outsider);
        cascade.setTeam(fake);
        assertEq(cascade.team(), address(team));
    }

    function test_setTeamEmitsOldNewSender() public {
        TeamRegistry t2 = new TeamRegistry(new address[](0));
        vm.expectEmit(true, true, true, true, address(cascade));
        emit CascadeSubregistry.TeamPointerUpdated(address(team), address(t2), op);
        vm.prank(op);
        cascade.setTeam(address(t2));
    }

    // ── A3: the team pointer is validated ───────────────────────────────────

    function test_setTeamRejectsWallet() public {
        address wallet = makeAddr("wallet");
        vm.expectRevert(abi.encodeWithSelector(CascadeSubregistry.TeamNotContract.selector, wallet));
        vm.prank(op);
        cascade.setTeam(wallet);
    }

    function test_setTeamRejectsUndeclaredInterface() public {
        address u = address(new UndeclaredTeam());
        vm.expectRevert(abi.encodeWithSelector(CascadeSubregistry.TeamInterfaceUnsupported.selector, u));
        vm.prank(op);
        cascade.setTeam(u);
    }

    // ── A4: misbehaving callees fail closed and cannot brick native checks ──

    function test_badTeamFailsClosed_nativeOwnerUnaffected() public {
        BadTeam bad = new BadTeam();
        vm.startPrank(op);
        cascade.setTeam(address(bad));
        parent.grantRoles(LibLabel.id("devops"), SET_SUB, address(bad));
        vm.stopPrank();
        for (uint256 m; m < 3; ++m) {
            bad.setMode(m);
            _expectDenied();
            vm.prank(op); // the name's native owner still writes fine
            cascade.setSubregistry(child, IRegistry(address(uint160(0xC0 + m))));
        }
    }

    function test_gasCapBoundsTeamCall() public {
        BadTeam bad = new BadTeam();
        bad.setMode(1); // infinite loop
        vm.startPrank(op);
        cascade.setTeam(address(bad));
        parent.grantRoles(LibLabel.id("devops"), SET_SUB, address(bad));
        vm.stopPrank();
        uint256 g = gasleft();
        cascade.hasRoles(child, SET_SUB, outsider);
        assertLt(g - gasleft(), 2 * cascade.MEMBER_CALL_GAS() + cascade.PARENT_CALL_GAS() + 60_000, "bounded by the caps");
    }

    // ── A5: the parent grant is scoped to the parent's current resource ─────

    function test_parentReissueInvalidatesTeamGrant() public {
        _join();
        _write(); // works while devops is the original registration
        vm.startPrank(op);
        parent.unregister(LibLabel.id("devops"));
        parent.register("devops", op, IRegistry(address(cascade)), address(0), ALL_ROLES, exp);
        vm.stopPrank();
        CascadeSubregistry.Explanation memory e = cascade.explain(child, SET_SUB, outsider);
        assertTrue(e.member && !e.parentGrantsTeam && !e.allowed, "same pointer, same member, grant gone");
        _expectDenied();
    }

    function test_parentExpiryInvalidatesTeamGrant() public {
        _join();
        vm.warp(exp + 1); // devops expired; `ci` (expiry exp*2) has not
        _expectDenied();
    }

    function test_parentTransferKeepsGrant_likeAnyNativeDelegate() public {
        // Stock ENSv2: a transfer moves the owner's roles and leaves third-party grants in place.
        address buyer = makeAddr("buyer");
        _join();
        uint256 tokenId = parent.getTokenId(LibLabel.id("devops"));
        vm.prank(op);
        parent.safeTransferFrom(op, buyer, tokenId, 1, "");
        _write();
        // …and the new owner, holding the admin role, can cut it off in one call.
        vm.prank(buyer);
        parent.revokeRoles(LibLabel.id("devops"), SET_SUB, address(team));
        _expectDenied();
    }

    // ── misc ─────────────────────────────────────────────────────────────────

    function test_selfParentDoesNotRecurse() public {
        vm.prank(op);
        cascade.setParent(IRegistry(address(cascade)), "devops");
        _join();
        _expectDenied();
    }

    function test_gas_nativeVsFallthrough() public {
        _join();
        // Same state transition for both: nonzero → nonzero on a warm slot.
        vm.prank(op);
        cascade.setSubregistry(child, IRegistry(address(0x1)));
        vm.prank(op);
        uint256 g = gasleft();
        cascade.setSubregistry(child, IRegistry(address(0x2)));
        uint256 native = g - gasleft();
        vm.prank(outsider);
        g = gasleft();
        cascade.setSubregistry(child, IRegistry(address(0x3)));
        uint256 viaTeam = g - gasleft();
        emit log_named_uint("setSubregistry gas, native owner (local, warm)", native);
        emit log_named_uint("setSubregistry gas, via team (local, warm)", viaTeam);
    }
}
