// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";

import {IRegistry} from "@ens/v2/registry/interfaces/IRegistry.sol";
import {RegistryRolesLib} from "@ens/v2/registry/libraries/RegistryRolesLib.sol";
import {LibLabel} from "@ens/v2/utils/LibLabel.sol";

import {CascadeSubregistry} from "../src/CascadeSubregistry.sol";
import {ITeam} from "../src/ITeam.sol";
import {NoopLabelStore} from "./Cascade.t.sol";
import {V2Harness} from "./CascadeV2.t.sol";

/// Symbolic proofs with Halmos (`check_` functions; Foundry ignores them, `npm run prove` runs them —
/// needs `pip install halmos` (tested with 0.3.3)).
/// Every argument is symbolic — Halmos proves the assertions for all values, not samples. The parent
/// registries and the team are small mocks whose answers are themselves symbolic, so the proofs cover
/// any grant a parent could report and any membership answer a team could give.

/// A parent registry reduced to what Cascade reads: per-team grants, the child it points to, its parent.
contract SymParent {
    mapping(address => uint256) public grant;
    address public child;
    address public up;
    string public upLabel;
    function setGrant(address team, uint256 g) external { grant[team] = g; }
    function setChild(address c) external { child = c; }
    function setUp_(address u, string calldata l) external { (up, upLabel) = (u, l); }
    function roles(uint256, address team) external view returns (uint256) { return grant[team]; }
    function getSubregistry(string calldata) external view returns (address) { return child; }
    function getParent() external view returns (address, string memory) { return (up, upLabel); }
}

contract SymTeam is ITeam {
    bool public m;
    function set(bool m_) external { m = m_; }
    function isMember(address) external view returns (bool) { return m; }
    function supportsInterface(bytes4 id) external pure returns (bool) { return id == type(ITeam).interfaceId || id == 0x01ffc9a7; }
}

contract CascadeSymbolicTest is Test {
    uint256 constant ALL = 0x1111111111111111111111111111111111111111111111111111111111111111;
    uint256 constant REGULAR = type(uint128).max;
    address op = address(0xA11CE);

    CascadeSubregistry c1;
    V2Harness c2;
    SymParent p1; // v1's parent, and v2's level 1
    SymParent p2; // v2's level 2
    SymTeam a;
    SymTeam b;
    uint256 ci;

    function setUp() public {
        NoopLabelStore labels = new NoopLabelStore();
        p1 = new SymParent();
        p2 = new SymParent();
        a = new SymTeam();
        b = new SymTeam();
        vm.startPrank(op);
        c1 = new CascadeSubregistry(labels, op, ALL);
        c2 = new V2Harness(labels, op, ALL);
        c1.register("ci", op, IRegistry(address(0)), address(0), RegistryRolesLib.ROLE_RENEW, uint64(block.timestamp + 365 days));
        ci = c2.register("ci", op, IRegistry(address(0)), address(0), RegistryRolesLib.ROLE_RENEW, uint64(block.timestamp + 365 days));
        c1.setParent(IRegistry(address(p1)), "devops");
        c1.setTeam(address(a));
        c2.setParent(IRegistry(address(p1)), "devops");
        c2.addTeam(address(a));
        c2.addTeam(address(b));
        c2.setDepth(2);
        vm.stopPrank();
    }

    /// v1: for any parent grant and any membership, a stranger's roles on a name are exactly the regular
    /// half of the grant if they're a member, else nothing; and nothing is ever inherited at root.
    function check_v1_rule(uint256 g, bool member, uint256 rootBitmap) public {
        address who = address(0xB0B);
        p1.setGrant(address(a), g);
        a.set(member);
        uint256 r = c1.roles(LibLabel.id("ci"), who);
        assert(r == (member ? g & REGULAR : 0));
        assert(r >> 128 == 0); // no admin bit, ever
        vm.assume(rootBitmap != 0);
        assert(!c1.hasRootRoles(rootBitmap, who)); // nothing at root
    }

    function _wireV2(uint256 ga1, uint256 gb1, uint256 ga2, uint256 gb2, bool ma, bool mb) internal {
        p1.setChild(address(c2));
        p1.setUp_(address(p2), "acme");
        p2.setChild(address(p1));
        p1.setGrant(address(a), ga1);
        p1.setGrant(address(b), gb1);
        p2.setGrant(address(a), ga2);
        p2.setGrant(address(b), gb2);
        a.set(ma);
        b.set(mb);
    }

    /// v2, two teams, two levels: the lazy write check (`_checkRoles`) succeeds exactly when the full
    /// union (`hasRoles`) covers the requested roles — for any grants, memberships and requested bitmap.
    /// This is the safety claim of the lazy evaluation (decision 18). Proven.
    function check_v2_lazyEqualsFullUnion(uint256 ga1, uint256 gb1, uint256 ga2, uint256 gb2, bool ma, bool mb, uint256 want) public {
        _wireV2(ga1, gb1, ga2, gb2, ma, mb);
        vm.assume(want != 0);
        bool full = c2.hasRoles(ci, want, address(0xB0B));
        bool lazy;
        try c2.checkOrRevert(ci, want, address(0xB0B)) { lazy = true; } catch {}
        assert(lazy == full);
    }

    /// NOT RUN (prefix `inconclusive_`, not `check_`): v2's roles equal the union formula. Halmos 0.3.3
    /// reports counterexamples, always with grants in the top role bits (2^124–2^127), that pass when
    /// replayed concretely on the EVM — i.e. a Halmos modelling discrepancy we did not pin down (not the
    /// gas-capped calls, not the return-data helper; both checked in isolation). The property is covered
    /// by the fuzz and invariant suites instead. Kept here so the attempt is visible.
    function inconclusive_v2_rolesEqualUnionFormula(uint256 ga1, uint256 gb1, uint256 ga2, uint256 gb2, bool ma, bool mb) public {
        _wireV2(ga1, gb1, ga2, gb2, ma, mb);
        uint256 expected = ((ma ? ga1 | ga2 : 0) | (mb ? gb1 | gb2 : 0)) & REGULAR;
        assert(c2.roles(ci, address(0xB0B)) == expected);
    }

    /// v2: a parent that doesn't point back down contributes nothing at any level above it.
    function check_v2_brokenLinkContributesNothing(uint256 ga1, uint256 ga2, bool ma, address wrongChild) public {
        vm.assume(wrongChild != address(c2));
        address who = address(0xB0B);
        p1.setChild(wrongChild);
        p1.setUp_(address(p2), "acme");
        p2.setChild(address(p1));
        p1.setGrant(address(a), ga1);
        p2.setGrant(address(a), ga2);
        a.set(ma);
        b.set(false);
        assert(c2.roles(ci, who) == 0);
    }
}
