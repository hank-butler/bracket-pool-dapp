// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/BracketPool.sol";
import "./mocks/MockUSDC.sol";

contract BracketPoolTest is Test {
    BracketPool public pool;
    MockUSDC public usdc;

    address public admin = address(1);
    address public treasury = address(2);
    address public user1 = address(3);
    address public user2 = address(4);

    uint256 public constant GAME_COUNT = 67;
    uint256 public constant BASE_PRICE = 10e6;
    uint256 public constant PRICE_SLOPE = 100;
    uint256 public lockTime;
    uint256 public finalizeDeadline;

    function setUp() public {
        usdc = new MockUSDC();
        lockTime = block.timestamp + 7 days;
        finalizeDeadline = lockTime + 30 days;

        pool = new BracketPool(
            address(usdc),
            treasury,
            admin,
            "March Madness 2025",
            GAME_COUNT,
            lockTime,
            finalizeDeadline,
            BASE_PRICE,
            PRICE_SLOPE
        );

        usdc.mint(user1, 10_000e6);
        usdc.mint(user2, 10_000e6);
    }

    function test_initialization() public view {
        assertEq(address(pool.usdc()), address(usdc));
        assertEq(pool.treasury(), treasury);
        assertEq(pool.admin(), admin);
        assertEq(pool.gameCount(), GAME_COUNT);
        assertEq(pool.lockTime(), lockTime);
        assertEq(pool.finalizeDeadline(), finalizeDeadline);
        assertEq(pool.claimDeadline(), finalizeDeadline + 90 days);
        assertEq(pool.basePrice(), BASE_PRICE);
        assertEq(pool.priceSlope(), PRICE_SLOPE);
        assertEq(pool.totalPoolValue(), 0);
        assertEq(pool.entryCount(), 0);
        assertEq(pool.cancelled(), false);
        assertEq(pool.merkleRoot(), bytes32(0));
    }

    function test_constructor_revert_zeroUsdc() public {
        vm.expectRevert("Invalid USDC address");
        new BracketPool(address(0), treasury, admin, "Test", 67, lockTime, finalizeDeadline, BASE_PRICE, PRICE_SLOPE);
    }

    function test_constructor_revert_zeroTreasury() public {
        vm.expectRevert("Invalid treasury address");
        new BracketPool(address(usdc), address(0), admin, "Test", 67, lockTime, finalizeDeadline, BASE_PRICE, PRICE_SLOPE);
    }

    function test_constructor_revert_zeroAdmin() public {
        vm.expectRevert("Invalid admin address");
        new BracketPool(address(usdc), treasury, address(0), "Test", 67, lockTime, finalizeDeadline, BASE_PRICE, PRICE_SLOPE);
    }

    function test_constructor_revert_lockInPast() public {
        vm.expectRevert("Lock time must be in future");
        new BracketPool(address(usdc), treasury, admin, "Test", 67, block.timestamp - 1, finalizeDeadline, BASE_PRICE, PRICE_SLOPE);
    }

    function test_constructor_revert_deadlineBeforeLock() public {
        vm.expectRevert("Deadline must be after lock");
        new BracketPool(address(usdc), treasury, admin, "Test", 67, lockTime, lockTime - 1, BASE_PRICE, PRICE_SLOPE);
    }

    function test_constructor_revert_zeroBasePrice() public {
        vm.expectRevert("Invalid base price");
        new BracketPool(address(usdc), treasury, admin, "Test", 67, lockTime, finalizeDeadline, 0, PRICE_SLOPE);
    }

    function test_constructor_revert_zeroGameCount() public {
        vm.expectRevert("Invalid game count");
        new BracketPool(address(usdc), treasury, admin, "Test", 0, lockTime, finalizeDeadline, BASE_PRICE, PRICE_SLOPE);
    }
}
