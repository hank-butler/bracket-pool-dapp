# Bracket Pool DApp — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a March Madness bracket pool dApp where users pay USDC to submit bracket picks, an off-chain scorer determines winners via Merkle tree, and winners claim prizes on-chain.

**Architecture:** Factory pattern deploys individual BracketPool contracts. Each pool stores pick hashes on-chain (full picks emitted in events), uses a bonding curve for entry pricing, and distributes prizes via Merkle proof claims. An off-chain TypeScript scorer reads events, scores entries, builds the Merkle tree, and pins proofs to IPFS. Next.js frontend connects wallets via RainbowKit.

**Tech Stack:** Solidity 0.8.24 + Foundry, TypeScript + viem + @openzeppelin/merkle-tree + vitest, Next.js 14 + wagmi v2 + RainbowKit, Ethereum L1 (Sepolia testnet), USDC

**Source documents:**
- `docs/plans/2025-02-09-bracket-pool-mvp-updated.md` — architecture spec
- `docs/analysis.md` — issue tracker
- `docs/roadmap.md` — phased roadmap
- `docs/phase-0-decisions.md` — all 6 design decisions (final)

---

## Reference: Key Constants

These values are used throughout all phases. Refer back here when implementing.

| Constant | Value |
|----------|-------|
| `GAME_COUNT` | 67 |
| Scoring: R0 (idx 0–3) | 5 pts |
| Scoring: R1 (idx 4–35) | 10 pts |
| Scoring: R2 (idx 36–51) | 20 pts |
| Scoring: R3 (idx 52–59) | 40 pts |
| Scoring: R4 (idx 60–63) | 80 pts |
| Scoring: R5 (idx 64–65) | 160 pts |
| Scoring: R6 (idx 66) | 320 pts |
| Perfect bracket score | 1940 |
| `FEE_PERCENT` | 500 (5%) |
| `BASIS_POINTS` | 10000 |
| `MIN_ENTRIES` | 2 |
| Claim window | 90 days after `finalizeDeadline` |
| USDC Sepolia | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| USDC Mainnet | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |

---

## Phase 1: Smart Contracts (Foundry)

### Task 1.0: Project Scaffolding

**Files:**
- Replace: `bracket-pool-dapp/.gitignore`
- Create: `bracket-pool-dapp/contracts/` (Foundry project)

**Step 1: Initialize Foundry project**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp && forge init contracts --no-commit
```

Expected: `Initialized forge project`

**Step 2: Install OpenZeppelin**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

Expected: `Installed openzeppelin-contracts`

**Step 3: Create remappings.txt**

Create `contracts/remappings.txt`:
```
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
```

**Step 4: Configure foundry.toml**

Replace `contracts/foundry.toml`:
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
sepolia = "${SEPOLIA_RPC_URL}"
mainnet = "${MAINNET_RPC_URL}"

[etherscan]
sepolia = { key = "${ETHERSCAN_API_KEY}" }
mainnet = { key = "${ETHERSCAN_API_KEY}" }
```

**Step 5: Replace .gitignore**

Replace `bracket-pool-dapp/.gitignore`:
```
# Foundry
contracts/out/
contracts/cache/
contracts/broadcast/

# Node / TypeScript
node_modules/
dist/
.next/

# Env
.env
.env.local
.env.*.local

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
```

**Step 6: Delete default Foundry files**

Run:
```bash
rm /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts/src/Counter.sol /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts/test/Counter.t.sol /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts/script/Counter.s.sol
```

**Step 7: Verify build**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge build
```

Expected: `Compiler run successful` (no sources)

**Step 8: Commit**

```bash
git add -A && git commit -m "chore: scaffold Foundry project with OpenZeppelin"
```

---

### Task 1.1: MockUSDC Test Helper

**Files:**
- Create: `contracts/test/mocks/MockUSDC.sol`

**Step 1: Create MockUSDC**

Create `contracts/test/mocks/MockUSDC.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

