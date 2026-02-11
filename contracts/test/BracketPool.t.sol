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

    // --- getCurrentPrice ---

    function test_getCurrentPrice_emptyPool() public view {
        assertEq(pool.getCurrentPrice(), BASE_PRICE);
    }

    // --- Helpers ---

    function _createPicks() internal view returns (bytes32[] memory) {
        bytes32[] memory picks = new bytes32[](GAME_COUNT);
        for (uint256 i = 0; i < GAME_COUNT; i++) {
            picks[i] = bytes32(uint256(i + 1));
        }
        return picks;
    }

    // --- enter() ---

    function test_enter_success() public {
        bytes32[] memory picks = _createPicks();
        uint256 price = pool.getCurrentPrice();

        vm.startPrank(user1);
        usdc.approve(address(pool), price);
        pool.enter(picks, 145);
        vm.stopPrank();

        assertEq(pool.entryCount(), 1);
        assertEq(pool.totalPoolValue(), price);
        assertEq(usdc.balanceOf(address(pool)), price);

        (address owner, bytes32 picksHash, uint256 tiebreaker, uint256 pricePaid) = pool.entries(0);
        assertEq(owner, user1);
        assertEq(picksHash, keccak256(abi.encodePacked(picks)));
        assertEq(tiebreaker, 145);
        assertEq(pricePaid, price);

        uint256[] memory ids = pool.getUserEntryIds(user1);
        assertEq(ids.length, 1);
        assertEq(ids[0], 0);
    }

    function test_enter_emitsEvent() public {
        bytes32[] memory picks = _createPicks();
        uint256 price = pool.getCurrentPrice();

        vm.startPrank(user1);
        usdc.approve(address(pool), price);

        vm.expectEmit(true, true, false, true);
        emit BracketPool.EntrySubmitted(0, user1, picks, 145, price);
        pool.enter(picks, 145);
        vm.stopPrank();
    }

    function test_enter_multipleEntries_priceIncreases() public {
        bytes32[] memory picks = _createPicks();
        uint256 price1 = pool.getCurrentPrice();

        vm.startPrank(user1);
        usdc.approve(address(pool), 10_000e6);
        pool.enter(picks, 145);

        uint256 price2 = pool.getCurrentPrice();
        assertGt(price2, price1);

        pool.enter(picks, 150);
        vm.stopPrank();

        assertEq(pool.entryCount(), 2);
        uint256[] memory ids = pool.getUserEntryIds(user1);
        assertEq(ids.length, 2);
    }

    function test_enter_revert_afterLock() public {
        bytes32[] memory picks = _createPicks();
        vm.warp(lockTime + 1);

        vm.startPrank(user1);
        usdc.approve(address(pool), 100e6);
        vm.expectRevert("Pool is locked");
        pool.enter(picks, 145);
        vm.stopPrank();
    }

    function test_enter_revert_cancelled() public {
        vm.prank(admin);
        pool.cancelPool();

        bytes32[] memory picks = _createPicks();
        vm.startPrank(user1);
        usdc.approve(address(pool), 100e6);
        vm.expectRevert("Pool is cancelled");
        pool.enter(picks, 145);
        vm.stopPrank();
    }

    function test_enter_revert_wrongPicksLength() public {
        bytes32[] memory picks = new bytes32[](10);

        vm.startPrank(user1);
        usdc.approve(address(pool), 100e6);
        vm.expectRevert("Invalid picks length");
        pool.enter(picks, 145);
        vm.stopPrank();
    }

    function test_enter_revert_insufficientApproval() public {
        bytes32[] memory picks = _createPicks();

        vm.startPrank(user1);
        usdc.approve(address(pool), 1);
        vm.expectRevert();
        pool.enter(picks, 145);
        vm.stopPrank();
    }

    function test_getCurrentPrice_afterEntry() public {
        bytes32[] memory picks = _createPicks();

        vm.startPrank(user1);
        usdc.approve(address(pool), 1000e6);
        pool.enter(picks, 145);
        vm.stopPrank();

        // price = basePrice + (priceSlope * totalPoolValue / BASIS_POINTS)
        // price = 10e6 + (100 * 10e6 / 10000) = 10e6 + 100000 = 10_100_000
        assertEq(pool.getCurrentPrice(), 10_100_000);
    }

    // --- setResults() ---

    function test_setResults_success() public {
        bytes32[] memory results = _createPicks();
        vm.warp(lockTime + 1);

        vm.prank(admin);
        pool.setResults(results);

        bytes32[] memory stored = pool.getGameResults();
        assertEq(stored.length, GAME_COUNT);
        assertEq(stored[0], results[0]);
        assertEq(stored[66], results[66]);
    }

    function test_setResults_emitsEvent() public {
        bytes32[] memory results = _createPicks();
        vm.warp(lockTime + 1);

        vm.prank(admin);
        vm.expectEmit(false, false, false, true);
        emit BracketPool.ResultsPosted(results);
        pool.setResults(results);
    }

    function test_setResults_revert_notAdmin() public {
        bytes32[] memory results = _createPicks();
        vm.warp(lockTime + 1);

        vm.prank(user1);
        vm.expectRevert("Not authorized");
        pool.setResults(results);
    }

    function test_setResults_revert_beforeLock() public {
        bytes32[] memory results = _createPicks();

        vm.prank(admin);
        vm.expectRevert("Pool not locked yet");
        pool.setResults(results);
    }

    function test_setResults_revert_doubleSet() public {
        bytes32[] memory results = _createPicks();
        vm.warp(lockTime + 1);

        vm.prank(admin);
        pool.setResults(results);

        vm.prank(admin);
        vm.expectRevert("Results already posted");
        pool.setResults(results);
    }

    function test_setResults_revert_wrongLength() public {
        bytes32[] memory results = new bytes32[](10);
        vm.warp(lockTime + 1);

        vm.prank(admin);
        vm.expectRevert("Invalid results length");
        pool.setResults(results);
    }

    // --- setMerkleRoot() ---

    function _setupPoolForMerkleRoot() internal {
        bytes32[] memory picks = _createPicks();

        vm.startPrank(user1);
        usdc.approve(address(pool), 10_000e6);
        pool.enter(picks, 145);
        vm.stopPrank();

        vm.startPrank(user2);
        usdc.approve(address(pool), 10_000e6);
        pool.enter(picks, 150);
        vm.stopPrank();

        vm.warp(lockTime + 1);

        vm.prank(admin);
        pool.setResults(_createPicks());
    }

    function test_setMerkleRoot_success() public {
        _setupPoolForMerkleRoot();
        uint256 poolValue = pool.totalPoolValue();
        uint256 expectedFee = poolValue * 500 / 10000;

        vm.prank(admin);
        pool.setMerkleRoot(bytes32(uint256(1)));

        assertEq(pool.merkleRoot(), bytes32(uint256(1)));
        assertEq(usdc.balanceOf(treasury), expectedFee);
        assertEq(usdc.balanceOf(address(pool)), poolValue - expectedFee);
    }

    function test_setMerkleRoot_emitsEvents() public {
        _setupPoolForMerkleRoot();
        uint256 poolValue = pool.totalPoolValue();
        uint256 expectedFee = poolValue * 500 / 10000;

        vm.prank(admin);
        vm.expectEmit(false, false, false, true);
        emit BracketPool.FeePaid(treasury, expectedFee);
        vm.expectEmit(false, false, false, true);
        emit BracketPool.MerkleRootSet(bytes32(uint256(1)));
        pool.setMerkleRoot(bytes32(uint256(1)));
    }

    function test_setMerkleRoot_revert_notAdmin() public {
        _setupPoolForMerkleRoot();

        vm.prank(user1);
        vm.expectRevert("Not authorized");
        pool.setMerkleRoot(bytes32(uint256(1)));
    }

    function test_setMerkleRoot_revert_noResults() public {
        bytes32[] memory picks = _createPicks();
        vm.startPrank(user1);
        usdc.approve(address(pool), 10_000e6);
        pool.enter(picks, 145);
        vm.stopPrank();

        vm.startPrank(user2);
        usdc.approve(address(pool), 10_000e6);
        pool.enter(picks, 150);
        vm.stopPrank();

        vm.warp(lockTime + 1);

        vm.prank(admin);
        vm.expectRevert("Results not posted");
        pool.setMerkleRoot(bytes32(uint256(1)));
    }

    function test_setMerkleRoot_revert_doubleSet() public {
        _setupPoolForMerkleRoot();

        vm.prank(admin);
        pool.setMerkleRoot(bytes32(uint256(1)));

        vm.prank(admin);
        vm.expectRevert("Merkle root already set");
        pool.setMerkleRoot(bytes32(uint256(2)));
    }

    function test_setMerkleRoot_revert_zeroRoot() public {
        _setupPoolForMerkleRoot();

        vm.prank(admin);
        vm.expectRevert("Invalid root");
        pool.setMerkleRoot(bytes32(0));
    }

    function test_setMerkleRoot_revert_notEnoughEntries() public {
        bytes32[] memory picks = _createPicks();
        vm.startPrank(user1);
        usdc.approve(address(pool), 10_000e6);
        pool.enter(picks, 145);
        vm.stopPrank();

        vm.warp(lockTime + 1);

        vm.prank(admin);
        pool.setResults(_createPicks());

        vm.prank(admin);
        vm.expectRevert("Not enough entries");
        pool.setMerkleRoot(bytes32(uint256(1)));
    }

    // --- claim() ---

    function _buildMerkleTree(
        address owner1, uint256 entryId1, uint256 amount1,
        address owner2, uint256 entryId2, uint256 amount2
    ) internal pure returns (bytes32 root, bytes32[] memory proof1) {
        bytes32 leaf1 = keccak256(bytes.concat(keccak256(abi.encode(owner1, entryId1, amount1))));
        bytes32 leaf2 = keccak256(bytes.concat(keccak256(abi.encode(owner2, entryId2, amount2))));

        proof1 = new bytes32[](1);
        if (leaf1 <= leaf2) {
            root = keccak256(abi.encodePacked(leaf1, leaf2));
            proof1[0] = leaf2;
        } else {
            root = keccak256(abi.encodePacked(leaf2, leaf1));
            proof1[0] = leaf2;
        }
    }

    function test_claim_success() public {
        _setupPoolForMerkleRoot();
        uint256 poolValue = pool.totalPoolValue();
        uint256 fee = poolValue * 500 / 10000;
        uint256 prizePool = poolValue - fee;
        uint256 prize1 = prizePool / 2;
        uint256 prize2 = prizePool - prize1;

        (bytes32 root, bytes32[] memory proof) = _buildMerkleTree(user1, 0, prize1, user2, 1, prize2);

        vm.prank(admin);
        pool.setMerkleRoot(root);

        uint256 balBefore = usdc.balanceOf(user1);
        vm.prank(user1);
        pool.claim(0, prize1, proof);

        assertEq(usdc.balanceOf(user1), balBefore + prize1);
        assertTrue(pool.entryClaimed(0));
    }

    function test_claim_revert_invalidProof() public {
        _setupPoolForMerkleRoot();
        uint256 poolValue = pool.totalPoolValue();
        uint256 fee = poolValue * 500 / 10000;
        uint256 prizePool = poolValue - fee;

        (bytes32 root, ) = _buildMerkleTree(user1, 0, prizePool / 2, user2, 1, prizePool / 2);

        vm.prank(admin);
        pool.setMerkleRoot(root);

        bytes32[] memory badProof = new bytes32[](1);
        badProof[0] = bytes32(uint256(999));

        vm.prank(user1);
        vm.expectRevert("Invalid proof");
        pool.claim(0, prizePool / 2, badProof);
    }

    function test_claim_revert_doubleClaim() public {
        _setupPoolForMerkleRoot();
        uint256 poolValue = pool.totalPoolValue();
        uint256 fee = poolValue * 500 / 10000;
        uint256 prize = (poolValue - fee) / 2;

        (bytes32 root, bytes32[] memory proof) = _buildMerkleTree(user1, 0, prize, user2, 1, prize);

        vm.prank(admin);
        pool.setMerkleRoot(root);

        vm.prank(user1);
        pool.claim(0, prize, proof);

        vm.prank(user1);
        vm.expectRevert("Already claimed");
        pool.claim(0, prize, proof);
    }

    function test_claim_revert_notOwner() public {
        _setupPoolForMerkleRoot();
        uint256 poolValue = pool.totalPoolValue();
        uint256 fee = poolValue * 500 / 10000;
        uint256 prize = (poolValue - fee) / 2;

        (bytes32 root, bytes32[] memory proof) = _buildMerkleTree(user1, 0, prize, user2, 1, prize);

        vm.prank(admin);
        pool.setMerkleRoot(root);

        vm.prank(user2);
        vm.expectRevert("Not entry owner");
        pool.claim(0, prize, proof);
    }

    function test_claim_revert_noMerkleRoot() public {
        bytes32[] memory proof = new bytes32[](1);
        vm.prank(user1);
        vm.expectRevert("Not finalized");
        pool.claim(0, 100, proof);
    }

    function test_claim_revert_afterDeadline() public {
        _setupPoolForMerkleRoot();
        uint256 poolValue = pool.totalPoolValue();
        uint256 fee = poolValue * 500 / 10000;
        uint256 prize = (poolValue - fee) / 2;

        (bytes32 root, bytes32[] memory proof) = _buildMerkleTree(user1, 0, prize, user2, 1, prize);

        vm.prank(admin);
        pool.setMerkleRoot(root);

        vm.warp(pool.claimDeadline() + 1);

        vm.prank(user1);
        vm.expectRevert("Claim period ended");
        pool.claim(0, prize, proof);
    }
}
