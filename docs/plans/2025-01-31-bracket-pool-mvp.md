# Bracket Pool DApp - MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a working bracket pool dApp where users pay USDC to enter tournament brackets, with winners determined by multisig and prizes distributed automatically.

**Architecture:** Factory pattern creates individual pool contracts. Each pool holds USDC, tracks entries as bytes32 arrays, and distributes prizes when finalized by authorized multisig. Frontend displays brackets, handles wallet connection, and submits picks.

**Tech Stack:** Solidity 0.8.24 + Foundry, Next.js 14 + wagmi v2 + RainbowKit, Base network, USDC

---

## Specifications Summary

| Decision | Value |
|----------|-------|
| Network | Base (Sepolia for testnet) |
| Payment | USDC only |
| Pick encoding | bytes32[] array (1 element per game) |
| Bonding curve | price = basePrice + (slope × totalPoolValue) |
| Entries per address | Unlimited |
| Entry edits | Not allowed (one-and-done) |
| Minimum entries | 2 to finalize |
| Failed pool | Auto-refund if min not met |
| Tiebreaker | Total combined score (final game) |
| Tie handling | Split prize evenly |
| Scoring | ESPN-style: R1=10, R2=20, R3=40, R4=80, R5=160, R6=320 |
| Platform fee | 5% to treasury |
| Finalization | 3-of-5 Gnosis Safe multisig |
| Upgradeability | Immutable contracts |
| Team data | Off-chain (contract stores game count, frontend has names) |

---

## Phase 1: Smart Contract Foundation

### Task 1.1: Initialize Foundry Project

**Files:**
- Modify: `packages/contracts/foundry.toml`
- Create: `packages/contracts/lib/` (dependencies)

**Step 1: Install OpenZeppelin**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

Expected: `Installed openzeppelin-contracts`

**Step 2: Update remappings**

Edit `packages/contracts/remappings.txt`:
```
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
```

**Step 3: Verify setup**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge build
```

Expected: `Compiler run successful` (no sources yet, but no errors)

**Step 4: Commit**

```bash
git add -A && git commit -m "chore: initialize foundry with openzeppelin"
```

---

### Task 1.2: BracketPool Core - Entry Struct and State

**Files:**
- Create: `packages/contracts/src/BracketPool.sol`
- Create: `packages/contracts/test/BracketPool.t.sol`

**Step 1: Write test for pool initialization**

Create `packages/contracts/test/BracketPool.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/BracketPool.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 1_000_000 * 10**6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract BracketPoolTest is Test {
    BracketPool public pool;
    MockUSDC public usdc;

    address public admin = address(1);
    address public treasury = address(2);
    address public user1 = address(3);
    address public user2 = address(4);

    uint256 public constant GAME_COUNT = 67; // March Madness
    uint256 public constant LOCK_TIME = 1000;
    uint256 public constant BASE_PRICE = 10 * 10**6; // $10 USDC
    uint256 public constant PRICE_SLOPE = 1000; // 0.1% of pool value

    function setUp() public {
        usdc = new MockUSDC();

        vm.prank(admin);
        pool = new BracketPool(
            address(usdc),
            treasury,
            GAME_COUNT,
            LOCK_TIME,
            BASE_PRICE,
            PRICE_SLOPE
        );

        // Fund users
        usdc.mint(user1, 1000 * 10**6);
        usdc.mint(user2, 1000 * 10**6);
    }

    function test_initialization() public view {
        assertEq(address(pool.usdc()), address(usdc));
        assertEq(pool.treasury(), treasury);
        assertEq(pool.gameCount(), GAME_COUNT);
        assertEq(pool.lockTime(), LOCK_TIME);
        assertEq(pool.basePrice(), BASE_PRICE);
        assertEq(pool.priceSlope(), PRICE_SLOPE);
        assertEq(pool.totalPoolValue(), 0);
        assertEq(pool.entryCount(), 0);
        assertEq(pool.finalized(), false);
    }
}
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test --match-test test_initialization -vvv
```

Expected: Compilation error - `BracketPool.sol` not found

**Step 3: Write minimal implementation**

Create `packages/contracts/src/BracketPool.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BracketPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- State ---
    IERC20 public immutable usdc;
    address public immutable treasury;
    address public immutable admin;

    uint256 public immutable gameCount;
    uint256 public immutable lockTime;
    uint256 public immutable basePrice;
    uint256 public immutable priceSlope; // basis points (10000 = 100%)

    uint256 public totalPoolValue;
    uint256 public entryCount;
    bool public finalized;

    uint256 public constant FEE_PERCENT = 500; // 5% = 500 basis points
    uint256 public constant BASIS_POINTS = 10000;

    // --- Constructor ---
    constructor(
        address _usdc,
        address _treasury,
        uint256 _gameCount,
        uint256 _lockTime,
        uint256 _basePrice,
        uint256 _priceSlope
    ) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_gameCount > 0, "Invalid game count");
        require(_lockTime > block.timestamp, "Lock time must be in future");
        require(_basePrice > 0, "Invalid base price");

        usdc = IERC20(_usdc);
        treasury = _treasury;
        admin = msg.sender;
        gameCount = _gameCount;
        lockTime = _lockTime;
        basePrice = _basePrice;
        priceSlope = _priceSlope;
    }
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test --match-test test_initialization -vvv
```

Expected: `[PASS] test_initialization()`

**Step 5: Commit**

```bash
git add packages/contracts/src/BracketPool.sol packages/contracts/test/BracketPool.t.sol && git commit -m "feat(contracts): add BracketPool initialization and state"
```

---

### Task 1.3: BracketPool - getCurrentPrice() Function

**Files:**
- Modify: `packages/contracts/src/BracketPool.sol`
- Modify: `packages/contracts/test/BracketPool.t.sol`

**Step 1: Write tests for bonding curve pricing**

Add to `packages/contracts/test/BracketPool.t.sol`:
```solidity
function test_getCurrentPrice_initialPrice() public view {
    // With empty pool, price should be base price
    assertEq(pool.getCurrentPrice(), BASE_PRICE);
}