**Step 2: Verify build**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge build
```

Expected: `Compiler run successful`

**Step 3: Commit**

```bash
git add contracts/test/mocks/MockUSDC.sol && git commit -m "test(contracts): add MockUSDC helper"
```

---

### Task 1.2: BracketPool Constructor + Initialization Tests

**Files:**
- Create: `contracts/src/BracketPool.sol`
- Create: `contracts/test/BracketPool.t.sol`

**Step 1: Write the failing tests**

Create `contracts/test/BracketPool.t.sol`:
```solidity
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
    uint256 public constant BASE_PRICE = 10e6; // $10 USDC
    uint256 public constant PRICE_SLOPE = 100; // 1% of pool value
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

    // --- Initialization ---

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
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-contract BracketPoolTest -vvv
```

Expected: Compilation error — `BracketPool.sol` not found

**Step 3: Write minimal implementation**

Create `contracts/src/BracketPool.sol`:
```solidity
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
    event EntrySubmitted(
        uint256 indexed entryId,
        address indexed owner,
        bytes32[] picks,
        uint256 tiebreaker,
        uint256 pricePaid
    );
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
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-contract BracketPoolTest -vvv
```

Expected: All 8 tests pass

**Step 5: Commit**

```bash
git add contracts/src/BracketPool.sol contracts/test/BracketPool.t.sol && git commit -m "feat(contracts): add BracketPool constructor with initialization tests"
```

---

### Task 1.3: getCurrentPrice()

**Files:**
- Modify: `contracts/src/BracketPool.sol`
- Modify: `contracts/test/BracketPool.t.sol`

**Step 1: Write the failing tests**

Add to `contracts/test/BracketPool.t.sol`:
```solidity
    // --- getCurrentPrice ---

    function test_getCurrentPrice_emptyPool() public view {
        assertEq(pool.getCurrentPrice(), BASE_PRICE);
    }

    function test_getCurrentPrice_formula() public {
        // Simulate pool with value by entering
        bytes32[] memory picks = _createPicks();

        vm.startPrank(user1);
        usdc.approve(address(pool), 1000e6);
        pool.enter(picks, 145);
        vm.stopPrank();

        // price = basePrice + (priceSlope * totalPoolValue / BASIS_POINTS)
        // price = 10e6 + (100 * 10e6 / 10000) = 10e6 + 100000 = 10_100_000
        assertEq(pool.getCurrentPrice(), 10_100_000);
    }

    function testFuzz_getCurrentPrice_neverOverflows(uint256 poolValue) public view {
        // Just verify the formula doesn't revert for reasonable values
        vm.assume(poolValue < 1e18); // Up to $1 trillion in pool
        // Can't set totalPoolValue directly, so this is a sanity check
        // The formula: basePrice + (priceSlope * totalPoolValue / BASIS_POINTS)
        uint256 result = BASE_PRICE + (PRICE_SLOPE * poolValue / 10000);
        assertGe(result, BASE_PRICE);
    }

    // --- Helpers ---

    function _createPicks() internal view returns (bytes32[] memory) {
        bytes32[] memory picks = new bytes32[](GAME_COUNT);
        for (uint256 i = 0; i < GAME_COUNT; i++) {
            picks[i] = bytes32(uint256(i + 1));
        }
        return picks;
    }
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-test "test_getCurrentPrice|testFuzz_getCurrentPrice" -vvv
```

Expected: Error — `getCurrentPrice()` not found

**Step 3: Write implementation**

Add to `contracts/src/BracketPool.sol` after the constructor:
```solidity
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
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-test "test_getCurrentPrice|testFuzz_getCurrentPrice" -vvv
```

Expected: All pass (the formula test will still fail because `enter()` doesn't exist yet — this is expected; it gets tested in Task 1.4)

**Step 5: Commit**

```bash
git add contracts/src/BracketPool.sol contracts/test/BracketPool.t.sol && git commit -m "feat(contracts): add getCurrentPrice() bonding curve"
```

---

### Task 1.4: enter()

**Files:**
- Modify: `contracts/src/BracketPool.sol`
- Modify: `contracts/test/BracketPool.t.sol`

**Step 1: Write the failing tests**

Add to `contracts/test/BracketPool.t.sol` (before the helpers section):
```solidity
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
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-test "test_enter" -vvv
```

Expected: Error — `enter()` not found

**Step 3: Write implementation**

Add to `contracts/src/BracketPool.sol`:
```solidity
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
```

Also add a minimal `cancelPool()` stub so the cancel test compiles (full implementation in Task 1.8):
```solidity
    // --- Cancel (stub — full implementation in Task 1.8) ---

    function cancelPool() external {
        require(msg.sender == admin, "Not authorized");
        require(merkleRoot == bytes32(0), "Already finalized");
        cancelled = true;
        emit PoolCancelled();
    }
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-test "test_enter" -vvv
```

Expected: All 7 `test_enter_*` tests pass

**Step 5: Commit**

```bash
git add contracts/src/BracketPool.sol contracts/test/BracketPool.t.sol && git commit -m "feat(contracts): add enter() with hash-only pick storage"
```

---

### Task 1.5: setResults()

**Files:**
- Modify: `contracts/src/BracketPool.sol`
- Modify: `contracts/test/BracketPool.t.sol`

**Step 1: Write the failing tests**

Add to `contracts/test/BracketPool.t.sol`:
```solidity
    // --- setResults() ---

    function test_setResults_success() public {
        bytes32[] memory results = _createPicks(); // reuse helper
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
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-test "test_setResults" -vvv
```

Expected: Error — `setResults()` not found

**Step 3: Write implementation**

Add to `contracts/src/BracketPool.sol`:
```solidity
    // --- Results ---

    function setResults(bytes32[] calldata results) external {
        require(msg.sender == admin, "Not authorized");
        require(block.timestamp >= lockTime, "Pool not locked yet");
        require(gameResults.length == 0, "Results already posted");
        require(results.length == gameCount, "Invalid results length");

        gameResults = results;
        emit ResultsPosted(results);
    }
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-test "test_setResults" -vvv
```

Expected: All 6 tests pass

**Step 5: Commit**

```bash
git add contracts/src/BracketPool.sol contracts/test/BracketPool.t.sol && git commit -m "feat(contracts): add setResults()"
```

---

### Task 1.6: setMerkleRoot()

**Files:**
- Modify: `contracts/src/BracketPool.sol`
- Modify: `contracts/test/BracketPool.t.sol`

**Step 1: Write the failing tests**

Add to `contracts/test/BracketPool.t.sol`:
```solidity
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
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-test "test_setMerkleRoot" -vvv
```

Expected: Error — `setMerkleRoot()` not found

**Step 3: Write implementation**

Add to `contracts/src/BracketPool.sol`:
```solidity
    // --- Merkle Root ---

    function setMerkleRoot(bytes32 root) external nonReentrant {
        require(msg.sender == admin, "Not authorized");
        require(gameResults.length == gameCount, "Results not posted");
        require(merkleRoot == bytes32(0), "Merkle root already set");
        require(root != bytes32(0), "Invalid root");
        require(entryCount >= MIN_ENTRIES, "Not enough entries");

        uint256 fee = totalPoolValue * FEE_PERCENT / BASIS_POINTS;
        usdc.safeTransfer(treasury, fee);

        merkleRoot = root;

        emit FeePaid(treasury, fee);
        emit MerkleRootSet(root);
    }
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-test "test_setMerkleRoot" -vvv
```

Expected: All 7 tests pass

**Step 5: Commit**

```bash
git add contracts/src/BracketPool.sol contracts/test/BracketPool.t.sol && git commit -m "feat(contracts): add setMerkleRoot() with fee distribution and nonReentrant"
```

---

### Task 1.7: claim()

**Files:**
- Modify: `contracts/src/BracketPool.sol`
- Modify: `contracts/test/BracketPool.t.sol`

**Step 1: Write the failing tests**

Add to `contracts/test/BracketPool.t.sol`:
```solidity
    // --- claim() ---

    // Helper: build a 2-leaf Merkle tree and return root + proof for leaf 0
    function _buildMerkleTree(
        address owner1, uint256 entryId1, uint256 amount1,
        address owner2, uint256 entryId2, uint256 amount2
    ) internal pure returns (bytes32 root, bytes32[] memory proof1) {
        bytes32 leaf1 = keccak256(bytes.concat(keccak256(abi.encode(owner1, entryId1, amount1))));
        bytes32 leaf2 = keccak256(bytes.concat(keccak256(abi.encode(owner2, entryId2, amount2))));

        // For 2 leaves, proof is just the other leaf
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

        (bytes32 root, bytes32[] memory proof) = _buildMerkleTree(
            user1, 0, prize1,
            user2, 1, prize2
        );

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

        vm.prank(user2); // not the owner of entry 0
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
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-test "test_claim" -vvv
```

Expected: Error — `claim()` not found

**Step 3: Write implementation**

Add to `contracts/src/BracketPool.sol`:
```solidity
    // --- Claim ---

    function claim(uint256 entryId, uint256 amount, bytes32[] calldata proof) external nonReentrant {
        require(merkleRoot != bytes32(0), "Not finalized");
        require(block.timestamp < claimDeadline, "Claim period ended");
        require(!entryClaimed[entryId], "Already claimed");
        require(!entryRefunded[entryId], "Entry was refunded");
        require(entries[entryId].owner == msg.sender, "Not entry owner");

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, entryId, amount))));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid proof");

        entryClaimed[entryId] = true;
        usdc.safeTransfer(msg.sender, amount);

        emit PrizeClaimed(entryId, msg.sender, amount);
    }
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-test "test_claim" -vvv
```

Expected: All 6 tests pass

**Step 5: Commit**

```bash
git add contracts/src/BracketPool.sol contracts/test/BracketPool.t.sol && git commit -m "feat(contracts): add claim() with Merkle proof verification and claim deadline"
```

---

### Task 1.8: cancelPool() + refund()

The `cancelPool()` stub was added in Task 1.4. Now add full refund logic and tests.

**Files:**
- Modify: `contracts/src/BracketPool.sol`
- Modify: `contracts/test/BracketPool.t.sol`

**Step 1: Write the failing tests**

Add to `contracts/test/BracketPool.t.sol`:
```solidity
    // --- cancelPool() ---

    function test_cancelPool_success() public {
        vm.prank(admin);
        pool.cancelPool();
        assertTrue(pool.cancelled());
    }

    function test_cancelPool_revert_notAdmin() public {
        vm.prank(user1);
        vm.expectRevert("Not authorized");
        pool.cancelPool();
    }

    function test_cancelPool_revert_alreadyFinalized() public {
        _setupPoolForMerkleRoot();
        vm.prank(admin);
        pool.setMerkleRoot(bytes32(uint256(1)));

        vm.prank(admin);
        vm.expectRevert("Already finalized");
        pool.cancelPool();
    }

    // --- refund() ---

    function test_refund_afterCancel() public {
        bytes32[] memory picks = _createPicks();
        uint256 price = pool.getCurrentPrice();

        vm.startPrank(user1);
        usdc.approve(address(pool), price);
        pool.enter(picks, 145);
        vm.stopPrank();

        uint256 balBefore = usdc.balanceOf(user1);

        vm.prank(admin);
        pool.cancelPool();

        vm.prank(user1);
        pool.refund(0);

        assertEq(usdc.balanceOf(user1), balBefore + price);
        assertTrue(pool.entryRefunded(0));
    }

    function test_refund_notEnoughEntries() public {
        bytes32[] memory picks = _createPicks();
        uint256 price = pool.getCurrentPrice();

        vm.startPrank(user1);
        usdc.approve(address(pool), price);
        pool.enter(picks, 145);
        vm.stopPrank();

        uint256 balBefore = usdc.balanceOf(user1);
        vm.warp(lockTime + 1);

        vm.prank(user1);
        pool.refund(0);

        assertEq(usdc.balanceOf(user1), balBefore + price);
    }

    function test_refund_afterFinalizeDeadline() public {
        bytes32[] memory picks = _createPicks();

        vm.startPrank(user1);
        usdc.approve(address(pool), 10_000e6);
        pool.enter(picks, 145);
        vm.stopPrank();

        vm.startPrank(user2);
        usdc.approve(address(pool), 10_000e6);
        pool.enter(picks, 150);
        vm.stopPrank();

        // Past finalize deadline without merkle root
        vm.warp(finalizeDeadline + 1);

        uint256 balBefore = usdc.balanceOf(user1);
        (, , , uint256 pricePaid) = pool.entries(0);

        vm.prank(user1);
        pool.refund(0);

        assertEq(usdc.balanceOf(user1), balBefore + pricePaid);
    }

    function test_refund_revert_notOwner() public {
        bytes32[] memory picks = _createPicks();
        vm.startPrank(user1);
        usdc.approve(address(pool), pool.getCurrentPrice());
        pool.enter(picks, 145);
        vm.stopPrank();

        vm.prank(admin);
        pool.cancelPool();

        vm.prank(user2);
        vm.expectRevert("Not entry owner");
        pool.refund(0);
    }

    function test_refund_revert_doubleRefund() public {
        bytes32[] memory picks = _createPicks();
        vm.startPrank(user1);
        usdc.approve(address(pool), pool.getCurrentPrice());
        pool.enter(picks, 145);
        vm.stopPrank();

        vm.prank(admin);
        pool.cancelPool();

        vm.prank(user1);
        pool.refund(0);

        vm.prank(user1);
        vm.expectRevert("Already refunded");
        pool.refund(0);
    }

    function test_refund_revert_alreadyClaimed() public {
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
        pool.refund(0);
    }

    function test_refund_revert_noConditionMet() public {
        bytes32[] memory picks = _createPicks();
        vm.startPrank(user1);
        usdc.approve(address(pool), 10_000e6);
        pool.enter(picks, 145);
        vm.stopPrank();

        vm.startPrank(user2);
        usdc.approve(address(pool), 10_000e6);
        pool.enter(picks, 150);
        vm.stopPrank();

        // Not cancelled, enough entries, before deadline
        vm.prank(user1);
        vm.expectRevert("Refund not available");
        pool.refund(0);
    }

    function test_refund_accountingBalance() public {
        bytes32[] memory picks = _createPicks();

        vm.startPrank(user1);
        usdc.approve(address(pool), 10_000e6);
        pool.enter(picks, 145);
        vm.stopPrank();

        vm.startPrank(user2);
        usdc.approve(address(pool), 10_000e6);
        pool.enter(picks, 150);
        vm.stopPrank();

        (, , , uint256 price1) = pool.entries(0);
        (, , , uint256 price2) = pool.entries(1);
        assertEq(price1 + price2, pool.totalPoolValue());
        assertEq(usdc.balanceOf(address(pool)), pool.totalPoolValue());
    }
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-test "test_refund|test_cancelPool" -vvv
```

Expected: Error — `refund()` not found

**Step 3: Write implementation**

Add to `contracts/src/BracketPool.sol`:
```solidity
    // --- Refund ---

    function refund(uint256 entryId) external nonReentrant {
        require(entries[entryId].owner == msg.sender, "Not entry owner");
        require(!entryRefunded[entryId], "Already refunded");
        require(!entryClaimed[entryId], "Already claimed");

        bool canRefund = cancelled
            || (block.timestamp >= lockTime && entryCount < MIN_ENTRIES)
            || (block.timestamp >= finalizeDeadline && merkleRoot == bytes32(0));
        require(canRefund, "Refund not available");

        entryRefunded[entryId] = true;
        usdc.safeTransfer(msg.sender, entries[entryId].pricePaid);

        emit EntryRefunded(entryId, msg.sender, entries[entryId].pricePaid);
    }
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-test "test_refund|test_cancelPool" -vvv
```

Expected: All 10 tests pass

**Step 5: Commit**

```bash
git add contracts/src/BracketPool.sol contracts/test/BracketPool.t.sol && git commit -m "feat(contracts): add cancelPool() and refund() with 3 refund paths"
```

---

### Task 1.9: setProofsCID() + sweepUnclaimed()

**Files:**
- Modify: `contracts/src/BracketPool.sol`
- Modify: `contracts/test/BracketPool.t.sol`

**Step 1: Write the failing tests**

Add to `contracts/test/BracketPool.t.sol`:
```solidity
    // --- setProofsCID() ---

    function test_setProofsCID_success() public {
        _setupPoolForMerkleRoot();
        vm.prank(admin);
        pool.setMerkleRoot(bytes32(uint256(1)));

        vm.prank(admin);
        pool.setProofsCID("QmTestCID123");

        assertEq(pool.proofsCID(), "QmTestCID123");
    }

    function test_setProofsCID_revert_notAdmin() public {
        _setupPoolForMerkleRoot();
        vm.prank(admin);
        pool.setMerkleRoot(bytes32(uint256(1)));

        vm.prank(user1);
        vm.expectRevert("Not authorized");
        pool.setProofsCID("QmTestCID123");
    }

    function test_setProofsCID_revert_noMerkleRoot() public {
        vm.prank(admin);
        vm.expectRevert("Merkle root not set");
        pool.setProofsCID("QmTestCID123");
    }

    function test_setProofsCID_revert_alreadySet() public {
        _setupPoolForMerkleRoot();
        vm.prank(admin);
        pool.setMerkleRoot(bytes32(uint256(1)));

        vm.prank(admin);
        pool.setProofsCID("QmTestCID123");

        vm.prank(admin);
        vm.expectRevert("CID already set");
        pool.setProofsCID("QmOtherCID");
    }

    function test_setProofsCID_revert_emptyCID() public {
        _setupPoolForMerkleRoot();
        vm.prank(admin);
        pool.setMerkleRoot(bytes32(uint256(1)));

        vm.prank(admin);
        vm.expectRevert("Empty CID");
        pool.setProofsCID("");
    }

    // --- sweepUnclaimed() ---

    function test_sweepUnclaimed_success() public {
        _setupPoolForMerkleRoot();
        vm.prank(admin);
        pool.setMerkleRoot(bytes32(uint256(1)));

        vm.warp(pool.claimDeadline() + 1);

        uint256 remaining = usdc.balanceOf(address(pool));
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        vm.prank(admin);
        pool.sweepUnclaimed();

        assertEq(usdc.balanceOf(address(pool)), 0);
        assertEq(usdc.balanceOf(treasury), treasuryBefore + remaining);
    }

    function test_sweepUnclaimed_revert_beforeDeadline() public {
        _setupPoolForMerkleRoot();
        vm.prank(admin);
        pool.setMerkleRoot(bytes32(uint256(1)));

        vm.prank(admin);
        vm.expectRevert("Claim period not over");
        pool.sweepUnclaimed();
    }

    function test_sweepUnclaimed_revert_notFinalized() public {
        vm.warp(pool.claimDeadline() + 1);

        vm.prank(admin);
        vm.expectRevert("Not finalized");
        pool.sweepUnclaimed();
    }

    function test_sweepUnclaimed_revert_notAdmin() public {
        _setupPoolForMerkleRoot();
        vm.prank(admin);
        pool.setMerkleRoot(bytes32(uint256(1)));

        vm.warp(pool.claimDeadline() + 1);

        vm.prank(user1);
        vm.expectRevert("Not authorized");
        pool.sweepUnclaimed();
    }
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-test "test_setProofsCID|test_sweepUnclaimed" -vvv
```

Expected: Error — functions not found

**Step 3: Write implementation**

Add to `contracts/src/BracketPool.sol`:
```solidity
    // --- Proofs CID ---

    function setProofsCID(string calldata cid) external {
        require(msg.sender == admin, "Not authorized");
        require(merkleRoot != bytes32(0), "Merkle root not set");
        require(bytes(proofsCID).length == 0, "CID already set");
        require(bytes(cid).length > 0, "Empty CID");

        proofsCID = cid;
        emit ProofsCIDSet(cid);
    }

    // --- Sweep ---

    function sweepUnclaimed() external {
        require(msg.sender == admin, "Not authorized");
        require(block.timestamp >= claimDeadline, "Claim period not over");
        require(merkleRoot != bytes32(0), "Not finalized");

        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "Nothing to sweep");

        usdc.safeTransfer(treasury, balance);
        emit UnclaimedSwept(treasury, balance);
    }
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-test "test_setProofsCID|test_sweepUnclaimed" -vvv
```

Expected: All 9 tests pass

**Step 5: Commit**

```bash
git add contracts/src/BracketPool.sol contracts/test/BracketPool.t.sol && git commit -m "feat(contracts): add setProofsCID() and sweepUnclaimed()"
```

---

### Task 1.10: BracketPoolFactory

**Files:**
- Create: `contracts/src/BracketPoolFactory.sol`
- Create: `contracts/test/BracketPoolFactory.t.sol`

**Step 1: Write the failing tests**

Create `contracts/test/BracketPoolFactory.t.sol`:
```solidity
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
        assertEq(pool.admin(), admin); // CRITICAL: admin = caller, not factory
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
        assertTrue(pool.admin() != address(factory)); // Must NOT be factory
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
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-contract BracketPoolFactoryTest -vvv
```

Expected: Error — `BracketPoolFactory.sol` not found

**Step 3: Write implementation**

Create `contracts/src/BracketPoolFactory.sol`:
```solidity
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
            msg.sender,       // admin = caller (the multisig), NOT address(this)
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
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test --match-contract BracketPoolFactoryTest -vvv
```

Expected: All 6 tests pass

**Step 5: Commit**

```bash
git add contracts/src/BracketPoolFactory.sol contracts/test/BracketPoolFactory.t.sol && git commit -m "feat(contracts): add BracketPoolFactory with admin passthrough fix"
```

---

### Task 1.11: Deployment Script + Env

**Files:**
- Create: `contracts/script/Deploy.s.sol`
- Create: `contracts/.env.example`

**Step 1: Write deployment script**

Create `contracts/script/Deploy.s.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/BracketPoolFactory.sol";

