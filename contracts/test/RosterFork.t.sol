// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IRegistry} from "@ens/v2/registry/interfaces/IRegistry.sol";

import {HatsTeam, IHats} from "../src/teams/HatsTeam.sol";
import {SafeTeam, ISafeOwners} from "../src/teams/SafeTeam.sol";
import {V2Fixture, SET_SUB} from "./CascadeV2.t.sol";

/// Roadmap step 4 against the real rosters on a Sepolia fork: Hats Protocol v1 and Safe 1.4.1, as
/// deployed. Opt-in because it needs the network: `npm run test:fork` (sets FORK_TESTS=1; RPC from
/// SEPOLIA_RPC_URL or the public Sepolia endpoint). The v2 tree itself is deployed fresh on the fork.
interface IHatsFull is IHats {
    function mintTopHat(address target, string calldata details, string calldata imageURI) external returns (uint256);
    function createHat(uint256 admin, string calldata details, uint32 maxSupply, address eligibility, address toggle, bool mutable_, string calldata imageURI) external returns (uint256);
    function mintHat(uint256 hatId, address wearer) external returns (bool);
    function renounceHat(uint256 hatId) external;
}

interface ISafeFull is ISafeOwners {
    function setup(address[] calldata owners, uint256 threshold, address to, bytes calldata data, address fallbackHandler, address paymentToken, uint256 payment, address payable paymentReceiver) external;
    function removeOwner(address prevOwner, address owner, uint256 threshold) external;
    function addOwnerWithThreshold(address owner, uint256 threshold) external;
}

interface ISafeProxyFactory {
    function createProxyWithNonce(address singleton, bytes memory initializer, uint256 saltNonce) external returns (address proxy);
}

contract RosterForkTest is V2Fixture {
    IHatsFull constant HATS = IHatsFull(0x3bc1A0Ad72417f2d411118085256fC53CBdDd137); // Hats Protocol v1
    ISafeProxyFactory constant SAFE_FACTORY = ISafeProxyFactory(0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67); // Safe 1.4.1
    address constant SAFE_SINGLETON = 0x41675C099F32341bf84BFc5382aF534df5C7461a; // Safe 1.4.1
    address constant SENTINEL = address(0x1);
    uint256 constant DEVOPS_ = uint256(keccak256("devops"));

    bool on;

    function setUp() public override {
        on = vm.envOr("FORK_TESTS", false);
        if (!on) return;
        vm.createSelectFork(vm.envOr("SEPOLIA_RPC_URL", string("https://ethereum-sepolia-rpc.publicnode.com")));
        super.setUp();
    }

    function test_fork_hatsWearersInherit() public {
        if (!on) return;
        address admin = makeAddr("hats-admin");
        uint256 top = HATS.mintTopHat(admin, "acme", "");
        vm.prank(admin);
        // Any non-zero eligibility/toggle address that isn't a module means "eligible and active" by default.
        uint256 hat = HATS.createHat(top, "devops", 10, address(0x4a75), address(0x4a75), true, "");
        HatsTeam ht = new HatsTeam(HATS, hat);
        vm.startPrank(op);
        v2.addTeam(address(ht));
        org.grantRoles(DEVOPS_, SET_SUB, address(ht));
        vm.stopPrank();

        assertFalse(_canSetSub(alice), "not wearing the hat");
        vm.prank(admin);
        HATS.mintHat(hat, alice);
        uint256 g = gasleft();
        bool wears = ht.isMember(alice);
        emit log_named_uint("HatsTeam.isMember gas (real Hats v1)", g - gasleft());
        assertTrue(wears);
        assertTrue(_canSetSub(alice), "wearing the hat is membership");
        vm.prank(alice);
        HATS.renounceHat(hat);
        assertFalse(_canSetSub(alice), "renounced: access gone");
    }

    function test_fork_safeOwnersInherit() public {
        if (!on) return;
        address[] memory owners = new address[](2);
        (owners[0], owners[1]) = (bob, carol);
        bytes memory init = abi.encodeCall(ISafeFull.setup, (owners, 1, address(0), "", address(0), address(0), 0, payable(address(0))));
        ISafeFull safe = ISafeFull(SAFE_FACTORY.createProxyWithNonce(SAFE_SINGLETON, init, uint256(keccak256("ens-drive-fork-test"))));
        SafeTeam st = new SafeTeam(safe);
        vm.startPrank(op);
        v2.addTeam(address(st));
        org.grantRoles(DEVOPS_, SET_SUB, address(st));
        vm.stopPrank();

        uint256 g = gasleft();
        bool owner = st.isMember(bob);
        emit log_named_uint("SafeTeam.isMember gas (real Safe 1.4.1)", g - gasleft());
        assertTrue(owner);
        assertTrue(_canSetSub(bob), "a Safe owner inherits");
        assertFalse(_canSetSub(alice), "not an owner");

        // Owner changes are the Safe's own (self-authorised) calls; here as the Safe itself.
        vm.prank(address(safe));
        safe.addOwnerWithThreshold(alice, 1);
        assertTrue(_canSetSub(alice), "added as owner: access");
        vm.prank(address(safe));
        safe.removeOwner(SENTINEL, alice, 1); // newest owner sits right after the sentinel
        assertFalse(_canSetSub(alice), "removed: access gone");
    }
}
