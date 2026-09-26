// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IRegistry} from "@ens/v2/registry/interfaces/IRegistry.sol";
import {RegistryRolesLib} from "@ens/v2/registry/libraries/RegistryRolesLib.sol";

import {TeamRegistry} from "../src/TeamRegistry.sol";
import {V2Fixture, SET_SUB, SET_RES} from "./CascadeV2.t.sol";

/// Gas benchmark for CascadeSubregistryV2's permission check, one scenario per test so each starts from
/// the same cold state. Run with `forge test --match-contract CascadeV2GasBench -vv`; figures are logged,
/// not asserted (docs/roadmap-v2.md records them). The tree is V2Fixture's: .eth → acme-corp (org) →
/// devops (v2) → ci, with dev-team (SET_SUBREGISTRY on devops, level 1) and sec (SET_RESOLVER on
/// acme-corp, level 2), depth 2.
contract CascadeV2GasBench is V2Fixture {
    uint256 constant ACME_ = uint256(keccak256("acme-corp"));
    uint256 constant DEVOPS_ = uint256(keccak256("devops"));

    function setUp() public override {
        super.setUp();
        vm.startPrank(op);
        org.grantRoles(DEVOPS_, SET_SUB, address(dev));
        root.grantRoles(ACME_, SET_RES, address(sec));
        v2.setDepth(2);
        vm.stopPrank();
    }

    function _measure(string memory what, address who, bool resolver) internal returns (uint256 used, bool ok) {
        vm.prank(who);
        uint256 g = gasleft();
        if (resolver) {
            try v2.setResolver(ci, address(0xBEEF)) { ok = true; } catch {}
        } else {
            try v2.setSubregistry(ci, IRegistry(address(0xBEEF))) { ok = true; } catch {}
        }
        used = g - gasleft();
        emit log_named_uint(string.concat(what, ok ? " [allowed]" : " [denied]"), used);
    }

    function test_bench_ownerWrite() public {
        _measure("owner setSubregistry", op, false);
    }

    function test_bench_level1Member() public {
        _join(dev, alice);
        _measure("dev member setSubregistry (level 1)", alice, false);
    }

    function test_bench_level2Member() public {
        _join(sec, alice);
        _measure("sec member setResolver (level 2)", alice, true);
    }

    function test_bench_memberOfBoth_level1Write() public {
        _join(dev, alice);
        _join(sec, alice);
        _measure("member of both, setSubregistry (level 1)", alice, false);
    }

    function test_bench_devMemberResolverDenied() public {
        _join(dev, alice);
        _measure("dev member setResolver (not granted)", alice, true);
    }

    function test_bench_nonMemberDenied() public {
        _measure("non-member setSubregistry", bob, false);
    }

    function test_bench_fourTeamsDepth3_firstTeamLevel1() public {
        address[] memory admins = new address[](1);
        admins[0] = op;
        vm.startPrank(op);
        TeamRegistry t3 = new TeamRegistry(admins);
        TeamRegistry t4 = new TeamRegistry(admins);
        v2.addTeam(address(t3));
        v2.addTeam(address(t4));
        org.grantRoles(DEVOPS_, RegistryRolesLib.ROLE_RENEW, address(t3));
        root.grantRoles(ACME_, SET_SUB, address(t4));
        v2.setDepth(3);
        vm.stopPrank();
        _join(dev, alice);
        _measure("4 teams, depth 3: dev member setSubregistry (level 1)", alice, false);
    }
}
