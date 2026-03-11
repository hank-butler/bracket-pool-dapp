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

        uint16[] memory payoutBps = new uint16[](3);
        payoutBps[0] = 6000;
        payoutBps[1] = 2500;
        payoutBps[2] = 1500;

        address pool = BracketPoolFactory(factory).createPool(
            vm.envAddress("TOKEN_ADDRESS"),
            "mm:Smoke Test Pool",
            "mm",
            payoutBps,
            63,
            lockTime,
            finalizeDeadline,
            10e6,
            0,
            0  // unlimited entries
        );

        console.log("Pool deployed at:", pool);
        console.log("Lock time:", lockTime);

        vm.stopBroadcast();
    }
}