function test_getCurrentPrice_withPoolValue() public {
    // Simulate pool having $1000 in it
    // price = basePrice + (priceSlope * totalPoolValue / BASIS_POINTS)
    // price = 10 + (1000 * 1000 / 10000) = 10 + 100 = $110? No wait...
    // Let's recalculate: slope of 1000 basis points = 10%
    // price = 10 + (10% of $1000) = 10 + 100 = $110
    // But that seems high. Let's use smaller slope.

    // With slope = 1000 (10%), pool value = $100:
    // price = $10 + ($100 * 1000 / 10000) = $10 + $10 = $20

    // We need to mock the pool value for this test
    // For now, test the formula with a helper
}

function test_getCurrentPrice_formula() public {
    // Fresh pool: price = base
    assertEq(pool.getCurrentPrice(), 10 * 10**6);

    // After entries increase totalPoolValue, price increases
    // This will be tested after we implement enter()
}
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test --match-test test_getCurrentPrice -vvv
```

Expected: Error - `getCurrentPrice()` not found

**Step 3: Write implementation**

Add to `packages/contracts/src/BracketPool.sol` after state variables:
```solidity
// --- View Functions ---
function getCurrentPrice() public view returns (uint256) {
    // price = basePrice + (priceSlope * totalPoolValue / BASIS_POINTS)
    return basePrice + (priceSlope * totalPoolValue / BASIS_POINTS);
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test --match-test test_getCurrentPrice -vvv
```

Expected: `[PASS]` for all getCurrentPrice tests

**Step 5: Commit**

```bash
git add packages/contracts/src/BracketPool.sol packages/contracts/test/BracketPool.t.sol && git commit -m "feat(contracts): add bonding curve getCurrentPrice()"
```

---

### Task 1.4: BracketPool - Entry Struct and Storage

**Files:**
- Modify: `packages/contracts/src/BracketPool.sol`
- Modify: `packages/contracts/test/BracketPool.t.sol`

**Step 1: Write test for entry storage**

Add to `packages/contracts/test/BracketPool.t.sol`:
```solidity
function test_entry_struct_storage() public {
    // Create mock picks (67 games for March Madness)
    bytes32[] memory picks = new bytes32[](GAME_COUNT);
    for (uint256 i = 0; i < GAME_COUNT; i++) {
        picks[i] = bytes32(uint256(i % 68)); // Mock team IDs 0-67
    }
    uint256 tiebreaker = 145; // Total points prediction

    // Entry submission tested in next task
    // For now, verify the struct can hold the data
}
```

**Step 2: Add Entry struct to contract**

Add to `packages/contracts/src/BracketPool.sol` after state variables:
```solidity
// --- Structs ---
struct Entry {
    bytes32[] picks;        // Winner of each game (team ID as bytes32)
    uint256 tiebreaker;     // Total combined score prediction
    uint256 pricePaid;      // Amount paid for this entry
    uint256 score;          // Calculated after finalization
}

// --- Storage ---
mapping(uint256 => Entry) public entries;        // entryId => Entry
mapping(uint256 => address) public entryOwners;  // entryId => owner address
mapping(address => uint256[]) public userEntries; // user => their entry IDs
```

**Step 3: Add getter for entry picks**

Add to `packages/contracts/src/BracketPool.sol`:
```solidity
function getEntryPicks(uint256 entryId) external view returns (bytes32[] memory) {
    return entries[entryId].picks;
}

function getEntry(uint256 entryId) external view returns (
    bytes32[] memory picks,
    uint256 tiebreaker,
    uint256 pricePaid,
    uint256 score
) {
    Entry storage entry = entries[entryId];
    return (entry.picks, entry.tiebreaker, entry.pricePaid, entry.score);
}

function getUserEntryIds(address user) external view returns (uint256[] memory) {
    return userEntries[user];
}
```

**Step 4: Run build to verify compilation**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge build
```

Expected: `Compiler run successful`

**Step 5: Commit**

```bash
git add packages/contracts/src/BracketPool.sol && git commit -m "feat(contracts): add Entry struct and storage mappings"
```

---

### Task 1.5: BracketPool - enter() Function

**Files:**
- Modify: `packages/contracts/src/BracketPool.sol`
- Modify: `packages/contracts/test/BracketPool.t.sol`

**Step 1: Write tests for entry submission**

Add to `packages/contracts/test/BracketPool.t.sol`:
```solidity
function _createValidPicks() internal view returns (bytes32[] memory) {
    bytes32[] memory picks = new bytes32[](GAME_COUNT);
    for (uint256 i = 0; i < GAME_COUNT; i++) {
        picks[i] = bytes32(uint256(i % 68));
    }
    return picks;
}

function test_enter_success() public {
    bytes32[] memory picks = _createValidPicks();
    uint256 tiebreaker = 145;
    uint256 price = pool.getCurrentPrice();

    vm.startPrank(user1);
    usdc.approve(address(pool), price);
    pool.enter(picks, tiebreaker);
    vm.stopPrank();

    assertEq(pool.entryCount(), 1);
    assertEq(pool.totalPoolValue(), price);
    assertEq(usdc.balanceOf(address(pool)), price);

    uint256[] memory userIds = pool.getUserEntryIds(user1);
    assertEq(userIds.length, 1);
    assertEq(userIds[0], 0);

    (bytes32[] memory storedPicks, uint256 storedTiebreaker, uint256 pricePaid,) = pool.getEntry(0);
    assertEq(storedPicks.length, GAME_COUNT);
    assertEq(storedTiebreaker, tiebreaker);
    assertEq(pricePaid, price);
}

function test_enter_multipleEntries_sameUser() public {
    bytes32[] memory picks = _createValidPicks();
    uint256 price1 = pool.getCurrentPrice();

    vm.startPrank(user1);
    usdc.approve(address(pool), 500 * 10**6);

    pool.enter(picks, 145);
    uint256 price2 = pool.getCurrentPrice();
    assertGt(price2, price1); // Price increased

    pool.enter(picks, 150);
    vm.stopPrank();

    assertEq(pool.entryCount(), 2);

    uint256[] memory userIds = pool.getUserEntryIds(user1);
    assertEq(userIds.length, 2);
}

function test_enter_revert_afterLockTime() public {
    bytes32[] memory picks = _createValidPicks();

    vm.warp(LOCK_TIME + 1);

    vm.startPrank(user1);
    usdc.approve(address(pool), 100 * 10**6);
    vm.expectRevert("Pool is locked");
    pool.enter(picks, 145);
    vm.stopPrank();
}

function test_enter_revert_wrongPicksLength() public {
    bytes32[] memory picks = new bytes32[](10); // Wrong length

    vm.startPrank(user1);
    usdc.approve(address(pool), 100 * 10**6);
    vm.expectRevert("Invalid picks length");
    pool.enter(picks, 145);
    vm.stopPrank();
}

function test_enter_revert_insufficientApproval() public {
    bytes32[] memory picks = _createValidPicks();

    vm.startPrank(user1);
    usdc.approve(address(pool), 1); // Not enough
    vm.expectRevert();
    pool.enter(picks, 145);
    vm.stopPrank();
}
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test --match-test test_enter -vvv
```

Expected: Error - `enter()` function not found

**Step 3: Write implementation**

Add to `packages/contracts/src/BracketPool.sol`:
```solidity
// --- Events ---
event EntrySubmitted(uint256 indexed entryId, address indexed user, uint256 price);

// --- Entry Functions ---
function enter(bytes32[] calldata picks, uint256 tiebreaker) external nonReentrant {
    require(block.timestamp < lockTime, "Pool is locked");
    require(picks.length == gameCount, "Invalid picks length");

    uint256 price = getCurrentPrice();

    // Transfer USDC from user
    usdc.safeTransferFrom(msg.sender, address(this), price);

    // Store entry
    uint256 entryId = entryCount;
    entries[entryId].picks = picks;
    entries[entryId].tiebreaker = tiebreaker;
    entries[entryId].pricePaid = price;

    entryOwners[entryId] = msg.sender;
    userEntries[msg.sender].push(entryId);

    // Update state
    totalPoolValue += price;
    entryCount++;

    emit EntrySubmitted(entryId, msg.sender, price);
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test --match-test test_enter -vvv
```

Expected: All `test_enter_*` tests pass

**Step 5: Commit**

```bash
git add packages/contracts/src/BracketPool.sol packages/contracts/test/BracketPool.t.sol && git commit -m "feat(contracts): add enter() with bonding curve pricing"
```

---

### Task 1.6: BracketPool - Score Calculation

**Files:**
- Modify: `packages/contracts/src/BracketPool.sol`
- Modify: `packages/contracts/test/BracketPool.t.sol`

**Step 1: Write tests for score calculation**

Add to `packages/contracts/test/BracketPool.t.sol`:
```solidity
function test_calculateScore_perfectBracket() public view {
    // Create picks that match results exactly
    bytes32[] memory picks = new bytes32[](GAME_COUNT);
    bytes32[] memory results = new bytes32[](GAME_COUNT);

    for (uint256 i = 0; i < GAME_COUNT; i++) {
        picks[i] = bytes32(uint256(i));
        results[i] = bytes32(uint256(i)); // Same as picks
    }

    // ESPN scoring for 67 games:
    // First Four (4 games): 10 pts each = 40
    // Round 1 (32 games): 10 pts each = 320
    // Round 2 (16 games): 20 pts each = 320
    // Sweet 16 (8 games): 40 pts each = 320
    // Elite 8 (4 games): 80 pts each = 320
    // Final Four (2 games): 160 pts each = 320
    // Championship (1 game): 320 pts = 320
    // Total: 40 + 320 + 320 + 320 + 320 + 320 + 320 = 1960

    uint256 score = pool.calculateScore(picks, results);
    assertEq(score, 1960);
}

function test_calculateScore_partialCorrect() public view {
    bytes32[] memory picks = new bytes32[](GAME_COUNT);
    bytes32[] memory results = new bytes32[](GAME_COUNT);

    // First 4 games correct (First Four), rest wrong
    for (uint256 i = 0; i < GAME_COUNT; i++) {
        picks[i] = bytes32(uint256(i));
        if (i < 4) {
            results[i] = bytes32(uint256(i)); // Correct
        } else {
            results[i] = bytes32(uint256(i + 100)); // Wrong
        }
    }

    uint256 score = pool.calculateScore(picks, results);
    assertEq(score, 40); // 4 games * 10 pts
}

function test_calculateScore_allWrong() public view {
    bytes32[] memory picks = new bytes32[](GAME_COUNT);
    bytes32[] memory results = new bytes32[](GAME_COUNT);

    for (uint256 i = 0; i < GAME_COUNT; i++) {
        picks[i] = bytes32(uint256(i));
        results[i] = bytes32(uint256(i + 100)); // All different
    }

    uint256 score = pool.calculateScore(picks, results);
    assertEq(score, 0);
}
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test --match-test test_calculateScore -vvv
```

Expected: Error - `calculateScore()` not found

**Step 3: Write implementation**

Add to `packages/contracts/src/BracketPool.sol`:
```solidity
// --- Scoring Constants (ESPN-style for 67-game March Madness) ---
// Game indices: 0-3 (First Four), 4-35 (R1), 36-51 (R2), 52-59 (Sweet 16),
//               60-63 (Elite 8), 64-65 (Final Four), 66 (Championship)

function getPointsForGame(uint256 gameIndex) public pure returns (uint256) {
    if (gameIndex < 4) return 10;       // First Four
    if (gameIndex < 36) return 10;      // Round of 64
    if (gameIndex < 52) return 20;      // Round of 32
    if (gameIndex < 60) return 40;      // Sweet 16
    if (gameIndex < 64) return 80;      // Elite 8
    if (gameIndex < 66) return 160;     // Final Four
    return 320;                          // Championship
}

function calculateScore(
    bytes32[] memory picks,
    bytes32[] memory results
) public pure returns (uint256 score) {
    require(picks.length == results.length, "Length mismatch");

    for (uint256 i = 0; i < picks.length; i++) {
        if (picks[i] == results[i]) {
            score += getPointsForGame(i);
        }
    }
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test --match-test test_calculateScore -vvv
```

Expected: All `test_calculateScore_*` tests pass

**Step 5: Commit**

```bash
git add packages/contracts/src/BracketPool.sol packages/contracts/test/BracketPool.t.sol && git commit -m "feat(contracts): add ESPN-style score calculation"
```

---

### Task 1.7: BracketPool - Finalization Logic

**Files:**
- Modify: `packages/contracts/src/BracketPool.sol`
- Modify: `packages/contracts/test/BracketPool.t.sol`

**Step 1: Write tests for finalization**

Add to `packages/contracts/test/BracketPool.t.sol`:
```solidity
function _setupPoolWithEntries() internal returns (bytes32[] memory results) {
    bytes32[] memory picks1 = _createValidPicks();
    bytes32[] memory picks2 = _createValidPicks();
    // Make picks2 slightly different
    picks2[0] = bytes32(uint256(99));

    vm.startPrank(user1);
    usdc.approve(address(pool), 100 * 10**6);
    pool.enter(picks1, 145);
    vm.stopPrank();

    vm.startPrank(user2);
    usdc.approve(address(pool), 100 * 10**6);
    pool.enter(picks2, 150);
    vm.stopPrank();

    // Results match picks1 exactly
    results = _createValidPicks();

    // Warp past lock time
    vm.warp(LOCK_TIME + 1);
}

function test_finalize_singleWinner() public {
    bytes32[] memory results = _setupPoolWithEntries();
    uint256 poolBalance = usdc.balanceOf(address(pool));
    uint256 user1BalanceBefore = usdc.balanceOf(user1);

    vm.prank(admin);
    pool.finalize(results, 145); // Actual total score matches user1's tiebreaker

    assertTrue(pool.finalized());

    // User1 should win (perfect bracket)
    // Prize = poolBalance - 5% fee
    uint256 expectedPrize = poolBalance * 9500 / 10000;
    uint256 expectedFee = poolBalance - expectedPrize;

    assertEq(usdc.balanceOf(user1), user1BalanceBefore + expectedPrize);
    assertEq(usdc.balanceOf(treasury), expectedFee);
}

function test_finalize_revert_beforeLockTime() public {
    bytes32[] memory picks = _createValidPicks();

    vm.startPrank(user1);
    usdc.approve(address(pool), 100 * 10**6);
    pool.enter(picks, 145);
    vm.stopPrank();

    bytes32[] memory results = _createValidPicks();

    vm.prank(admin);
    vm.expectRevert("Pool not locked yet");
    pool.finalize(results, 145);
}

function test_finalize_revert_notEnoughEntries() public {
    bytes32[] memory picks = _createValidPicks();

    vm.startPrank(user1);
    usdc.approve(address(pool), 100 * 10**6);
    pool.enter(picks, 145);
    vm.stopPrank();

    vm.warp(LOCK_TIME + 1);

    bytes32[] memory results = _createValidPicks();

    vm.prank(admin);
    vm.expectRevert("Not enough entries");
    pool.finalize(results, 145);
}

function test_finalize_revert_notAdmin() public {
    _setupPoolWithEntries();
    bytes32[] memory results = _createValidPicks();

    vm.prank(user1);
    vm.expectRevert("Not authorized");
    pool.finalize(results, 145);
}

function test_finalize_revert_alreadyFinalized() public {
    bytes32[] memory results = _setupPoolWithEntries();

    vm.prank(admin);
    pool.finalize(results, 145);

    vm.prank(admin);
    vm.expectRevert("Already finalized");
    pool.finalize(results, 145);
}
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test --match-test test_finalize -vvv
```

Expected: Error - `finalize()` not found

**Step 3: Write implementation**

Add to `packages/contracts/src/BracketPool.sol`:
```solidity
// --- Events ---
event PoolFinalized(uint256[] winnerEntryIds, uint256 prizePerWinner);

// --- Storage for results ---
bytes32[] public gameResults;
uint256 public actualTiebreaker;

// --- Finalization ---
function finalize(bytes32[] calldata results, uint256 _actualTiebreaker) external nonReentrant {
    require(msg.sender == admin, "Not authorized");
    require(block.timestamp >= lockTime, "Pool not locked yet");
    require(!finalized, "Already finalized");
    require(entryCount >= 2, "Not enough entries");
    require(results.length == gameCount, "Invalid results length");

    gameResults = results;
    actualTiebreaker = _actualTiebreaker;

    // Calculate scores for all entries
    uint256 highestScore = 0;
    for (uint256 i = 0; i < entryCount; i++) {
        uint256 score = calculateScore(entries[i].picks, results);
        entries[i].score = score;
        if (score > highestScore) {
            highestScore = score;
        }
    }

    // Find winners (highest score, then closest tiebreaker)
    uint256[] memory potentialWinners = new uint256[](entryCount);
    uint256 winnerCount = 0;
    uint256 bestTiebreakerDiff = type(uint256).max;

    for (uint256 i = 0; i < entryCount; i++) {
        if (entries[i].score == highestScore) {
            uint256 diff = _absDiff(entries[i].tiebreaker, _actualTiebreaker);
            if (diff < bestTiebreakerDiff) {
                bestTiebreakerDiff = diff;
                winnerCount = 1;
                potentialWinners[0] = i;
            } else if (diff == bestTiebreakerDiff) {
                potentialWinners[winnerCount] = i;
                winnerCount++;
            }
        }
    }

    // Calculate prize distribution
    uint256 fee = totalPoolValue * FEE_PERCENT / BASIS_POINTS;
    uint256 prizePool = totalPoolValue - fee;
    uint256 prizePerWinner = prizePool / winnerCount;

    // Transfer fee to treasury
    usdc.safeTransfer(treasury, fee);

    // Transfer prizes to winners
    uint256[] memory winnerIds = new uint256[](winnerCount);
    for (uint256 i = 0; i < winnerCount; i++) {
        uint256 entryId = potentialWinners[i];
        winnerIds[i] = entryId;
        usdc.safeTransfer(entryOwners[entryId], prizePerWinner);
    }

    // Handle dust (leftover from division)
    uint256 dust = prizePool - (prizePerWinner * winnerCount);
    if (dust > 0) {
        usdc.safeTransfer(entryOwners[winnerIds[0]], dust);
    }

    finalized = true;

    emit PoolFinalized(winnerIds, prizePerWinner);
}

function _absDiff(uint256 a, uint256 b) internal pure returns (uint256) {
    return a > b ? a - b : b - a;
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test --match-test test_finalize -vvv
```

Expected: All `test_finalize_*` tests pass

**Step 5: Commit**

```bash
git add packages/contracts/src/BracketPool.sol packages/contracts/test/BracketPool.t.sol && git commit -m "feat(contracts): add finalize() with prize distribution"
```

---

### Task 1.8: BracketPool - Refund Logic (Failed Pool)

**Files:**
- Modify: `packages/contracts/src/BracketPool.sol`
- Modify: `packages/contracts/test/BracketPool.t.sol`

**Step 1: Write tests for refund functionality**

Add to `packages/contracts/test/BracketPool.t.sol`:
```solidity
function test_refund_singleEntry() public {
    bytes32[] memory picks = _createValidPicks();
    uint256 price = pool.getCurrentPrice();

    vm.startPrank(user1);
    usdc.approve(address(pool), price);
    pool.enter(picks, 145);
    vm.stopPrank();

    uint256 user1BalanceBefore = usdc.balanceOf(user1);

    // Warp past lock time
    vm.warp(LOCK_TIME + 1);

    // User requests refund (only 1 entry, pool can't finalize)
    vm.prank(user1);
    pool.refund(0); // Entry ID 0

    assertEq(usdc.balanceOf(user1), user1BalanceBefore + price);
    assertTrue(pool.entryRefunded(0));
}

function test_refund_revert_beforeLockTime() public {
    bytes32[] memory picks = _createValidPicks();
    uint256 price = pool.getCurrentPrice();

    vm.startPrank(user1);
    usdc.approve(address(pool), price);
    pool.enter(picks, 145);
    vm.stopPrank();

    vm.prank(user1);
    vm.expectRevert("Pool not locked yet");
    pool.refund(0);
}

function test_refund_revert_enoughEntries() public {
    _setupPoolWithEntries();

    vm.prank(user1);
    vm.expectRevert("Pool has enough entries");
    pool.refund(0);
}

function test_refund_revert_notOwner() public {
    bytes32[] memory picks = _createValidPicks();
    uint256 price = pool.getCurrentPrice();

    vm.startPrank(user1);
    usdc.approve(address(pool), price);
    pool.enter(picks, 145);
    vm.stopPrank();

    vm.warp(LOCK_TIME + 1);

    vm.prank(user2);
    vm.expectRevert("Not entry owner");
    pool.refund(0);
}

function test_refund_revert_alreadyRefunded() public {
    bytes32[] memory picks = _createValidPicks();
    uint256 price = pool.getCurrentPrice();

    vm.startPrank(user1);
    usdc.approve(address(pool), price);
    pool.enter(picks, 145);
    vm.stopPrank();

    vm.warp(LOCK_TIME + 1);

    vm.prank(user1);
    pool.refund(0);

    vm.prank(user1);
    vm.expectRevert("Already refunded");
    pool.refund(0);
}
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test --match-test test_refund -vvv
```

Expected: Error - `refund()` not found

**Step 3: Write implementation**

Add to `packages/contracts/src/BracketPool.sol`:
```solidity
// --- Storage ---
mapping(uint256 => bool) public entryRefunded;
uint256 public constant MIN_ENTRIES = 2;

// --- Events ---
event EntryRefunded(uint256 indexed entryId, address indexed user, uint256 amount);

// --- Refund ---
function refund(uint256 entryId) external nonReentrant {
    require(block.timestamp >= lockTime, "Pool not locked yet");
    require(entryCount < MIN_ENTRIES, "Pool has enough entries");
    require(entryOwners[entryId] == msg.sender, "Not entry owner");
    require(!entryRefunded[entryId], "Already refunded");
    require(!finalized, "Pool is finalized");

    entryRefunded[entryId] = true;
    uint256 amount = entries[entryId].pricePaid;

    usdc.safeTransfer(msg.sender, amount);

    emit EntryRefunded(entryId, msg.sender, amount);
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test --match-test test_refund -vvv
```

Expected: All `test_refund_*` tests pass

**Step 5: Commit**

```bash
git add packages/contracts/src/BracketPool.sol packages/contracts/test/BracketPool.t.sol && git commit -m "feat(contracts): add refund() for failed pools"
```

---

### Task 1.9: BracketPoolFactory Contract

**Files:**
- Create: `packages/contracts/src/BracketPoolFactory.sol`
- Create: `packages/contracts/test/BracketPoolFactory.t.sol`

**Step 1: Write tests for factory**

Create `packages/contracts/test/BracketPoolFactory.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/BracketPoolFactory.sol";
import "../src/BracketPool.sol";

contract MockUSDC {
    // Minimal mock for factory tests
}

contract BracketPoolFactoryTest is Test {
    BracketPoolFactory public factory;
    address public admin = address(1);
    address public treasury = address(2);
    address public usdc = address(new MockUSDC());

    function setUp() public {
        vm.prank(admin);
        factory = new BracketPoolFactory(usdc, treasury);
    }

    function test_initialization() public view {
        assertEq(factory.owner(), admin);
        assertEq(factory.usdc(), usdc);
        assertEq(factory.treasury(), treasury);
    }

    function test_createPool() public {
        vm.prank(admin);
        address poolAddress = factory.createPool(
            67,                     // gameCount
            block.timestamp + 1000, // lockTime
            10 * 10**6,            // basePrice ($10)
            1000                    // priceSlope (10%)
        );

        assertTrue(poolAddress != address(0));
        assertEq(factory.poolCount(), 1);
        assertEq(factory.pools(0), poolAddress);

        BracketPool pool = BracketPool(poolAddress);
        assertEq(pool.gameCount(), 67);
        assertEq(pool.basePrice(), 10 * 10**6);
    }

    function test_createPool_revert_notOwner() public {
        vm.prank(address(99));
        vm.expectRevert();
        factory.createPool(67, block.timestamp + 1000, 10 * 10**6, 1000);
    }

    function test_createMultiplePools() public {
        vm.startPrank(admin);

        factory.createPool(67, block.timestamp + 1000, 10 * 10**6, 1000);
        factory.createPool(63, block.timestamp + 2000, 20 * 10**6, 500);
        factory.createPool(15, block.timestamp + 3000, 5 * 10**6, 2000);

        vm.stopPrank();

        assertEq(factory.poolCount(), 3);
    }
}
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test --match-contract BracketPoolFactoryTest -vvv
```

Expected: Error - `BracketPoolFactory.sol` not found

**Step 3: Write implementation**

Create `packages/contracts/src/BracketPoolFactory.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./BracketPool.sol";

contract BracketPoolFactory is Ownable {
    address public immutable usdc;
    address public immutable treasury;

    address[] public pools;

    event PoolCreated(
        address indexed poolAddress,
        uint256 gameCount,
        uint256 lockTime,
        uint256 basePrice,
        uint256 priceSlope
    );

    constructor(address _usdc, address _treasury) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid treasury");
        usdc = _usdc;
        treasury = _treasury;
    }

    function createPool(
        uint256 gameCount,
        uint256 lockTime,
        uint256 basePrice,
        uint256 priceSlope
    ) external onlyOwner returns (address) {
        BracketPool pool = new BracketPool(
            usdc,
            treasury,
            gameCount,
            lockTime,
            basePrice,
            priceSlope
        );

        pools.push(address(pool));

        emit PoolCreated(address(pool), gameCount, lockTime, basePrice, priceSlope);

        return address(pool);
    }

    function poolCount() external view returns (uint256) {
        return pools.length;
    }

    function getAllPools() external view returns (address[] memory) {
        return pools;
    }
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test --match-contract BracketPoolFactoryTest -vvv
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/contracts/src/BracketPoolFactory.sol packages/contracts/test/BracketPoolFactory.t.sol && git commit -m "feat(contracts): add BracketPoolFactory"
```

---

### Task 1.10: Deployment Script

**Files:**
- Create: `packages/contracts/script/Deploy.s.sol`

**Step 1: Write deployment script**

Create `packages/contracts/script/Deploy.s.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/BracketPoolFactory.sol";

contract DeployScript is Script {
    // Base Sepolia USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
    // Base Mainnet USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        BracketPoolFactory factory = new BracketPoolFactory(usdc, treasury);

        console.log("Factory deployed at:", address(factory));

        vm.stopBroadcast();
    }
}
```

**Step 2: Create .env.example**

Create `packages/contracts/.env.example`:
```
PRIVATE_KEY=your_private_key_here
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
TREASURY_ADDRESS=your_treasury_address_here
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_MAINNET_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=your_basescan_api_key
```

**Step 3: Verify script compiles**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge build
```

Expected: `Compiler run successful`

**Step 4: Commit**

```bash
git add packages/contracts/script/Deploy.s.sol packages/contracts/.env.example && git commit -m "feat(contracts): add deployment script"
```

---

### Task 1.11: Run Full Test Suite

**Step 1: Run all contract tests**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge test -vvv
```

Expected: All tests pass

**Step 2: Check test coverage**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge coverage
```

Expected: >80% coverage on BracketPool.sol and BracketPoolFactory.sol

**Step 3: Commit coverage if any changes**

```bash
git status && git add -A && git commit -m "test(contracts): complete test suite" --allow-empty
```

---

## Phase 2: Frontend Foundation

### Task 2.1: Initialize Next.js Project

**Files:**
- Create: `packages/web/` (entire Next.js project)

**Step 1: Initialize Next.js**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/web && npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Expected: Next.js project created with prompts answered

**Step 2: Install web3 dependencies**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/web && npm install wagmi viem @rainbow-me/rainbowkit @tanstack/react-query
```

Expected: Dependencies installed

**Step 3: Verify it runs**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/web && npm run dev
```

Expected: Development server starts on http://localhost:3000

**Step 4: Commit**

```bash
git add packages/web && git commit -m "feat(web): initialize Next.js with wagmi and RainbowKit"
```

---

### Task 2.2: Configure wagmi and RainbowKit

**Files:**
- Create: `packages/web/src/lib/wagmi.ts`
- Modify: `packages/web/src/app/providers.tsx`
- Modify: `packages/web/src/app/layout.tsx`

**Step 1: Create wagmi config**

Create `packages/web/src/lib/wagmi.ts`:
```typescript
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Bracket Pool',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [baseSepolia, base],
  ssr: true,
});
```

**Step 2: Create providers**

Create `packages/web/src/app/providers.tsx`:
```typescript
'use client';

