# Token Allowlist Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an admin-managed stablecoin allowlist to `BracketPoolFactory` so `createPool` reverts for non-approved tokens.

**Architecture:** Remove the factory-level `token` immutable and move it to a per-`createPool` parameter. Add `mapping(address => bool) public allowedTokens` with `addToken`/`removeToken` owner functions. The constructor seeds the allowlist from an `address[]`. `BracketPool` is unchanged — it already takes `_token` as a constructor arg. Frontend gets a token address input in `CreatePoolForm` and two new admin hooks.

**Tech Stack:** Solidity 0.8.24, Foundry, Next.js 16, wagmi v2, viem

---

## Task 1: Update `BracketPoolFactory.sol`

**Files:**
- Modify: `contracts/src/BracketPoolFactory.sol`

**Step 1: Replace the file contents**

```solidity
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
```

**Step 2: Compile to check for errors**

```bash
cd contracts && forge build
```

Expected: compilation succeeds (test files will fail until Task 2 — that's OK at this stage).

---

## Task 2: Update `BracketPoolFactory.t.sol`

**Files:**
- Modify: `contracts/test/BracketPoolFactory.t.sol`

**Step 1: Replace the file contents**

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
    MockUSDC public usdt;

    address public admin = address(1);
    address public treasury = address(2);

    function setUp() public {
        usdc = new MockUSDC();
        usdt = new MockUSDC();

        address[] memory initialTokens = new address[](1);
        initialTokens[0] = address(usdc);

        vm.prank(admin);
        factory = new BracketPoolFactory(treasury, initialTokens);
    }

    function test_factory_initialization() public view {
        assertEq(factory.owner(), admin);
        assertEq(factory.treasury(), treasury);
        assertEq(factory.getPoolCount(), 0);
        assertTrue(factory.allowedTokens(address(usdc)));
        assertFalse(factory.allowedTokens(address(usdt)));
    }

    // --- Allowlist tests ---

    function test_addToken_success() public {
        vm.prank(admin);
        factory.addToken(address(usdt));
        assertTrue(factory.allowedTokens(address(usdt)));
    }

    function test_addToken_revert_notOwner() public {
        vm.prank(address(99));
        vm.expectRevert();
        factory.addToken(address(usdt));
    }

    function test_removeToken_success() public {
        vm.prank(admin);
        factory.removeToken(address(usdc));
        assertFalse(factory.allowedTokens(address(usdc)));
    }

    function test_removeToken_revert_notOwner() public {
        vm.prank(address(99));
        vm.expectRevert();
        factory.removeToken(address(usdc));
    }

    function test_createPool_revert_tokenNotAllowed() public {
        vm.prank(admin);
        vm.expectRevert("Token not allowed");
        factory.createPool(
            address(usdt),
            "Test Pool",
            67,
            block.timestamp + 7 days,
            block.timestamp + 37 days,
            10e6,
            100,
            0
        );
    }

    function test_removeToken_doesNotAffectExistingPools() public {
        vm.startPrank(admin);
        address poolAddr = factory.createPool(
            address(usdc),
            "mm:March Madness 2026",
            63,
            block.timestamp + 7 days,
            block.timestamp + 37 days,
            10e6,
            0,
            0
        );

        // Remove usdc from allowlist
        factory.removeToken(address(usdc));
        vm.stopPrank();

        // Existing pool still uses usdc correctly
        BracketPool pool = BracketPool(poolAddr);
        assertEq(pool.token(), address(usdc));

        // But new pool creation is now blocked
        vm.prank(admin);
        vm.expectRevert("Token not allowed");
        factory.createPool(
            address(usdc),
            "Another Pool",
            63,
            block.timestamp + 7 days,
            block.timestamp + 37 days,
            10e6,
            0,
            0
        );
    }

    // --- createPool tests ---

    function test_createPool_success() public {
        vm.prank(admin);
        address poolAddr = factory.createPool(
            address(usdc),
            "mm:March Madness 2026",
            67,
            block.timestamp + 7 days,
            block.timestamp + 37 days,
            10e6,
            100,
            0
        );

        assertTrue(poolAddr != address(0));
        assertEq(factory.getPoolCount(), 1);
        assertEq(factory.pools(0), poolAddr);

        BracketPool pool = BracketPool(poolAddr);
        assertEq(pool.admin(), admin);
        assertEq(pool.gameCount(), 67);
        assertEq(pool.basePrice(), 10e6);
        assertEq(pool.token(), address(usdc));
    }

    function test_createPool_adminIsCallerNotFactory() public {
        vm.prank(admin);
        address poolAddr = factory.createPool(
            address(usdc),
            "Test Pool",
            67,
            block.timestamp + 7 days,
            block.timestamp + 37 days,
            10e6,
            100,
            0
        );

        BracketPool pool = BracketPool(poolAddr);
        assertEq(pool.admin(), admin);
        assertTrue(pool.admin() != address(factory));
    }

    function test_createPool_revert_notOwner() public {
        vm.prank(address(99));
        vm.expectRevert();
        factory.createPool(address(usdc), "Test", 67, block.timestamp + 7 days, block.timestamp + 37 days, 10e6, 100, 0);
    }

    function test_createMultiplePools() public {
        vm.startPrank(admin);
        factory.createPool(address(usdc), "Pool 1", 67, block.timestamp + 7 days, block.timestamp + 37 days, 10e6, 100, 0);
        factory.createPool(address(usdc), "Pool 2", 67, block.timestamp + 14 days, block.timestamp + 44 days, 20e6, 50, 0);
        factory.createPool(address(usdc), "Pool 3", 67, block.timestamp + 21 days, block.timestamp + 51 days, 5e6, 200, 0);
        vm.stopPrank();

        assertEq(factory.getPoolCount(), 3);
    }

    function test_getAllPools() public {
        vm.startPrank(admin);
        address p1 = factory.createPool(address(usdc), "Pool 1", 67, block.timestamp + 7 days, block.timestamp + 37 days, 10e6, 100, 0);
        address p2 = factory.createPool(address(usdc), "Pool 2", 67, block.timestamp + 14 days, block.timestamp + 44 days, 20e6, 50, 0);
        vm.stopPrank();

        address[] memory allPools = factory.getAllPools();
        assertEq(allPools.length, 2);
        assertEq(allPools[0], p1);
        assertEq(allPools[1], p2);
    }
}
```

**Step 2: Run tests**

```bash
cd contracts && forge test --match-contract BracketPoolFactoryTest -v
```

Expected: all factory tests pass (should be ~11 tests).

**Step 3: Run full test suite**

```bash
cd contracts && forge test
```

Expected: all tests pass (73+ tests — the BracketPool tests are unaffected since the pool contract didn't change).

**Step 4: Commit**

```bash
git add contracts/src/BracketPoolFactory.sol contracts/test/BracketPoolFactory.t.sol
git commit -m "feat: add token allowlist to BracketPoolFactory"
```

---

## Task 3: Update deploy scripts

**Files:**
- Modify: `contracts/script/DeployLocal.s.sol`
- Modify: `contracts/script/CreateSmokeTestPool.s.sol` (if it calls `createPool`)

**Step 1: Read `CreateSmokeTestPool.s.sol` to check its factory call**

```bash
cat contracts/script/CreateSmokeTestPool.s.sol
```

**Step 2: Update `contracts/script/DeployLocal.s.sol`**

Change the factory constructor and `createPool` call:

```solidity
// 2. Deploy Factory — seed allowlist with MockUSDC
address[] memory initialTokens = new address[](1);
initialTokens[0] = address(usdc);
BracketPoolFactory factory = new BracketPoolFactory(deployer, initialTokens);
console.log("Factory deployed at:", address(factory));

