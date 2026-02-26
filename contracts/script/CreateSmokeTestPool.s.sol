// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/BracketPoolFactory.sol";

contract CreateSmokeTestPool is Script {
    function run() external {
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address factory = vm.envAddress("FACTORY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        uint256 lockTime = block.timestamp + 3 minutes;
        uint256 finalizeDeadline = block.timestamp + 1 days;

        address pool = BracketPoolFactory(factory).createPool(
            "Smoke Test Pool",
            63,
            lockTime,
            finalizeDeadline,
            10e6,
            0
        );

        console.log("Pool deployed at:", pool);
        console.log("Lock time:", lockTime);

        vm.stopBroadcast();
    }
}
