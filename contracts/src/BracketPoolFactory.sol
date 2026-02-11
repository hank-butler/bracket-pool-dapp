// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./BracketPool.sol";

contract BracketPoolFactory is Ownable {
    address public immutable usdc;
    address public immutable treasury;

    address[] public pools;

    event PoolCreated(address indexed poolAddress, string poolName, uint256 gameCount);

    constructor(address _usdc, address _treasury) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid treasury");
        usdc = _usdc;
        treasury = _treasury;
    }

    function createPool(
        string calldata _poolName,
        uint256 _gameCount,
        uint256 _lockTime,
        uint256 _finalizeDeadline,
        uint256 _basePrice,
        uint256 _priceSlope
    ) external onlyOwner returns (address) {
        BracketPool pool = new BracketPool(
            usdc,
            treasury,
            msg.sender,
            _poolName,
            _gameCount,
            _lockTime,
            _finalizeDeadline,
            _basePrice,
            _priceSlope
        );

        pools.push(address(pool));
        emit PoolCreated(address(pool), _poolName, _gameCount);
        return address(pool);
    }

    function getPoolCount() external view returns (uint256) {
        return pools.length;
    }

    function getAllPools() external view returns (address[] memory) {
        return pools;
    }
}