contract DeployScript is Script {
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

Create `contracts/.env.example`:
```
PRIVATE_KEY=your_private_key_here
USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
TREASURY_ADDRESS=your_treasury_address_here
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=your_etherscan_api_key
```

**Step 3: Verify build**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge build
```

Expected: `Compiler run successful`

**Step 4: Commit**

```bash
git add contracts/script/Deploy.s.sol contracts/.env.example && git commit -m "feat(contracts): add deployment script and env example"
```

---

### Task 1.12: Full Test Suite + Coverage

**Files:**
- Modify: `contracts/test/BracketPool.t.sol` (add fuzz tests)

**Step 1: Add fuzz and invariant tests**

Add to `contracts/test/BracketPool.t.sol`:
```solidity
    // --- Fuzz Tests ---

    function testFuzz_enter_validPicks(uint256 tiebreaker) public {
        bytes32[] memory picks = _createPicks();

        vm.startPrank(user1);
        usdc.approve(address(pool), pool.getCurrentPrice());
        pool.enter(picks, tiebreaker);
        vm.stopPrank();

        assertEq(pool.entryCount(), 1);
        (, , uint256 storedTiebreaker, ) = pool.entries(0);
        assertEq(storedTiebreaker, tiebreaker);
    }

    function testFuzz_getCurrentPrice_monotonic(uint8 numEntries) public {
        vm.assume(numEntries > 0 && numEntries <= 20);
        bytes32[] memory picks = _createPicks();

        uint256 lastPrice = pool.getCurrentPrice();
        for (uint256 i = 0; i < numEntries; i++) {
            vm.startPrank(user1);
            usdc.approve(address(pool), pool.getCurrentPrice());
            pool.enter(picks, 145);
            vm.stopPrank();

            uint256 newPrice = pool.getCurrentPrice();
            assertGe(newPrice, lastPrice);
            lastPrice = newPrice;
        }
    }
```

**Step 2: Run full test suite**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge test -vvv
```

Expected: All tests pass

**Step 3: Check coverage**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge coverage
```

Expected: >90% coverage on BracketPool.sol

**Step 4: Commit**

```bash
git add contracts/test/ && git commit -m "test(contracts): add fuzz tests, target 90%+ coverage"
```

---

## Phase 2: Off-Chain Scoring Service (TypeScript)

### Task 2.1: Scorer Project Setup

**Files:**
- Create: `scorer/package.json`
- Create: `scorer/tsconfig.json`
- Create: `scorer/src/types.ts`

**Step 1: Initialize project**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp && mkdir -p scorer/src scorer/test
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/scorer && npm init -y
npm install typescript viem @openzeppelin/merkle-tree dotenv
npm install -D @types/node vitest tsx
```

**Step 2: Create tsconfig.json**

Create `scorer/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

**Step 3: Create types.ts**

Create `scorer/src/types.ts`:
```typescript
export interface RawEntry {
  entryId: number;
  owner: string;          // address
  picks: `0x${string}`[]; // bytes32[] from event
  tiebreaker: bigint;
  pricePaid: bigint;
}

export interface ScoredEntry extends RawEntry {
  score: number;
  tiebreakerDistance: number;
  rank: number;
  prizeAmount: bigint;
}

export interface ScorerOutput {
  poolAddress: string;
  merkleRoot: string;
  totalEntries: number;
  prizePool: bigint;
  entries: ScoredEntry[];
  proofs: Record<number, string[]>; // entryId -> proof
}
```

**Step 4: Add scripts to package.json**

Edit `scorer/package.json` — add to `"scripts"`:
```json
"scripts": {
  "build": "tsc",
  "test": "vitest run",
  "test:watch": "vitest",
  "score": "tsx src/index.ts"
}
```

**Step 5: Verify setup**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/scorer && npx tsc --noEmit
```

Expected: No errors

**Step 6: Commit**

```bash
git add scorer/ && git commit -m "chore(scorer): initialize TypeScript project"
```

---

### Task 2.2: Scoring Logic

**Files:**
- Create: `scorer/src/scoring.ts`
- Create: `scorer/test/scoring.test.ts`

**Step 1: Write the failing tests**

Create `scorer/test/scoring.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { getPointsForGame, scoreEntry } from '../src/scoring';

describe('getPointsForGame', () => {
  it('returns 5 for First Four (indices 0-3)', () => {
    expect(getPointsForGame(0)).toBe(5);
    expect(getPointsForGame(3)).toBe(5);
  });

  it('returns 10 for Round of 64 (indices 4-35)', () => {
    expect(getPointsForGame(4)).toBe(10);
    expect(getPointsForGame(35)).toBe(10);
  });

  it('returns 20 for Round of 32 (indices 36-51)', () => {
    expect(getPointsForGame(36)).toBe(20);
    expect(getPointsForGame(51)).toBe(20);
  });

  it('returns 40 for Sweet 16 (indices 52-59)', () => {
    expect(getPointsForGame(52)).toBe(40);
    expect(getPointsForGame(59)).toBe(40);
  });

  it('returns 80 for Elite 8 (indices 60-63)', () => {
    expect(getPointsForGame(60)).toBe(80);
    expect(getPointsForGame(63)).toBe(80);
  });

  it('returns 160 for Final Four (indices 64-65)', () => {
    expect(getPointsForGame(64)).toBe(160);
    expect(getPointsForGame(65)).toBe(160);
  });

  it('returns 320 for Championship (index 66)', () => {
    expect(getPointsForGame(66)).toBe(320);
  });

  it('throws for out-of-range index', () => {
    expect(() => getPointsForGame(67)).toThrow();
  });
});

describe('scoreEntry', () => {
  const makeBytes32 = (n: number): `0x${string}` =>
    `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`;

  const makePicks = (count: number, offset = 0): `0x${string}`[] =>
    Array.from({ length: count }, (_, i) => makeBytes32(i + 1 + offset));

  it('perfect bracket = 1940', () => {
    const picks = makePicks(67);
    const results = makePicks(67); // identical
    expect(scoreEntry(picks, results)).toBe(1940);
  });

  it('all wrong = 0', () => {
    const picks = makePicks(67, 0);
    const results = makePicks(67, 100); // all different
    expect(scoreEntry(picks, results)).toBe(0);
  });

  it('only championship correct = 320', () => {
    const picks = makePicks(67, 0);
    const results = makePicks(67, 100);
    results[66] = picks[66]; // only last game matches
    expect(scoreEntry(picks, results)).toBe(320);
  });

  it('only First Four correct = 20', () => {
    const picks = makePicks(67, 0);
    const results = makePicks(67, 100);
    results[0] = picks[0];
    results[1] = picks[1];
    results[2] = picks[2];
    results[3] = picks[3];
    expect(scoreEntry(picks, results)).toBe(20);
  });

  it('throws on length mismatch', () => {
    expect(() => scoreEntry(makePicks(10), makePicks(67))).toThrow();
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/scorer && npx vitest run test/scoring.test.ts
```

Expected: FAIL — module not found

**Step 3: Write implementation**

Create `scorer/src/scoring.ts`:
```typescript
export function getPointsForGame(gameIndex: number): number {
  if (gameIndex < 0 || gameIndex > 66) throw new Error(`Invalid game index: ${gameIndex}`);
  if (gameIndex < 4) return 5;    // First Four
  if (gameIndex < 36) return 10;  // Round of 64
  if (gameIndex < 52) return 20;  // Round of 32
  if (gameIndex < 60) return 40;  // Sweet 16
  if (gameIndex < 64) return 80;  // Elite 8
  if (gameIndex < 66) return 160; // Final Four
  return 320;                      // Championship
}

export function scoreEntry(picks: `0x${string}`[], results: `0x${string}`[]): number {
  if (picks.length !== results.length) {
    throw new Error(`Length mismatch: picks=${picks.length}, results=${results.length}`);
  }

  let score = 0;
  for (let i = 0; i < picks.length; i++) {
    if (picks[i].toLowerCase() === results[i].toLowerCase()) {
      score += getPointsForGame(i);
    }
  }
  return score;
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/scorer && npx vitest run test/scoring.test.ts
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add scorer/src/scoring.ts scorer/test/scoring.test.ts && git commit -m "feat(scorer): add ESPN-style scoring logic with 7-round support"
```

---

### Task 2.3: Ranking + Prize Distribution

**Files:**
- Create: `scorer/src/ranking.ts`
- Create: `scorer/test/ranking.test.ts`

**Step 1: Write the failing tests**

Create `scorer/test/ranking.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { rankEntries, distributePrizes } from '../src/ranking';
import type { ScoredEntry, RawEntry } from '../src/types';

const makeEntry = (id: number, owner: string, score: number, tiebreaker: number): ScoredEntry => ({
  entryId: id,
  owner,
  picks: [],
  tiebreaker: BigInt(tiebreaker),
  pricePaid: 10_000_000n,
  score,
  tiebreakerDistance: 0,
  rank: 0,
  prizeAmount: 0n,
});

describe('rankEntries', () => {
  it('ranks by score descending', () => {
    const entries = [
      makeEntry(0, '0xA', 100, 140),
      makeEntry(1, '0xB', 200, 140),
      makeEntry(2, '0xC', 150, 140),
    ];
    const ranked = rankEntries(entries, 145);
    expect(ranked[0].entryId).toBe(1);
    expect(ranked[1].entryId).toBe(2);
    expect(ranked[2].entryId).toBe(0);
  });

  it('uses tiebreaker when scores are equal', () => {
    const entries = [
      makeEntry(0, '0xA', 200, 150), // dist=5
      makeEntry(1, '0xB', 200, 143), // dist=2 (closer)
    ];
    const ranked = rankEntries(entries, 145);
    expect(ranked[0].entryId).toBe(1); // closer tiebreaker wins
    expect(ranked[1].entryId).toBe(0);
  });

  it('assigns same rank for equal score and tiebreaker distance', () => {
    const entries = [
      makeEntry(0, '0xA', 200, 140), // dist=5
      makeEntry(1, '0xB', 200, 150), // dist=5
    ];
    const ranked = rankEntries(entries, 145);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1); // tied
  });
});

describe('distributePrizes', () => {
  it('single winner gets full prize pool', () => {
    const entries = [
      makeEntry(0, '0xA', 200, 145),
      makeEntry(1, '0xB', 100, 145),
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 19_000_000n); // $19 prize pool

    expect(result[0].prizeAmount).toBe(19_000_000n);
    expect(result[1].prizeAmount).toBe(0n);
  });

  it('tied winners split evenly', () => {
    const entries = [
      makeEntry(0, '0xA', 200, 140), // dist=5
      makeEntry(1, '0xB', 200, 150), // dist=5
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 20_000_000n);

    expect(result[0].prizeAmount).toBe(10_000_000n);
    expect(result[1].prizeAmount).toBe(10_000_000n);
  });

  it('handles dust correctly (remainder to first winner)', () => {
    const entries = [
      makeEntry(0, '0xA', 200, 140),
      makeEntry(1, '0xB', 200, 150),
      makeEntry(2, '0xC', 200, 140), // 3-way tie, dist=5 each
    ];
    const ranked = rankEntries(entries, 145);
    const result = distributePrizes(ranked, 19_000_001n); // not evenly divisible by 3

    const total = result.reduce((sum, e) => sum + e.prizeAmount, 0n);
    expect(total).toBe(19_000_001n); // no dust lost
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/scorer && npx vitest run test/ranking.test.ts
```

Expected: FAIL — module not found

**Step 3: Write implementation**

Create `scorer/src/ranking.ts`:
```typescript
import type { ScoredEntry } from './types';

export function rankEntries(entries: ScoredEntry[], actualTiebreaker: number): ScoredEntry[] {
  // Calculate tiebreaker distances
  const withDistance = entries.map(e => ({
    ...e,
    tiebreakerDistance: Math.abs(Number(e.tiebreaker) - actualTiebreaker),
  }));

  // Sort: score desc, then tiebreaker distance asc
  withDistance.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.tiebreakerDistance - b.tiebreakerDistance;
  });

  // Assign ranks (tied entries get same rank)
  let currentRank = 1;
  for (let i = 0; i < withDistance.length; i++) {
    if (i > 0 &&
        withDistance[i].score === withDistance[i - 1].score &&
        withDistance[i].tiebreakerDistance === withDistance[i - 1].tiebreakerDistance) {
      withDistance[i].rank = withDistance[i - 1].rank;
    } else {
      withDistance[i].rank = currentRank;
    }
    currentRank++;
  }

  return withDistance;
}

export function distributePrizes(rankedEntries: ScoredEntry[], prizePool: bigint): ScoredEntry[] {
  // Find all rank-1 entries (winners)
  const winnerRank = rankedEntries[0].rank;
  const winners = rankedEntries.filter(e => e.rank === winnerRank);
  const nonWinners = rankedEntries.filter(e => e.rank !== winnerRank);

  const prizePerWinner = prizePool / BigInt(winners.length);
  const dust = prizePool - prizePerWinner * BigInt(winners.length);

  const distributed = winners.map((e, i) => ({
    ...e,
    prizeAmount: prizePerWinner + (i === 0 ? dust : 0n),
  }));

  const zeroedNonWinners = nonWinners.map(e => ({ ...e, prizeAmount: 0n }));

  return [...distributed, ...zeroedNonWinners];
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/scorer && npx vitest run test/ranking.test.ts
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add scorer/src/ranking.ts scorer/test/ranking.test.ts && git commit -m "feat(scorer): add ranking and prize distribution logic"
```

---

### Task 2.4: Merkle Tree Builder

**Files:**
- Create: `scorer/src/merkle.ts`
- Create: `scorer/test/merkle.test.ts`

**Step 1: Write the failing tests**

Create `scorer/test/merkle.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildMerkleTree } from '../src/merkle';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';

describe('buildMerkleTree', () => {
  it('builds tree with correct leaf encoding', () => {
    const winners = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 19_000_000n },
    ];
    const { root, proofs } = buildMerkleTree(winners);

    expect(root).toMatch(/^0x[0-9a-f]{64}$/);
    expect(proofs[0]).toBeDefined();
    expect(proofs[0].length).toBeGreaterThan(0);
  });

  it('produces deterministic output', () => {
    const winners = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 10_000_000n },
      { owner: '0x2222222222222222222222222222222222222222', entryId: 1, amount: 10_000_000n },
    ];
    const result1 = buildMerkleTree(winners);
    const result2 = buildMerkleTree(winners);
    expect(result1.root).toBe(result2.root);
  });

  it('different inputs produce different roots', () => {
    const winners1 = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 10_000_000n },
    ];
    const winners2 = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 20_000_000n },
    ];
    expect(buildMerkleTree(winners1).root).not.toBe(buildMerkleTree(winners2).root);
  });

  it('generates valid proofs for all winners', () => {
    const winners = [
      { owner: '0x1111111111111111111111111111111111111111', entryId: 0, amount: 10_000_000n },
      { owner: '0x2222222222222222222222222222222222222222', entryId: 1, amount: 9_000_000n },
      { owner: '0x3333333333333333333333333333333333333333', entryId: 2, amount: 1_000_001n },
    ];
    const { root, proofs, tree } = buildMerkleTree(winners);

    for (const w of winners) {
      const proof = proofs[w.entryId];
      const verified = tree.verify([w.owner, BigInt(w.entryId), w.amount], proof);
      expect(verified).toBe(true);
    }
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/scorer && npx vitest run test/merkle.test.ts
```

Expected: FAIL — module not found

**Step 3: Write implementation**

Create `scorer/src/merkle.ts`:
```typescript
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';

export interface WinnerLeaf {
  owner: string;
  entryId: number;
  amount: bigint;
}

export interface MerkleResult {
  root: string;
  proofs: Record<number, string[]>;
  tree: StandardMerkleTree<[string, bigint, bigint]>;
}

export function buildMerkleTree(winners: WinnerLeaf[]): MerkleResult {
  const values: [string, bigint, bigint][] = winners.map(w => [
    w.owner,
    BigInt(w.entryId),
    w.amount,
  ]);

  const tree = StandardMerkleTree.of(values, ['address', 'uint256', 'uint256']);

  const proofs: Record<number, string[]> = {};
  for (const [i, v] of tree.entries()) {
    const entryId = Number(v[1]);
    proofs[entryId] = tree.getProof(i);
  }

  return {
    root: tree.root,
    proofs,
    tree,
  };
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/scorer && npx vitest run test/merkle.test.ts
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add scorer/src/merkle.ts scorer/test/merkle.test.ts && git commit -m "feat(scorer): add Merkle tree builder with OpenZeppelin StandardMerkleTree"
```

---

### Task 2.5: Event Reader

**Files:**
- Create: `scorer/src/reader.ts`

**Step 1: Write implementation**

Create `scorer/src/reader.ts`:
```typescript
import { createPublicClient, http, parseAbiItem, type Address, type PublicClient } from 'viem';
import { sepolia, mainnet } from 'viem/chains';
import type { RawEntry } from './types';

const ENTRY_SUBMITTED_EVENT = parseAbiItem(
  'event EntrySubmitted(uint256 indexed entryId, address indexed owner, bytes32[] picks, uint256 tiebreaker, uint256 pricePaid)'
);

export async function readEntries(
  poolAddress: Address,
  rpcUrl: string,
  chainId: number = 11155111, // Sepolia default
): Promise<RawEntry[]> {
  const chain = chainId === 1 ? mainnet : sepolia;
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  const logs = await client.getLogs({
    address: poolAddress,
    event: ENTRY_SUBMITTED_EVENT,
    fromBlock: 0n,
    toBlock: 'latest',
  });

  return logs.map(log => ({
    entryId: Number(log.args.entryId!),
    owner: log.args.owner!,
    picks: log.args.picks! as `0x${string}`[],
    tiebreaker: log.args.tiebreaker!,
    pricePaid: log.args.pricePaid!,
  }));
}

export async function readGameResults(
  poolAddress: Address,
  rpcUrl: string,
  chainId: number = 11155111,
): Promise<`0x${string}`[]> {
  const chain = chainId === 1 ? mainnet : sepolia;
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  const BRACKET_POOL_ABI = [
    {
      name: 'getGameResults',
      type: 'function' as const,
      inputs: [],
      outputs: [{ name: '', type: 'bytes32[]' }],
      stateMutability: 'view' as const,
    },
  ] as const;

  const results = await client.readContract({
    address: poolAddress,
    abi: BRACKET_POOL_ABI,
    functionName: 'getGameResults',
  });

  return results as `0x${string}`[];
}

export async function readTotalPoolValue(
  poolAddress: Address,
  rpcUrl: string,
  chainId: number = 11155111,
): Promise<bigint> {
  const chain = chainId === 1 ? mainnet : sepolia;
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  const ABI = [
    {
      name: 'totalPoolValue',
      type: 'function' as const,
      inputs: [],
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view' as const,
    },
  ] as const;

  return await client.readContract({
    address: poolAddress,
    abi: ABI,
    functionName: 'totalPoolValue',
  });
}
```

Note: This module interacts with the chain so it can't be unit-tested without a fork. It will be tested in Phase 4 integration tests.

**Step 2: Commit**

```bash
git add scorer/src/reader.ts && git commit -m "feat(scorer): add on-chain event reader"
```

---

### Task 2.6: Main Pipeline

**Files:**
- Create: `scorer/src/index.ts`

**Step 1: Write main pipeline**

Create `scorer/src/index.ts`:
```typescript
import { readEntries, readGameResults, readTotalPoolValue } from './reader';
import { scoreEntry } from './scoring';
import { rankEntries, distributePrizes } from './ranking';
import { buildMerkleTree } from './merkle';
import type { ScoredEntry, ScorerOutput } from './types';
import type { Address } from 'viem';
import * as fs from 'fs';

async function main() {
  const poolAddress = process.argv[2] as Address;
  const rpcUrl = process.argv[3];
  const actualTiebreaker = parseInt(process.argv[4], 10);

  if (!poolAddress || !rpcUrl || isNaN(actualTiebreaker)) {
    console.error('Usage: tsx src/index.ts <poolAddress> <rpcUrl> <actualTiebreaker>');
    process.exit(1);
  }

  console.log(`Scoring pool: ${poolAddress}`);
  console.log(`Actual tiebreaker: ${actualTiebreaker}`);

  // 1. Read data from chain
  const entries = await readEntries(poolAddress, rpcUrl);
  const results = await readGameResults(poolAddress, rpcUrl);
  const totalPoolValue = await readTotalPoolValue(poolAddress, rpcUrl);

  console.log(`Found ${entries.length} entries`);
  console.log(`Total pool value: ${totalPoolValue}`);

  // 2. Score all entries
  const scored: ScoredEntry[] = entries.map(e => ({
    ...e,
    score: scoreEntry(e.picks, results),
    tiebreakerDistance: 0,
    rank: 0,
    prizeAmount: 0n,
  }));

  // 3. Rank entries
  const ranked = rankEntries(scored, actualTiebreaker);

  // 4. Calculate prize pool using same formula as contract
  const fee = totalPoolValue * 500n / 10000n;
  const prizePool = totalPoolValue - fee;
  console.log(`Fee: ${fee}, Prize pool: ${prizePool}`);

  // 5. Distribute prizes
  const distributed = distributePrizes(ranked, prizePool);

  // 6. Build Merkle tree (only for winners with prize > 0)
  const winners = distributed
    .filter(e => e.prizeAmount > 0n)
    .map(e => ({
      owner: e.owner,
      entryId: e.entryId,
      amount: e.prizeAmount,
    }));

  const { root, proofs } = buildMerkleTree(winners);

  console.log(`Merkle root: ${root}`);
  console.log(`Winners: ${winners.length}`);

  // 7. Output JSON
  const output: ScorerOutput = {
    poolAddress,
    merkleRoot: root,
    totalEntries: entries.length,
    prizePool,
    entries: distributed,
    proofs,
  };

  const outputPath = `output-${poolAddress.slice(0, 10)}.json`;
  fs.writeFileSync(
    outputPath,
    JSON.stringify(output, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2),
  );
  console.log(`Output written to ${outputPath}`);
  console.log('\nNext steps:');
  console.log(`1. Admin calls setMerkleRoot("${root}")`);
  console.log(`2. Verify: balanceOf(pool) == sum(prizeAmounts) = ${winners.reduce((s, w) => s + w.amount, 0n)}`);
  console.log('3. Pin output JSON to IPFS');
  console.log('4. Admin calls setProofsCID(cid)');
}

main().catch(console.error);
```

**Step 2: Verify it compiles**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/scorer && npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add scorer/src/index.ts && git commit -m "feat(scorer): add main scoring pipeline"
```

---

## Phase 3: Frontend (Next.js + wagmi + RainbowKit)

### Task 3.1: Project Setup

**Step 1: Initialize Next.js**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp && npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

**Step 2: Install web3 dependencies**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/web && npm install wagmi viem @rainbow-me/rainbowkit @tanstack/react-query
```

**Step 3: Create wagmi config**

Create `web/src/lib/wagmi.ts`:
```typescript
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, mainnet } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Bracket Pool',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'PLACEHOLDER',
  chains: [sepolia, mainnet],
  ssr: true,
});
```

**Step 4: Create providers**

Create `web/src/app/providers.tsx`:
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

**Step 5: Update layout to use providers**

Replace `web/src/app/layout.tsx`:
```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bracket Pool",
  description: "On-chain March Madness bracket pools",
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

**Step 6: Create .env.local.example**

Create `web/.env.local.example`:
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_FACTORY_ADDRESS=deployed_factory_address
```

**Step 7: Verify it runs**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/web && npm run dev &
sleep 5 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

Expected: `200`

**Step 8: Commit**

```bash
git add web/ && git commit -m "feat(web): initialize Next.js with wagmi + RainbowKit"
```

---

### Task 3.2: Contract ABIs + Addresses

**Files:**
- Create: `web/src/lib/contracts.ts`
- Create: `web/src/lib/abis/` (copied from Foundry build)

**Step 1: Extract ABIs**

Run:
```bash
mkdir -p /Users/claytonlowery/madness-app/bracket-pool-dapp/web/src/lib/abis
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts && forge build
jq '.abi' out/BracketPool.sol/BracketPool.json > ../web/src/lib/abis/BracketPool.json
jq '.abi' out/BracketPoolFactory.sol/BracketPoolFactory.json > ../web/src/lib/abis/BracketPoolFactory.json
```

**Step 2: Create contracts config**

Create `web/src/lib/contracts.ts`:
```typescript
import BracketPoolABI from './abis/BracketPool.json';
import BracketPoolFactoryABI from './abis/BracketPoolFactory.json';

export const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`;

export const USDC_ADDRESSES = {
  sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const,
  mainnet: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
};

export const contracts = {
  factory: { address: FACTORY_ADDRESS, abi: BracketPoolFactoryABI },
  pool: { abi: BracketPoolABI },
} as const;

export { BracketPoolABI, BracketPoolFactoryABI };
```

**Step 3: Commit**

```bash
git add web/src/lib/ && git commit -m "feat(web): add contract ABIs and addresses"
```

---

### Task 3.3: Pool List Page

**Files:**
- Create: `web/src/hooks/usePools.ts`
- Create: `web/src/components/PoolCard.tsx`
- Modify: `web/src/app/page.tsx`

**Step 1: Create usePools hook**

Create `web/src/hooks/usePools.ts`:
```typescript
import { useReadContract, useReadContracts } from 'wagmi';
import { contracts, FACTORY_ADDRESS, BracketPoolABI } from '@/lib/contracts';

export function usePools() {
  const { data: poolCount } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: contracts.factory.abi,
    functionName: 'getPoolCount',
  });

  const poolQueries = useReadContracts({
    contracts: Array.from({ length: Number(poolCount || 0) }, (_, i) => ({
      address: FACTORY_ADDRESS,
      abi: contracts.factory.abi as any,
      functionName: 'pools' as const,
      args: [BigInt(i)],
    })),
  });

  return {
    poolCount: Number(poolCount || 0),
    poolAddresses: poolQueries.data?.map(d => d.result as `0x${string}`) || [],
    isLoading: poolQueries.isLoading,
  };
}