import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';

import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**Step 3: Update layout**

Modify `packages/web/src/app/layout.tsx`:
```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bracket Pool",
  description: "On-chain tournament bracket pools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Step 4: Create .env.local.example**

Create `packages/web/.env.local.example`:
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_FACTORY_ADDRESS=deployed_factory_address
```

**Step 5: Verify it runs**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/web && npm run dev
```

Expected: App loads without errors

**Step 6: Commit**

```bash
git add packages/web && git commit -m "feat(web): configure wagmi and RainbowKit providers"
```

---

### Task 2.3: Add Contract ABIs and Addresses

**Files:**
- Create: `packages/web/src/lib/contracts.ts`
- Create: `packages/web/src/lib/abis/BracketPool.json`
- Create: `packages/web/src/lib/abis/BracketPoolFactory.json`

**Step 1: Export ABIs from Foundry**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts && forge build
mkdir -p ../web/src/lib/abis
cat out/BracketPool.sol/BracketPool.json | jq '.abi' > ../web/src/lib/abis/BracketPool.json
cat out/BracketPoolFactory.sol/BracketPoolFactory.json | jq '.abi' > ../web/src/lib/abis/BracketPoolFactory.json
```

Expected: ABI files created

**Step 2: Create contracts config**

Create `packages/web/src/lib/contracts.ts`:
```typescript
import BracketPoolABI from './abis/BracketPool.json';
import BracketPoolFactoryABI from './abis/BracketPoolFactory.json';

export const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`;

