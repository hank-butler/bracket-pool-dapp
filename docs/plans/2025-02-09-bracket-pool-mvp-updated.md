# Bracket Pool DApp - Updated MVP Plan

## Context

The original plan (docs/plans/2025-01-31-bracket-pool-mvp.md) targeted Base with on-chain scoring. Our review identified two critical issues: (1) the `finalize()` loop hits the 60M block gas limit at ~358 entries, permanently locking all funds in any popular pool, and (2) the factory sets `admin = msg.sender` (the factory contract) making pools impossible to finalize. The target is millions of entries with a headline-level prize pot.

This updated plan targets **Ethereum L1**, replaces on-chain scoring with a **Merkle distributor pattern**, fixes the admin bug, and adds emergency mechanisms. The multisig stays for MVP; Chainlink CRE is the documented upgrade path.

## Architecture Overview

```
User calls enter() -> picks stored on-chain + emitted in event
                                    |
                     Off-chain scorer reads events
                     Scores all entries against results
                     Builds Merkle tree of winners
                                    |
Admin calls setResults() -> game outcomes stored on-chain
Admin calls setMerkleRoot() -> 5% fee taken, root stored
                                    |
Winners call claim(proof) -> contract verifies proof, pays USDC
```

## Specs

| Decision | Value |
|----------|-------|
| Network | Ethereum L1 (Sepolia testnet) |
| Payment | USDC only |
| Pick encoding | bytes32[] array (67 elements for March Madness) |
| Bonding curve | price = basePrice + (slope x totalPoolValue / 10000) |
| Entries per address | Unlimited |
| Entry edits | Not allowed |
| Scoring | ESPN-style: R1=10, R2=20, R3=40, R4=80, R5=160, R6=320 |
| Scoring location | Off-chain (deterministic, verifiable) |
| Prize distribution | Merkle proof claims (no on-chain loop) |
| Tiebreaker | Total combined score (final game) |
| Tie handling | Split prize evenly |
| Platform fee | 5% to treasury (taken at setMerkleRoot) |
| Finalization | 3-of-5 Gnosis Safe multisig |
| Emergency refund | After finalizeDeadline (lockTime + 30 days) |
| Pool cancellation | Admin can cancel, enabling refunds |
| Upgradeability | Immutable contracts |
| USDC (Sepolia) | 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 |
| USDC (Mainnet) | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 |

## Project Structure

```
bracket-pool-dapp/
  contracts/           Foundry project
    src/
      BracketPool.sol
      BracketPoolFactory.sol
    test/
      BracketPool.t.sol
      BracketPoolFactory.t.sol
      mocks/MockUSDC.sol
    script/
      Deploy.s.sol
    .env.example
  scorer/              Off-chain scoring service (TypeScript)
    src/
      index.ts         Main pipeline
      scoring.ts       ESPN scoring logic
      merkle.ts        Merkle tree builder
      reader.ts        On-chain event reader
      types.ts
    test/
      scoring.test.ts
      merkle.test.ts
  web/                 Next.js 14 frontend
    src/
      app/
      components/
      hooks/
      lib/
```

---

## Phase 1: Smart Contracts

### Task 1.0: Project Scaffolding

**Files:** `.gitignore` (replace), `contracts/foundry.toml`, `contracts/remappings.txt`

- Replace Python-focused `.gitignore` with one covering Foundry (`out/`, `cache/`), Node (`node_modules/`), Next.js (`.next/`), env files
- `forge init --no-commit contracts`
- `cd contracts && forge install OpenZeppelin/openzeppelin-contracts --no-commit`
- `remappings.txt`: `@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/`
- `foundry.toml`: solc 0.8.24, optimizer on (200 runs), Sepolia + mainnet RPC endpoints
- Verify: `forge build`
- Commit: `chore: scaffold Foundry project with OpenZeppelin`

### Task 1.1: MockUSDC Test Helper

**Create:** `contracts/test/mocks/MockUSDC.sol`

ERC20 with 6 decimals and public `mint()`. Used by all test files.

Commit: `test(contracts): add MockUSDC helper`

### Task 1.2: BracketPool Constructor + Initialization

**Create:** `contracts/src/BracketPool.sol`, `contracts/test/BracketPool.t.sol`