// 3. Create a test pool
address pool = factory.createPool(
    address(usdc),       // token — first arg now
    "mm:March Madness 2026",
    63,
    lockTime,
    finalizeDeadline,
    basePrice,
    priceSlope,
    0  // unlimited entries
);
```

**Step 3: Update `CreateSmokeTestPool.s.sol`** — add `address(usdc)` (or the token loaded from env) as the first arg to `createPool`. Read the file first to confirm the exact call site.

**Step 4: Compile to verify**

```bash
cd contracts && forge build
```

Expected: clean compile, no errors.

**Step 5: Commit**

```bash
git add contracts/script/
git commit -m "feat: update deploy scripts for token allowlist factory interface"
```

---

## Task 4: Regenerate frontend ABI

**Files:**
- Modify: `web/src/lib/abis/BracketPoolFactory.json`

**Step 1: Extract the ABI from compiled output**

```bash
cd contracts && forge build --silent
cat out/BracketPoolFactory.sol/BracketPoolFactory.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d['abi'], indent=2))"
```

**Step 2: Update `web/src/lib/abis/BracketPoolFactory.json`**

Replace the file contents with the ABI printed above. Verify it includes:
- `allowedTokens` (view function, takes `address`, returns `bool`)
- `addToken` (nonpayable, takes `address`)
- `removeToken` (nonpayable, takes `address`)
- `TokenAdded` event
- `TokenRemoved` event
- Updated `createPool` signature with `_token` as first parameter
- No `token()` view function (it was removed)

**Step 3: Check the frontend build compiles**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: TypeScript may flag `token()` call in `usePools.ts` — fix in Task 5 if it does.

**Step 4: Commit**

```bash
git add web/src/lib/abis/BracketPoolFactory.json
git commit -m "chore: regenerate BracketPoolFactory ABI with token allowlist"
```

---

## Task 5: Update `usePools.ts` — remove factory `token()` read

**Files:**
- Modify: `web/src/hooks/usePools.ts`

**Step 1: Read the file**

```bash
cat web/src/hooks/usePools.ts
```

**Step 2: Find and remove any `functionName: 'token'` call on the factory**

The factory no longer has a `token()` view function. If `usePools.ts` calls `factory.token()`, remove that read hook. Pool-level token reads (`pool.token()`) are unaffected — `BracketPool` still has `token()`.

**Step 3: Build to verify**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: clean build, no TypeScript errors.

**Step 4: Commit if changes were made**

```bash
git add web/src/hooks/usePools.ts
git commit -m "fix: remove factory.token() read (factory no longer has single token)"
```

---

## Task 6: Add `useAddToken` / `useRemoveToken` hooks

**Files:**
- Modify: `web/src/hooks/useAdminPool.ts`

**Step 1: Add the two hooks at the end of the file**

```typescript
export function useAddToken() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function addToken(tokenAddress: `0x${string}`) {
    writeContract({
      address: FACTORY_ADDRESS,
      abi: contracts.factory.abi,
      functionName: 'addToken',
      args: [tokenAddress],
    });
  }

  return { addToken, isPending, isConfirming, isSuccess, error };
}