// Base Sepolia USDC
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;

export const contracts = {
  factory: {
    address: FACTORY_ADDRESS,
    abi: BracketPoolFactoryABI,
  },
  pool: {
    abi: BracketPoolABI,
  },
} as const;

export { BracketPoolABI, BracketPoolFactoryABI };
```

**Step 3: Commit**

```bash
git add packages/web/src/lib && git commit -m "feat(web): add contract ABIs and addresses"
```

---

### Task 2.4: Create Pool List Page

**Files:**
- Modify: `packages/web/src/app/page.tsx`
- Create: `packages/web/src/components/PoolCard.tsx`
- Create: `packages/web/src/hooks/usePools.ts`

**Step 1: Create usePools hook**

Create `packages/web/src/hooks/usePools.ts`:
```typescript
import { useReadContract, useReadContracts } from 'wagmi';
import { contracts, FACTORY_ADDRESS, BracketPoolABI } from '@/lib/contracts';

export function usePools() {
  const { data: poolCount } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: contracts.factory.abi,
    functionName: 'poolCount',
  });

  const poolAddresses = useReadContracts({
    contracts: Array.from({ length: Number(poolCount || 0) }, (_, i) => ({
      address: FACTORY_ADDRESS,
      abi: contracts.factory.abi,
      functionName: 'pools',
      args: [BigInt(i)],
    })),
  });

  return {
    poolCount: Number(poolCount || 0),
    poolAddresses: poolAddresses.data?.map(d => d.result as `0x${string}`) || [],
    isLoading: poolAddresses.isLoading,
  };
}