**BracketPool.sol** — Full contract skeleton:

```solidity
constructor(
    address _usdc,
    address _treasury,
    address _admin,          // FIX: explicit param, not msg.sender
    string memory _poolName,
    uint256 _gameCount,
    uint256 _lockTime,
    uint256 _finalizeDeadline,  // NEW: lockTime + 30 days
    uint256 _basePrice,
    uint256 _priceSlope
)
```

Imports: IERC20, SafeERC20, ReentrancyGuard, MerkleProof (all OpenZeppelin)

State:
- Immutables: usdc, treasury, admin, gameCount, lockTime, finalizeDeadline, basePrice, priceSlope
- Constants: FEE_PERCENT=500, BASIS_POINTS=10000, MIN_ENTRIES=2
- Mutable: poolName, totalPoolValue, entryCount, cancelled, merkleRoot, gameResults[]
- Mappings: entries (id->Entry), userEntryIds (addr->id[]), entryClaimed, entryRefunded

Entry struct: `{ address owner, bytes32[] picks, uint256 tiebreaker, uint256 pricePaid }`

Events: EntrySubmitted (includes full picks[]), ResultsPosted, MerkleRootSet, PrizeClaimed, PoolCancelled, EntryRefunded, FeePaid

**Tests:** initialization assertions, constructor revert cases (zero addresses, lock in past, deadline before lock)

Verify: `forge test --match-test test_initialization -vvv`
Commit: `feat(contracts): add BracketPool constructor with initialization tests`

### Task 1.3: getCurrentPrice()

Already in constructor skeleton. Add tests:
- Empty pool returns basePrice
- After entries, price increases per formula

Commit: `test(contracts): add bonding curve pricing tests`

### Task 1.4: enter()

**Modify:** `BracketPool.sol`, `BracketPool.t.sol`

```solidity
function enter(bytes32[] calldata picks, uint256 tiebreaker) external nonReentrant {
    require(block.timestamp < lockTime, "Pool is locked");
    require(!cancelled, "Pool is cancelled");
    require(picks.length == gameCount, "Invalid picks length");
    uint256 price = getCurrentPrice();
    usdc.safeTransferFrom(msg.sender, address(this), price);
    // Store entry, update state, emit EntrySubmitted with full picks
}
```

Key: event includes `bytes32[] picks` so scorer can read entries from logs.

View functions: `getEntry()`, `getUserEntryIds()`, `getEntryPicks()`, `getGameResults()`

**Tests:** success, emits event, multiple entries increase price, reverts (after lock, wrong length, cancelled, insufficient approval)

Verify: `forge test --match-test test_enter -vvv`
Commit: `feat(contracts): add enter() with bonding curve pricing`

### Task 1.5: setResults()

```solidity
function setResults(bytes32[] calldata results) external {
    require(msg.sender == admin, "Not authorized");
    require(block.timestamp >= lockTime, "Pool not locked yet");
    require(gameResults.length == 0, "Results already posted");
    require(results.length == gameCount, "Invalid results length");
    gameResults = results;
    emit ResultsPosted(results);
}
```

**Tests:** success, revert not admin, revert before lock, revert double-set, revert wrong length

Commit: `feat(contracts): add setResults()`

### Task 1.6: setMerkleRoot()

