// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract BracketPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Structs ---
    struct Entry {
        address owner;
        bytes32 picksHash;
        uint256 tiebreaker;
        uint256 pricePaid;
    }

    // --- Immutables ---
    IERC20 public immutable usdc;
    address public immutable treasury;
    address public immutable admin;
    uint256 public immutable gameCount;
    uint256 public immutable lockTime;
    uint256 public immutable finalizeDeadline;
    uint256 public immutable claimDeadline;
    uint256 public immutable basePrice;
    uint256 public immutable priceSlope;

    // --- Constants ---
    uint256 public constant FEE_PERCENT = 500;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_ENTRIES = 2;

    // --- Mutable State ---
    string public poolName;
    uint256 public totalPoolValue;
    uint256 public entryCount;
    bool public cancelled;
    bytes32 public merkleRoot;
    bytes32[] public gameResults;
    string public proofsCID;

    // --- Mappings ---
    mapping(uint256 => Entry) public entries;
    mapping(address => uint256[]) internal _userEntryIds;
    mapping(uint256 => bool) public entryClaimed;
    mapping(uint256 => bool) public entryRefunded;

    // --- Events ---
    event EntrySubmitted(uint256 indexed entryId, address indexed owner, bytes32[] picks, uint256 tiebreaker, uint256 pricePaid);
    event ResultsPosted(bytes32[] results);
    event MerkleRootSet(bytes32 root);
    event FeePaid(address treasury, uint256 amount);
    event PrizeClaimed(uint256 indexed entryId, address indexed owner, uint256 amount);
    event PoolCancelled();
    event EntryRefunded(uint256 indexed entryId, address indexed owner, uint256 amount);
    event ProofsCIDSet(string cid);
    event UnclaimedSwept(address treasury, uint256 amount);

    // --- Constructor ---
    constructor(
        address _usdc,
        address _treasury,
        address _admin,
        string memory _poolName,
        uint256 _gameCount,
        uint256 _lockTime,
        uint256 _finalizeDeadline,
        uint256 _basePrice,
        uint256 _priceSlope
    ) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_admin != address(0), "Invalid admin address");
        require(_gameCount > 0, "Invalid game count");
        require(_lockTime > block.timestamp, "Lock time must be in future");
        require(_finalizeDeadline > _lockTime, "Deadline must be after lock");
        require(_basePrice > 0, "Invalid base price");

        usdc = IERC20(_usdc);
        treasury = _treasury;
        admin = _admin;
        poolName = _poolName;
        gameCount = _gameCount;
        lockTime = _lockTime;
        finalizeDeadline = _finalizeDeadline;
        claimDeadline = _finalizeDeadline + 90 days;
        basePrice = _basePrice;
        priceSlope = _priceSlope;
    }

    // --- View Functions ---

    function getCurrentPrice() public view returns (uint256) {
        return basePrice + (priceSlope * totalPoolValue / BASIS_POINTS);
    }

    function getUserEntryIds(address user) external view returns (uint256[] memory) {
        return _userEntryIds[user];
    }

    function getGameResults() external view returns (bytes32[] memory) {
        return gameResults;
    }

    // --- Entry ---

    function enter(bytes32[] calldata picks, uint256 tiebreaker) external nonReentrant {
        require(block.timestamp < lockTime, "Pool is locked");
        require(!cancelled, "Pool is cancelled");
        require(picks.length == gameCount, "Invalid picks length");

        uint256 price = getCurrentPrice();
        usdc.safeTransferFrom(msg.sender, address(this), price);

        uint256 entryId = entryCount;
        bytes32 picksHash = keccak256(abi.encodePacked(picks));

        entries[entryId] = Entry({
            owner: msg.sender,
            picksHash: picksHash,
            tiebreaker: tiebreaker,
            pricePaid: price
        });

        _userEntryIds[msg.sender].push(entryId);
        totalPoolValue += price;
        entryCount++;

        emit EntrySubmitted(entryId, msg.sender, picks, tiebreaker, price);
    }

    // --- Cancel ---

    function cancelPool() external {
        require(msg.sender == admin, "Not authorized");
        require(merkleRoot == bytes32(0), "Already finalized");
        cancelled = true;
        emit PoolCancelled();
    }
}