export function usePoolDetails(address: `0x${string}`) {
  const results = useReadContracts({
    contracts: [
      { address, abi: BracketPoolABI as any, functionName: 'poolName' },
      { address, abi: BracketPoolABI as any, functionName: 'gameCount' },
      { address, abi: BracketPoolABI as any, functionName: 'lockTime' },
      { address, abi: BracketPoolABI as any, functionName: 'totalPoolValue' },
      { address, abi: BracketPoolABI as any, functionName: 'entryCount' },
      { address, abi: BracketPoolABI as any, functionName: 'getCurrentPrice' },
      { address, abi: BracketPoolABI as any, functionName: 'merkleRoot' },
      { address, abi: BracketPoolABI as any, functionName: 'cancelled' },
      { address, abi: BracketPoolABI as any, functionName: 'claimDeadline' },
    ],
  });

  const d = results.data || [];

  return {
    poolName: (d[0]?.result as string) || '',
    gameCount: Number(d[1]?.result || 0),
    lockTime: Number(d[2]?.result || 0),
    totalPoolValue: BigInt((d[3]?.result || 0).toString()),
    entryCount: Number(d[4]?.result || 0),
    currentPrice: BigInt((d[5]?.result || 0).toString()),
    merkleRoot: (d[6]?.result as string) || '0x' + '0'.repeat(64),
    cancelled: Boolean(d[7]?.result),
    claimDeadline: Number(d[8]?.result || 0),
    isLoading: results.isLoading,
  };
}
```

**Step 2: Create PoolCard component**

Create `web/src/components/PoolCard.tsx`:
```typescript
'use client';