```solidity
function setMerkleRoot(bytes32 root) external {
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

Fee is taken once here (not per-claim). Remaining balance = full prize pool.

**Tests:** success + fee check, revert no results, revert double-set, revert zero root, revert < MIN_ENTRIES

Commit: `feat(contracts): add setMerkleRoot() with fee distribution`

### Task 1.7: claim()

```solidity
function claim(uint256 entryId, uint256 amount, bytes32[] calldata proof) external nonReentrant {
    require(merkleRoot != bytes32(0), "Not finalized");
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

Double-hash leaf matches OpenZeppelin StandardMerkleTree convention.

**Tests:** success with hand-built 2-leaf tree, revert invalid proof, revert double-claim, revert not owner, revert no merkle root

Commit: `feat(contracts): add claim() with Merkle proof verification`

### Task 1.8: cancelPool() + refund()

```solidity
function cancelPool() external {
    require(msg.sender == admin, "Not authorized");
    require(merkleRoot == bytes32(0), "Already finalized");
    cancelled = true;
    emit PoolCancelled();
}

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

Three refund paths: (1) cancelled, (2) < MIN_ENTRIES after lock, (3) past finalizeDeadline without finalization.

**Tests:** refund after cancel, refund not enough entries, refund after deadline, revert not owner, revert double-refund, revert no condition met, cancel revert not admin, cancel revert already finalized

Commit: `feat(contracts): add cancelPool() and refund() with emergency mechanisms`

### Task 1.9: BracketPoolFactory

**Create:** `contracts/src/BracketPoolFactory.sol`, `contracts/test/BracketPoolFactory.t.sol`

```solidity
function createPool(
    string calldata _poolName,
    uint256 _gameCount,
    uint256 _lockTime,
    uint256 _finalizeDeadline,
    uint256 _basePrice,
    uint256 _priceSlope
) external onlyOwner returns (address) {
    BracketPool pool = new BracketPool(
        usdc, treasury,
        msg.sender,       // admin = multisig (the onlyOwner caller)
        _poolName, _gameCount, _lockTime, _finalizeDeadline, _basePrice, _priceSlope
    );
    pools.push(address(pool));
    emit PoolCreated(address(pool), _poolName, _gameCount);
    return address(pool);
}
```

**Critical test:** `pool.admin() == admin` (not `address(factory)`) — this verifies the admin bug fix.

Commit: `feat(contracts): add BracketPoolFactory with admin passthrough fix`

### Task 1.10: Deployment Script + Env

**Create:** `contracts/script/Deploy.s.sol`, `contracts/.env.example`

Deploy script deploys factory with USDC + treasury addresses from env.
Env example includes Sepolia and mainnet USDC addresses, RPC URLs, Etherscan key.

Commit: `feat(contracts): add deployment script`

### Task 1.11: Full Test Suite

- `forge test -vvv` — all pass
- `forge coverage` — target 90%+ on BracketPool.sol
- Add fuzz tests for getCurrentPrice, edge cases for claim/refund interactions

Commit: `test(contracts): complete test suite`

---

## Phase 2: Off-Chain Scoring Service

### Task 2.1: Initialize Scorer

```bash
cd scorer && npm init -y
npm install typescript @openzeppelin/merkle-tree viem dotenv
npm install -D @types/node vitest tsx
```

**Create:** `package.json`, `tsconfig.json`, `src/types.ts`

Commit: `chore(scorer): initialize TypeScript project`

### Task 2.2: Scoring Logic

**Create:** `scorer/src/scoring.ts`, `scorer/test/scoring.test.ts`

`getPointsForGame(i)` — same boundaries as contract (0-3: 10, 4-35: 10, 36-51: 20, 52-59: 40, 60-63: 80, 64-65: 160, 66: 320)

`scoreEntry(picks, results)` — compare each pick to result, sum points

**Tests:** perfect bracket = 1960, all wrong = 0, only championship correct = 320

Commit: `feat(scorer): add ESPN-style scoring logic with tests`

### Task 2.3: Merkle Tree Builder

**Create:** `scorer/src/merkle.ts`, `scorer/test/merkle.test.ts`

Uses `@openzeppelin/merkle-tree` `StandardMerkleTree.of(values, ['address', 'uint256', 'uint256'])`.

Leaf encoding: `[ownerAddress, entryId, prizeAmount]` — matches the double-hash pattern in the claim() function.

Commit: `feat(scorer): add Merkle tree builder`

### Task 2.4: Event Reader

**Create:** `scorer/src/reader.ts`

Uses viem to read `EntrySubmitted` events and `getGameResults()` from the pool contract.

Commit: `feat(scorer): add on-chain event reader`

### Task 2.5: Main Pipeline

**Create:** `scorer/src/index.ts`

Pipeline: read entries -> score all -> rank by score + tiebreaker -> calculate prizes (total - 5% fee / winners) -> build Merkle tree -> output JSON with root + all proofs.

CLI: `npx tsx src/index.ts <poolAddress> <rpcUrl> <actualTiebreaker>`

Output JSON includes: root, every entry's score/rank, and Merkle proofs for winners.

Commit: `feat(scorer): add main scoring pipeline`

---

## Phase 3: Frontend

### Task 3.1: Initialize Next.js
- `npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir`
- `npm install wagmi viem @rainbow-me/rainbowkit @tanstack/react-query`
- wagmi config: `sepolia` + `mainnet` chains (not Base)
- Providers: WagmiProvider + QueryClientProvider + RainbowKitProvider

Commit: `feat(web): initialize Next.js with wagmi + RainbowKit`

### Task 3.2: Contract ABIs + Addresses
- Extract ABIs from Foundry build output
- `contracts.ts` with Sepolia + mainnet addresses

Commit: `feat(web): add contract ABIs and addresses`

### Task 3.3: Pool List Page
- `usePools` hook reads factory poolCount + pool addresses
- `PoolCard` component shows name, entries, pool value, status, price
- Home page lists all pools with ConnectButton

Commit: `feat(web): add pool list page`

### Task 3.4: Pool Detail Page
- `/pool/[address]` route
- Shows full pool details, status, user's entries
- Conditional sections: bracket picker (if open), claim (if finalized), refund (if eligible)

Commit: `feat(web): add pool detail page`

### Task 3.5: Bracket Picker
- Interactive bracket tree UI
- `teams.ts` maps display names to bytes32 IDs
- Produces bytes32[67] array + tiebreaker input

Commit: `feat(web): add bracket picker component`

### Task 3.6: Entry Submission
- Two-step: USDC approve -> pool.enter()
- State machine: Idle -> Approving -> Submitting -> Done

Commit: `feat(web): add entry submission flow`

### Task 3.7: Claim UI
- Fetches scorer output JSON for the pool
- Finds user's winning entries + proofs
- Calls pool.claim(entryId, amount, proof)

Commit: `feat(web): add claim UI`

### Task 3.8: Refund UI
- Shows refund button when conditions met
- Calls pool.refund(entryId)

Commit: `feat(web): add refund UI`

---

## Phase 4: Integration Testing

### Task 4.1: Anvil Fork E2E

1. `anvil --fork-url $SEPOLIA_RPC_URL`
2. Deploy factory, create pool via cast
3. Mint USDC to test accounts, submit entries
4. Warp time past lock, post results
5. Run scorer against local fork
6. Post Merkle root, claim prizes
7. Verify USDC balances

### Task 4.2: Frontend Manual E2E

Point web at localhost:8545, walk through full flow with MetaMask.

---

## Verification Checklist

- [ ] `forge test` passes, 90%+ coverage on BracketPool.sol
- [ ] Factory creates pools with correct admin (not factory address)
- [ ] enter() stores picks + emits full event data
- [ ] enter() reverts: after lock, wrong length, cancelled
- [ ] Bonding curve increases price with pool value
- [ ] setResults() stores results, rejects non-admin / double-set
- [ ] setMerkleRoot() takes 5% fee, rejects without results
- [ ] claim() verifies Merkle proof, pays correct amount, prevents double-claim
- [ ] cancelPool() enables refunds
- [ ] refund() works for all 3 conditions (cancel / min entries / deadline)
- [ ] refund() prevents double-refund and refund-after-claim
- [ ] Scorer output is deterministic (same input = same root)
- [ ] Scorer Merkle root matches contract verification
- [ ] Full E2E flow works on Anvil fork

## Deployment Checklist

1. [ ] Deploy 3-of-5 Gnosis Safe on Sepolia
2. [ ] Deploy BracketPoolFactory to Sepolia
3. [ ] Transfer factory ownership to Safe
4. [ ] Verify contracts on Etherscan
5. [ ] Create test pool, run full flow on Sepolia
6. [ ] Deploy frontend to Vercel
7. [ ] Mainnet: audit/review, deploy, transfer ownership

## Future: Chainlink CRE Upgrade Path

The contract already separates concerns: `setResults()` posts game data, `setMerkleRoot()` posts the scored outcome. To upgrade:

1. Add an `oracle` role alongside `admin`
2. CRE workflow fetches game results from SportsDataIO, reaches DON consensus, calls `setResults()`
3. Off-chain scorer (or CRE workflow) computes Merkle root, posts via `setMerkleRoot()`
4. No structural changes to the Merkle claim pattern needed

CRE is in Early Access (launched Nov 2025). Apply at chain.link/cre-early-access.
