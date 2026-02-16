// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/BracketPoolFactory.sol";
import "../test/mocks/MockUSDC.sol";

contract DeployLocalScript is Script {
    function run() external {
        // Anvil account #0
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // 2. Deploy Factory
        BracketPoolFactory factory = new BracketPoolFactory(address(usdc), deployer);
        console.log("Factory deployed at:", address(factory));

        // 3. Create a test pool — locks 1 hour from now, finalize deadline 2 hours
        uint256 lockTime = block.timestamp + 1 hours;
        uint256 finalizeDeadline = block.timestamp + 2 hours;
        uint256 basePrice = 10e6;  // 10 USDC
        uint256 priceSlope = 0;    // flat pricing

        address pool = factory.createPool(
            "March Madness 2026",
            67,
            lockTime,
            finalizeDeadline,
            basePrice,
            priceSlope
        );
        console.log("Pool deployed at:", pool);

        // 4. Mint 1000 USDC to deployer (for testing entries)
        usdc.mint(deployer, 1000e6);
        console.log("Minted 1000 USDC to:", deployer);

        vm.stopBroadcast();
    }
}
