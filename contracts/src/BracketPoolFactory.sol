// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./BracketPool.sol";

contract BracketPoolFactory is Ownable {
    address public immutable treasury;

    mapping(address => bool) public allowedTokens;
    address[] public pools;

    event PoolCreated(address indexed poolAddress, string poolName, uint256 gameCount);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    constructor(address _treasury, address[] memory _initialTokens) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        for (uint256 i = 0; i < _initialTokens.length; i++) {
            require(_initialTokens[i] != address(0), "Invalid token");
            allowedTokens[_initialTokens[i]] = true;
            emit TokenAdded(_initialTokens[i]);
        }
    }

    function addToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid token");
        allowedTokens[_token] = true;
        emit TokenAdded(_token);
    }

    function removeToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid token");
        require(allowedTokens[_token], "Token not in allowlist");
        allowedTokens[_token] = false;
        emit TokenRemoved(_token);
    }

    function createPool(
        address _token,
        string calldata _poolName,
        uint256 _gameCount,
        uint256 _lockTime,
        uint256 _finalizeDeadline,
        uint256 _basePrice,
        uint256 _priceSlope,
        uint256 _maxEntries
    ) external onlyOwner returns (address) {
        require(allowedTokens[_token], "Token not allowed");

        BracketPool pool = new BracketPool(
            _token,
            treasury,
            msg.sender,
            _poolName,
            _gameCount,
            _lockTime,
            _finalizeDeadline,
            _basePrice,
            _priceSlope,
            _maxEntries
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