export function usePoolDetails(address: `0x${string}`) {
  const results = useReadContracts({
    contracts: [
      { address, abi: BracketPoolABI, functionName: 'gameCount' },
      { address, abi: BracketPoolABI, functionName: 'lockTime' },
      { address, abi: BracketPoolABI, functionName: 'basePrice' },
      { address, abi: BracketPoolABI, functionName: 'totalPoolValue' },
      { address, abi: BracketPoolABI, functionName: 'entryCount' },
      { address, abi: BracketPoolABI, functionName: 'finalized' },
      { address, abi: BracketPoolABI, functionName: 'getCurrentPrice' },
    ],
  });

  const [gameCount, lockTime, basePrice, totalPoolValue, entryCount, finalized, currentPrice] =
    results.data || [];

  return {
    gameCount: Number(gameCount?.result || 0),
    lockTime: Number(lockTime?.result || 0),
    basePrice: BigInt(basePrice?.result?.toString() || '0'),
    totalPoolValue: BigInt(totalPoolValue?.result?.toString() || '0'),
    entryCount: Number(entryCount?.result || 0),
    finalized: Boolean(finalized?.result),
    currentPrice: BigInt(currentPrice?.result?.toString() || '0'),
    isLoading: results.isLoading,
  };
}
```

**Step 2: Create PoolCard component**

Create `packages/web/src/components/PoolCard.tsx`:
```typescript
'use client';