import Link from 'next/link';
import { usePoolDetails } from '@/hooks/usePools';
import { formatUnits } from 'viem';

export function PoolCard({ address }: { address: `0x${string}` }) {
  const pool = usePoolDetails(address);

  const isLocked = Date.now() / 1000 > pool.lockTime;
  const isFinalized = pool.merkleRoot !== '0x' + '0'.repeat(64);

  const status = pool.cancelled ? 'Cancelled' : isFinalized ? 'Finalized' : isLocked ? 'Locked' : 'Open';
  const statusColor = pool.cancelled ? 'bg-red-200' : isFinalized ? 'bg-gray-200' : isLocked ? 'bg-yellow-200' : 'bg-green-200';

  return (
    <Link href={`/pool/${address}`}>
      <div className="border rounded-lg p-4 hover:border-blue-500 transition-colors">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold">{pool.poolName || 'Bracket Pool'}</h3>
          <span className={`px-2 py-1 rounded text-sm ${statusColor}`}>{status}</span>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Entries: {pool.entryCount}</p>
          <p>Pool Value: ${formatUnits(pool.totalPoolValue, 6)}</p>
          <p>Current Price: ${formatUnits(pool.currentPrice, 6)}</p>
          <p>Locks: {new Date(pool.lockTime * 1000).toLocaleString()}</p>
        </div>
      </div>
    </Link>
  );
}
```

**Step 3: Update home page**

Replace `web/src/app/page.tsx`:
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
            {poolAddresses.map((addr) => (
              <PoolCard key={addr} address={addr} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

**Step 4: Commit**

```bash
git add web/src/ && git commit -m "feat(web): add pool list page with cards"
```

---

### Task 3.4: Pool Detail Page

**Files:**
- Create: `web/src/app/pool/[address]/page.tsx`

**Step 1: Create pool detail page**

Create `web/src/app/pool/[address]/page.tsx`:
```typescript
'use client';