export function useRemoveToken() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function removeToken(tokenAddress: `0x${string}`) {
    writeContract({
      address: FACTORY_ADDRESS,
      abi: contracts.factory.abi,
      functionName: 'removeToken',
      args: [tokenAddress],
    });
  }

  return { removeToken, isPending, isConfirming, isSuccess, error };
}
```

**Step 2: Update `useCreatePool` to include `token` as first arg**

Change the `args` in `createPool` to add `args.token` as the first element:

```typescript
function createPool(args: {
  token: `0x${string}`;   // add this
  poolName: string;
  gameCount: number;
  lockTime: number;
  finalizeDeadline: number;
  basePrice: bigint;
  priceSlope: bigint;
  maxEntries: number;
}) {
  writeContract({
    address: FACTORY_ADDRESS,
    abi: contracts.factory.abi,
    functionName: 'createPool',
    args: [
      args.token,           // add this as first arg
      args.poolName,
      BigInt(args.gameCount),
      BigInt(args.lockTime),
      BigInt(args.finalizeDeadline),
      args.basePrice,
      args.priceSlope,
      BigInt(args.maxEntries),
    ],
  });
}
```

**Step 3: Build to check for type errors**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: TypeScript will flag `CreatePoolForm.tsx` for missing `token` prop — fix in Task 7.

**Step 4: Commit**

```bash
git add web/src/hooks/useAdminPool.ts
git commit -m "feat: add useAddToken/useRemoveToken hooks, add token arg to useCreatePool"
```

---

## Task 7: Update `CreatePoolForm.tsx` — add token field

**Files:**
- Modify: `web/src/components/CreatePoolForm.tsx`

**Step 1: Add token state and known stables**

Add after the existing imports:

```typescript
import { isAddress } from 'viem';

// Well-known stables — frontend hint only; contract enforces the real allowlist
const KNOWN_STABLES = [
  { label: 'USDC (Sepolia)', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' },
  { label: 'Custom address...', address: '' },
];
```

Add token state alongside the other `useState` declarations:

```typescript
const [token, setToken] = useState(KNOWN_STABLES[0].address as `0x${string}`);
const [tokenInput, setTokenInput] = useState(KNOWN_STABLES[0].address);
```

**Step 2: Add token field to the form JSX**

Add a new `<div>` before the Lock Time field:

```tsx
<div>
  <label className="block text-sm font-bold mb-1">Payment Token</label>
  <select
    className="input-90s w-full mb-1"
    value={KNOWN_STABLES.find(s => s.address === tokenInput)?.address ?? ''}
    onChange={e => {
      setTokenInput(e.target.value);
      if (isAddress(e.target.value)) setToken(e.target.value as `0x${string}`);
    }}
  >
    {KNOWN_STABLES.map(s => (
      <option key={s.label} value={s.address}>{s.label}</option>
    ))}
  </select>
  {!KNOWN_STABLES.find(s => s.address === tokenInput && s.address !== '') && (
    <input
      className="input-90s w-full font-mono text-xs"
      placeholder="0x..."
      value={tokenInput}
      onChange={e => {
        setTokenInput(e.target.value);
        if (isAddress(e.target.value)) setToken(e.target.value as `0x${string}`);
      }}
    />
  )}
</div>
```

**Step 3: Pass `token` to `createPool` in `handleSubmit`**

```typescript
function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!isAddress(token)) { alert('Invalid token address'); return; }
  createPool({
    token,                             // add this
    poolName: `${sport.prefix}${poolName}`,
    gameCount: sport.gameCount,
    lockTime: Math.floor(new Date(lockTime).getTime() / 1000),
    finalizeDeadline: Math.floor(new Date(finalizeDeadline).getTime() / 1000),
    basePrice: parseUnits(basePrice, 6),
    priceSlope: BigInt(priceSlope),
    maxEntries: parseInt(maxEntries, 10),
  });
}
```

**Step 4: Final build**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: clean build, no TypeScript errors.

**Step 5: Commit**

```bash
git add web/src/components/CreatePoolForm.tsx
git commit -m "feat: add payment token field to CreatePoolForm"
```

---

## Task 8: Push and update PR

**Step 1: Push**

```bash
git push origin feature/contract-updates
```

**Step 2: Verify PR #7 shows all new commits**

```bash
gh pr view 7
```

Expected: PR shows the new commits. Clayton can re-review.
