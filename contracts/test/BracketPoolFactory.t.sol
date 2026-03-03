// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/BracketPoolFactory.sol";
import "../src/BracketPool.sol";
import "./mocks/MockUSDC.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BracketPoolFactoryTest is Test {
    BracketPoolFactory public factory;
    MockUSDC public usdc;
    MockUSDC public usdt;

    address public admin = address(1);
    address public treasury = address(2);

    function setUp() public {
        usdc = new MockUSDC();
        usdt = new MockUSDC();

        address[] memory initialTokens = new address[](1);
        initialTokens[0] = address(usdc);

        vm.prank(admin);
        factory = new BracketPoolFactory(treasury, initialTokens);
    }

    function test_factory_initialization() public view {
        assertEq(factory.owner(), admin);
        assertEq(factory.treasury(), treasury);
        assertEq(factory.getPoolCount(), 0);
        assertTrue(factory.allowedTokens(address(usdc)));
        assertFalse(factory.allowedTokens(address(usdt)));
    }

    // --- Allowlist tests ---

    function test_addToken_success() public {
        vm.prank(admin);
        factory.addToken(address(usdt));
        assertTrue(factory.allowedTokens(address(usdt)));
    }

    function test_addToken_revert_notOwner() public {
        vm.prank(address(99));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(99)));
        factory.addToken(address(usdt));
    }

    function test_addToken_revert_zeroAddress() public {
        vm.prank(admin);
        vm.expectRevert("Invalid token");
        factory.addToken(address(0));
    }

    function test_addToken_idempotent() public {
        // usdc is already in the allowlist — calling addToken again should succeed silently
        vm.prank(admin);
        factory.addToken(address(usdc));
        assertTrue(factory.allowedTokens(address(usdc)));
    }

    function test_removeToken_success() public {
        vm.prank(admin);
        factory.removeToken(address(usdc));
        assertFalse(factory.allowedTokens(address(usdc)));
    }

    function test_removeToken_revert_notOwner() public {
        vm.prank(address(99));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(99)));
        factory.removeToken(address(usdc));
    }

    function test_removeToken_revert_tokenNotInAllowlist() public {
        vm.prank(admin);
        vm.expectRevert("Token not in allowlist");
        factory.removeToken(address(usdt));
    }

    function test_createPool_revert_tokenNotAllowed() public {
        vm.prank(admin);
        vm.expectRevert("Token not allowed");
        factory.createPool(
            address(usdt),
            "Test Pool",
            67,
            block.timestamp + 7 days,
            block.timestamp + 37 days,
            10e6,
            100,
            0
        );
    }

    function test_removeToken_doesNotAffectExistingPools() public {
        vm.startPrank(admin);
        address poolAddr = factory.createPool(
            address(usdc),
            "mm:March Madness 2026",
            63,
            block.timestamp + 7 days,
            block.timestamp + 37 days,
            10e6,
            0,
            0
        );

        // Remove usdc from allowlist
        factory.removeToken(address(usdc));
        vm.stopPrank();

        // Existing pool still uses usdc correctly
        BracketPool pool = BracketPool(poolAddr);
        assertEq(address(pool.token()), address(usdc));

        // But new pool creation is now blocked
        vm.prank(admin);
        vm.expectRevert("Token not allowed");
        factory.createPool(
            address(usdc),
            "Another Pool",
            63,
            block.timestamp + 7 days,
            block.timestamp + 37 days,
            10e6,
            0,
            0
        );
    }

    // --- createPool tests ---

    function test_createPool_success() public {
        vm.prank(admin);
        address poolAddr = factory.createPool(
            address(usdc),
            "mm:March Madness 2026",
            67,
            block.timestamp + 7 days,
            block.timestamp + 37 days,
            10e6,
            100,
            0
        );

        assertTrue(poolAddr != address(0));
        assertEq(factory.getPoolCount(), 1);
        assertEq(factory.pools(0), poolAddr);

        BracketPool pool = BracketPool(poolAddr);
        assertEq(pool.admin(), admin);
        assertEq(pool.gameCount(), 67);
        assertEq(pool.basePrice(), 10e6);
        assertEq(address(pool.token()), address(usdc));
    }

    function test_createPool_adminIsCallerNotFactory() public {
        vm.prank(admin);
        address poolAddr = factory.createPool(
            address(usdc),
            "Test Pool",
            67,
            block.timestamp + 7 days,
            block.timestamp + 37 days,
            10e6,
            100,
            0
        );

        BracketPool pool = BracketPool(poolAddr);
        assertEq(pool.admin(), admin);
        assertTrue(pool.admin() != address(factory));
    }

    function test_createPool_revert_notOwner() public {
        vm.prank(address(99));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(99)));
        factory.createPool(address(usdc), "Test", 67, block.timestamp + 7 days, block.timestamp + 37 days, 10e6, 100, 0);
    }

    function test_createMultiplePools() public {
        vm.startPrank(admin);
        factory.createPool(address(usdc), "Pool 1", 67, block.timestamp + 7 days, block.timestamp + 37 days, 10e6, 100, 0);
        factory.createPool(address(usdc), "Pool 2", 67, block.timestamp + 14 days, block.timestamp + 44 days, 20e6, 50, 0);
        factory.createPool(address(usdc), "Pool 3", 67, block.timestamp + 21 days, block.timestamp + 51 days, 5e6, 200, 0);
        vm.stopPrank();

        assertEq(factory.getPoolCount(), 3);
    }

    function test_getAllPools() public {
        vm.startPrank(admin);
        address p1 = factory.createPool(address(usdc), "Pool 1", 67, block.timestamp + 7 days, block.timestamp + 37 days, 10e6, 100, 0);
        address p2 = factory.createPool(address(usdc), "Pool 2", 67, block.timestamp + 14 days, block.timestamp + 44 days, 20e6, 50, 0);
        vm.stopPrank();

        address[] memory allPools = factory.getAllPools();
        assertEq(allPools.length, 2);
        assertEq(allPools[0], p1);
        assertEq(allPools[1], p2);
    }
}