import { use } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePoolDetails } from '@/hooks/usePools';
import { formatUnits } from 'viem';
import Link from 'next/link';

export default function PoolPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const poolAddress = address as `0x${string}`;
  const pool = usePoolDetails(poolAddress);

  const isLocked = Date.now() / 1000 > pool.lockTime;
  const isFinalized = pool.merkleRoot !== '0x' + '0'.repeat(64);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/" className="text-blue-500 hover:underline">&larr; Back to Pools</Link>
            <h1 className="text-3xl font-bold mt-2">{pool.poolName || 'Pool Details'}</h1>
          </div>
          <ConnectButton />
        </div>
        <div className="bg-white border rounded-lg p-6 mb-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div><p className="text-gray-500">Status</p><p className="font-semibold">{pool.cancelled ? 'Cancelled' : isFinalized ? 'Finalized' : isLocked ? 'Locked' : 'Open'}</p></div>
            <div><p className="text-gray-500">Entries</p><p className="font-semibold">{pool.entryCount}</p></div>
            <div><p className="text-gray-500">Pool Value</p><p className="font-semibold">${formatUnits(pool.totalPoolValue, 6)} USDC</p></div>
            <div><p className="text-gray-500">Current Price</p><p className="font-semibold">${formatUnits(pool.currentPrice, 6)} USDC</p></div>
            <div><p className="text-gray-500">Lock Time</p><p className="font-semibold">{new Date(pool.lockTime * 1000).toLocaleString()}</p></div>
            <div><p className="text-gray-500">Claim Deadline</p><p className="font-semibold">{new Date(pool.claimDeadline * 1000).toLocaleString()}</p></div>
          </div>
        </div>
        {!isLocked && !pool.cancelled && !isFinalized && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Submit Your Bracket</h2>
            <p className="text-gray-600">Bracket picker component will be added here.</p>
          </div>
        )}
        <div className="mt-6"><p className="text-sm text-gray-500">Contract: {poolAddress}</p></div>
      </div>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add web/src/app/pool/ && git commit -m "feat(web): add pool detail page"