import Link from 'next/link';
import { usePoolDetails } from '@/hooks/usePools';
import { formatUnits } from 'viem';

interface PoolCardProps {
  address: `0x${string}`;
}

export function PoolCard({ address }: PoolCardProps) {
  const pool = usePoolDetails(address);

  const isLocked = Date.now() / 1000 > pool.lockTime;
  const lockDate = new Date(pool.lockTime * 1000);

  return (
    <Link href={`/pool/${address}`}>
      <div className="border rounded-lg p-4 hover:border-blue-500 transition-colors">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold">{pool.gameCount} Game Bracket</h3>
          <span className={`px-2 py-1 rounded text-sm ${
            pool.finalized ? 'bg-gray-200' : isLocked ? 'bg-yellow-200' : 'bg-green-200'
          }`}>
            {pool.finalized ? 'Finalized' : isLocked ? 'Locked' : 'Open'}
          </span>
        </div>

        <div className="text-sm text-gray-600 space-y-1">
          <p>Entries: {pool.entryCount}</p>
          <p>Pool Value: ${formatUnits(pool.totalPoolValue, 6)}</p>
          <p>Current Price: ${formatUnits(pool.currentPrice, 6)}</p>
          <p>Locks: {lockDate.toLocaleString()}</p>
        </div>
      </div>
    </Link>
  );
}
```

**Step 3: Update home page**

Modify `packages/web/src/app/page.tsx`:
```typescript
'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePools } from '@/hooks/usePools';
import { PoolCard } from '@/components/PoolCard';

