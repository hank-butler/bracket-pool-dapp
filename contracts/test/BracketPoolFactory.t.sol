// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/BracketPoolFactory.sol";
import "../src/BracketPool.sol";
import "./mocks/MockUSDC.sol";

contract BracketPoolFactoryTest is Test {
    BracketPoolFactory public factory;
    MockUSDC public usdc;

    address public admin = address(1);
    address public treasury = address(2);

    function setUp() public {
        usdc = new MockUSDC();

        vm.prank(admin);
        factory = new BracketPoolFactory(address(usdc), treasury);
    }

    function test_factory_initialization() public view {
        assertEq(factory.owner(), admin);
        assertEq(factory.usdc(), address(usdc));
        assertEq(factory.treasury(), treasury);
        assertEq(factory.getPoolCount(), 0);
    }

    function test_createPool_success() public {
        vm.prank(admin);
        address poolAddr = factory.createPool(
            "March Madness 2025",
            67,
            block.timestamp + 7 days,
            block.timestamp + 37 days,
            10e6,
            100
        );

        assertTrue(poolAddr != address(0));
        assertEq(factory.getPoolCount(), 1);
        assertEq(factory.pools(0), poolAddr);

        BracketPool pool = BracketPool(poolAddr);
        assertEq(pool.admin(), admin);
        assertEq(pool.gameCount(), 67);
        assertEq(pool.basePrice(), 10e6);
    }

    function test_createPool_adminIsCallerNotFactory() public {
        vm.prank(admin);
        address poolAddr = factory.createPool(
            "Test Pool", 67, block.timestamp + 7 days, block.timestamp + 37 days, 10e6, 100
        );

        BracketPool pool = BracketPool(poolAddr);
        assertEq(pool.admin(), admin);
        assertTrue(pool.admin() != address(factory));
    }

    function test_createPool_revert_notOwner() public {
        vm.prank(address(99));
        vm.expectRevert();
        factory.createPool("Test", 67, block.timestamp + 7 days, block.timestamp + 37 days, 10e6, 100);
    }

    function test_createMultiplePools() public {
        vm.startPrank(admin);
        factory.createPool("Pool 1", 67, block.timestamp + 7 days, block.timestamp + 37 days, 10e6, 100);
        factory.createPool("Pool 2", 67, block.timestamp + 14 days, block.timestamp + 44 days, 20e6, 50);
        factory.createPool("Pool 3", 67, block.timestamp + 21 days, block.timestamp + 51 days, 5e6, 200);
        vm.stopPrank();

        assertEq(factory.getPoolCount(), 3);
    }

    function test_getAllPools() public {
        vm.startPrank(admin);
        address p1 = factory.createPool("Pool 1", 67, block.timestamp + 7 days, block.timestamp + 37 days, 10e6, 100);
        address p2 = factory.createPool("Pool 2", 67, block.timestamp + 14 days, block.timestamp + 44 days, 20e6, 50);
        vm.stopPrank();

        address[] memory pools = factory.getAllPools();
        assertEq(pools.length, 2);
        assertEq(pools[0], p1);
        assertEq(pools[1], p2);
    }
}