```

---

### Tasks 3.5–3.8: Bracket Picker, Entry, Claim, Refund UIs

These tasks follow the same pattern. Each is a React component + hook:

- **3.5 Bracket Picker:** Interactive bracket tree UI. `teams.ts` maps display names to bytes32 IDs. Produces `bytes32[67]` array + tiebreaker input.
- **3.6 Entry Submission:** Two-step USDC approve → `pool.enter()`. State machine: Idle → Approving → Submitting → Done.
- **3.7 Claim UI:** Fetch proof JSON from IPFS via `proofsCID`. Find user's entries, call `pool.claim(entryId, amount, proof)`.
- **3.8 Refund UI:** Show refund button when any of 3 refund conditions are met. Call `pool.refund(entryId)`.

These are implementation-heavy UI tasks. Each follows the pattern:
1. Create component file
2. Create/modify hook
3. Wire into pool detail page
4. Manual test with Anvil
5. Commit

---

## Phase 4: Integration Testing

### Task 4.1: Anvil Fork E2E

**Step 1: Start Anvil fork**

Run:
```bash
anvil --fork-url $SEPOLIA_RPC_URL
```

**Step 2: Deploy contracts**

Run:
```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

**Step 3: Create pool via cast**

```bash
cast send <FACTORY_ADDRESS> "createPool(string,uint256,uint256,uint256,uint256,uint256)" \
  "Test Pool" 67 $(date -v+7d +%s) $(date -v+37d +%s) 10000000 100 \
  --rpc-url http://localhost:8545 --private-key $PRIVATE_KEY
```