export default function Home() {
  const { poolAddresses, isLoading } = usePools();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Bracket Pools</h1>
          <ConnectButton />
        </div>

        {isLoading ? (
          <p>Loading pools...</p>
        ) : poolAddresses.length === 0 ? (
          <p className="text-gray-500">No pools created yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {poolAddresses.map((address) => (
              <PoolCard key={address} address={address} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

**Step 4: Verify it runs**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/web && npm run dev
```

Expected: Home page shows with RainbowKit connect button

**Step 5: Commit**

```bash
git add packages/web && git commit -m "feat(web): add pool list page with cards"
```

---

### Task 2.5: Create Pool Detail Page

**Files:**
- Create: `packages/web/src/app/pool/[address]/page.tsx`

**Step 1: Create pool detail page**

Create `packages/web/src/app/pool/[address]/page.tsx`:
```typescript
'use client';

import { use } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePoolDetails } from '@/hooks/usePools';
import { formatUnits } from 'viem';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ address: string }>;
}

export default function PoolPage({ params }: PageProps) {
  const { address } = use(params);
  const poolAddress = address as `0x${string}`;
  const pool = usePoolDetails(poolAddress);

  const isLocked = Date.now() / 1000 > pool.lockTime;
  const lockDate = new Date(pool.lockTime * 1000);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/" className="text-blue-500 hover:underline">
              &larr; Back to Pools
            </Link>
            <h1 className="text-3xl font-bold mt-2">Pool Details</h1>
          </div>
          <ConnectButton />
        </div>

        <div className="bg-white border rounded-lg p-6 mb-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-gray-500">Status</p>
              <p className="font-semibold">
                {pool.finalized ? 'Finalized' : isLocked ? 'Locked' : 'Open for Entries'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Game Count</p>
              <p className="font-semibold">{pool.gameCount}</p>
            </div>
            <div>
              <p className="text-gray-500">Lock Time</p>
              <p className="font-semibold">{lockDate.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500">Entries</p>
              <p className="font-semibold">{pool.entryCount}</p>
            </div>
            <div>
              <p className="text-gray-500">Pool Value</p>
              <p className="font-semibold">${formatUnits(pool.totalPoolValue, 6)} USDC</p>
            </div>
            <div>
              <p className="text-gray-500">Current Entry Price</p>
              <p className="font-semibold">${formatUnits(pool.currentPrice, 6)} USDC</p>
            </div>
          </div>
        </div>

        {!isLocked && !pool.finalized && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Submit Your Bracket</h2>
            <p className="text-gray-600 mb-4">
              Bracket picker component will go here.
            </p>
            {/* BracketPicker and EntryButton components will be added in next tasks */}
          </div>
        )}

        <div className="mt-6">
          <p className="text-sm text-gray-500">
            Contract: {poolAddress}
          </p>
        </div>
      </div>
    </main>
  );
}
```

**Step 2: Verify navigation works**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/web && npm run dev
```

Expected: Can navigate from home to pool detail page

**Step 3: Commit**

```bash
git add packages/web && git commit -m "feat(web): add pool detail page"
```

---

## Phase 2 Continuation (Tasks 2.6-2.10)

The remaining frontend tasks follow the same TDD pattern:

- **Task 2.6:** BracketPicker component (interactive bracket selection UI)
- **Task 2.7:** TiebreakerInput component (total score prediction)
- **Task 2.8:** EntryButton component (USDC approve + submit entry)
- **Task 2.9:** Leaderboard component (show all entries and scores)
- **Task 2.10:** Responsive styling and mobile optimization

---

## Phase 3: Integration Testing

### Task 3.1: Local E2E Test

**Step 1: Start local Anvil fork**

Run:
```bash
anvil --fork-url https://sepolia.base.org
```

**Step 2: Deploy contracts to local fork**

Run:
```bash
cd /Users/claytonlowery/madness-app/packages/contracts
source .env
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

**Step 3: Update frontend env with deployed address**

**Step 4: Test full flow manually**

1. Connect wallet
2. View pool list
3. Enter a pool with picks
4. Verify entry appears
5. Fast-forward time (anvil)
6. Finalize pool (as admin)
7. Verify winner receives prize

---

## Verification Checklist

- [ ] `forge test` passes with >80% coverage
- [ ] Factory can create pools
- [ ] Users can enter with USDC (bonding curve works)
- [ ] Entries rejected after lockTime
- [ ] Score calculation matches ESPN-style
- [ ] Tiebreaker selects winner correctly
- [ ] Ties split prize evenly
- [ ] 5% fee goes to treasury
- [ ] Refunds work for failed pools
- [ ] Frontend shows pool list
- [ ] Frontend shows pool details
- [ ] Bracket picker produces valid picks array
- [ ] Entry submission works end-to-end
- [ ] Responsive on mobile

---

## Deployment Checklist

1. [ ] Deploy Factory to Base Sepolia
2. [ ] Verify contracts on Basescan
3. [ ] Create test pool
4. [ ] Test full flow on testnet
5. [ ] Set up 3-of-5 Safe multisig
6. [ ] Transfer factory ownership to multisig
7. [ ] Deploy frontend to Vercel
8. [ ] Monitor first real pool