**Step 4: Mint USDC + submit entries from multiple accounts**

```bash
# Mint USDC to test accounts
cast send <USDC_ADDRESS> "mint(address,uint256)" $USER1 100000000000 --rpc-url http://localhost:8545
# Approve + enter for each user
```

**Step 5: Warp time, post results, run scorer**

```bash
# Warp past lock
cast rpc anvil_setNextBlockTimestamp $(date -v+8d +%s)
cast rpc anvil_mine

# Post results
cast send <POOL_ADDRESS> "setResults(bytes32[])" "[...]" --rpc-url http://localhost:8545 --private-key $ADMIN_KEY

# Run scorer
cd ../scorer && npx tsx src/index.ts <POOL_ADDRESS> http://localhost:8545 145
```

**Step 6: Post Merkle root, verify fee, claim prizes**

```bash
# Post root from scorer output
cast send <POOL_ADDRESS> "setMerkleRoot(bytes32)" <ROOT> --rpc-url http://localhost:8545 --private-key $ADMIN_KEY

# Verify fee went to treasury
cast call <USDC_ADDRESS> "balanceOf(address)" <TREASURY> --rpc-url http://localhost:8545

# Claim as winner
cast send <POOL_ADDRESS> "claim(uint256,uint256,bytes32[])" 0 <AMOUNT> "[<PROOF>]" --rpc-url http://localhost:8545 --private-key $USER1_KEY
```

**Step 7: Test refund paths**

```bash
# Test cancel + refund
# Test min entries refund
# Test deadline refund
```

---

## Verification Checklist

- [ ] `forge test` passes, >90% coverage on BracketPool.sol
- [ ] Factory creates pools with `admin == caller` (not factory address)
- [ ] `enter()` stores picksHash, emits full picks in event
- [ ] `enter()` reverts: after lock, wrong length, cancelled, insufficient approval
- [ ] Bonding curve increases price with pool value
- [ ] `setResults()` stores results, rejects non-admin / double-set / before lock
- [ ] `setMerkleRoot()` takes 5% fee, has `nonReentrant`, rejects without results
- [ ] `claim()` verifies Merkle proof, pays correct amount, prevents double-claim, enforces claimDeadline
- [ ] `cancelPool()` enables refunds
- [ ] `refund()` works for all 3 conditions (cancel / min entries / deadline)
- [ ] `setProofsCID()` stores CID, rejects without merkle root
- [ ] `sweepUnclaimed()` works after claimDeadline
- [ ] Scorer scoring matches: perfect = 1940, R0 = 5 pts
- [ ] Scorer Merkle tree proofs verify against contract
- [ ] Scorer output is deterministic
- [ ] Full E2E flow works on Anvil fork
