# Next Steps: Bracket Pool DApp

> **Last updated:** 2026-02-10
> **Branch:** `feature/development`
> **Status:** Phases 1-3 (partial) complete. Ready for manual integration testing before continuing frontend work.

---

## Current State

### What's Built and Working

| Phase | Component | Status | Tests |
|-------|-----------|--------|-------|
| 1 | Smart Contracts (Foundry) | Complete | 64 Solidity tests, 100% line coverage |
| 2 | Off-Chain Scorer (TypeScript) | Complete | 23 tests (scoring, ranking, merkle) |
| 3.1-3.4 | Frontend Setup + Read-Only Pages | Complete | Builds successfully (`npm run build`) |
| 3.5-3.8 | Frontend Interactive UI | Not started | — |
| 4 | Integration Testing | Not started | — |

### Project Structure

```
bracket-pool-dapp/
├── contracts/          # Solidity + Foundry (Phase 1)
│   ├── src/
│   │   ├── BracketPool.sol        # Main pool contract
│   │   └── BracketPoolFactory.sol # Factory for creating pools
│   ├── test/
│   │   ├── BracketPool.t.sol      # 58 tests
│   │   ├── BracketPoolFactory.t.sol # 6 tests
│   │   └── mocks/MockUSDC.sol     # Test helper (6-decimal ERC20)
│   ├── script/Deploy.s.sol        # Deployment script
│   └── foundry.toml
├── scorer/             # TypeScript scorer (Phase 2)
│   ├── src/
│   │   ├── scoring.ts   # getPointsForGame(), scoreEntry()
│   │   ├── ranking.ts   # rankEntries(), distributePrizes()
│   │   ├── merkle.ts    # buildMerkleTree()
│   │   ├── reader.ts    # readEntries(), readGameResults(), readTotalPoolValue()
│   │   ├── index.ts     # Main CLI pipeline
│   │   └── types.ts     # RawEntry, ScoredEntry, ScorerOutput
│   └── test/            # 23 vitest tests
├── web/                # Next.js frontend (Phase 3)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Pool list home page
│   │   │   ├── providers.tsx      # wagmi + RainbowKit providers
│   │   │   ├── layout.tsx
│   │   │   └── pool/[address]/page.tsx  # Pool detail page
│   │   ├── components/
│   │   │   └── PoolCard.tsx       # Pool card component
│   │   ├── hooks/
│   │   │   └── usePools.ts       # usePools, usePoolDetails, usePoolStatus
│   │   └── lib/
│   │       ├── wagmi.ts           # Wagmi config
│   │       ├── contracts.ts       # ABI + address exports
│   │       └── abis/              # Extracted from Foundry build
└── docs/               # Plans, analysis, decisions
    ├── phase-0-decisions.md
    ├── roadmap.md
    ├── analysis.md
    └── plans/2025-02-10-bracket-pool-implementation.md  # Full implementation plan
```

### Key Commands

```bash
# Run contract tests (from bracket-pool-dapp/contracts/)
forge test -vvv

# Run scorer tests (from bracket-pool-dapp/scorer/)
npx vitest run

# Build frontend (from bracket-pool-dapp/web/)
npm run build
```

---

## Step 1: Manual Integration Testing (Do This First)

Before building more frontend, we need to verify all three layers work together. Nothing has been tested end-to-end yet.

### 1A. Start Anvil (Local Ethereum Node)

Open a dedicated terminal. This stays running the whole time.

```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts
anvil
```

Anvil will print 10 test accounts with private keys and 10,000 ETH each. **Write down:**
- Account #0 address and private key (this will be the admin/deployer)
- Account #1 and #2 (these will be test entrants)
- The RPC URL (default: `http://127.0.0.1:8545`)

### 1B. Deploy Contracts to Anvil

In a new terminal:

```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/contracts

# Copy env example and fill in values
cp .env.example .env
```

Edit `.env` with:
```
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=<account #0 private key from anvil>
USDC_ADDRESS=<we'll deploy MockUSDC — see below>
TREASURY_ADDRESS=<account #0 address>
```

**Deploy MockUSDC first.** Since we're on a local fork, there's no real USDC. You'll need to deploy MockUSDC manually:

```bash
# Deploy MockUSDC (use anvil account #0 private key)
forge create test/mocks/MockUSDC.sol:MockUSDC \
  --rpc-url http://127.0.0.1:8545 \
  --private-key <account_0_private_key>
```

Copy the deployed MockUSDC address and put it in `.env` as `USDC_ADDRESS`.

**Then deploy the factory:**

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 \
  --private-key <account_0_private_key> \
  --broadcast
```

Copy the deployed BracketPoolFactory address — you'll need it for the frontend.

### 1C. Create a Test Pool

Use `cast` (Foundry CLI) to interact with the deployed factory:

```bash
# Create a pool via the factory
# Parameters: usdc, treasury, poolName, gameCount, lockTime, finalizeDeadline, basePrice, priceSlope
#
# lockTime: set to ~1 hour from now (unix timestamp)
# finalizeDeadline: set to ~2 hours from now
# basePrice: 10000000 (10 USDC, 6 decimals)
# priceSlope: 100 (1% bonding curve)

LOCK_TIME=$(($(date +%s) + 3600))
FINALIZE_DEADLINE=$(($(date +%s) + 7200))

cast send <FACTORY_ADDRESS> \
  "createPool(address,address,string,uint256,uint256,uint256,uint256,uint256)" \
  <MOCK_USDC_ADDRESS> <TREASURY_ADDRESS> "Test Pool 2026" 67 $LOCK_TIME $FINALIZE_DEADLINE 10000000 100 \
  --rpc-url http://127.0.0.1:8545 \
  --private-key <account_0_private_key>
```

Get the pool address:

```bash
cast call <FACTORY_ADDRESS> "getAllPools()" --rpc-url http://127.0.0.1:8545
```

### 1D. Submit Test Entries

```bash
POOL_ADDRESS=<from above>

# Mint USDC to test accounts
cast send <MOCK_USDC_ADDRESS> "mint(address,uint256)" <ACCOUNT_1> 100000000 \
  --rpc-url http://127.0.0.1:8545 --private-key <account_0_private_key>

cast send <MOCK_USDC_ADDRESS> "mint(address,uint256)" <ACCOUNT_2> 100000000 \
  --rpc-url http://127.0.0.1:8545 --private-key <account_0_private_key>

# Approve USDC spending for the pool
cast send <MOCK_USDC_ADDRESS> "approve(address,uint256)" $POOL_ADDRESS 100000000 \
  --rpc-url http://127.0.0.1:8545 --private-key <account_1_private_key>

# Submit an entry (67 bytes32 picks + tiebreaker)
# For testing, create 67 identical picks:
PICKS=$(python3 -c "print(','.join(['0x' + '01' * 32] * 67))")

cast send $POOL_ADDRESS \
  "enter(bytes32[],uint256)" "[$PICKS]" 145 \
  --rpc-url http://127.0.0.1:8545 --private-key <account_1_private_key>

# Repeat for account #2 with a different tiebreaker
cast send <MOCK_USDC_ADDRESS> "approve(address,uint256)" $POOL_ADDRESS 100000000 \
  --rpc-url http://127.0.0.1:8545 --private-key <account_2_private_key>

cast send $POOL_ADDRESS \
  "enter(bytes32[],uint256)" "[$PICKS]" 150 \
  --rpc-url http://127.0.0.1:8545 --private-key <account_2_private_key>
```

### 1E. Verify Frontend Reads Real Data

```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/web

# Create .env.local
cp .env.local.example .env.local
```

Edit `web/.env.local`:
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=PLACEHOLDER
NEXT_PUBLIC_FACTORY_ADDRESS=<deployed factory address>
```

```bash
npm run dev
```

Open http://localhost:3000 in your browser. **Verify:**
- [ ] Pool list page shows your test pool
- [ ] Pool card displays correct entry count (2), pool value, current price
- [ ] Click into pool detail page — all 6 fields populated correctly
- [ ] Status shows "Open" (since lockTime hasn't passed)
- [ ] ConnectButton appears (you don't need to connect a wallet for read-only)

### 1F. Test the Scorer Against Local Fork

```bash
cd /Users/claytonlowery/madness-app/bracket-pool-dapp/scorer

# First, warp time past lockTime on Anvil so we can post results
# In the Anvil terminal or via cast:
cast rpc anvil_setNextBlockTimestamp $(($(date +%s) + 3700)) --rpc-url http://127.0.0.1:8545
cast rpc anvil_mine 1 --rpc-url http://127.0.0.1:8545

# Post results (admin only, 67 bytes32 values)
RESULTS=$(python3 -c "print(','.join(['0x' + '01' * 32] * 67))")

cast send $POOL_ADDRESS \
  "setResults(bytes32[])" "[$RESULTS]" \
  --rpc-url http://127.0.0.1:8545 --private-key <account_0_private_key>

# Run the scorer
npx tsx src/index.ts $POOL_ADDRESS http://127.0.0.1:8545 145
```

**Verify scorer output:**
- [ ] Prints "Found 2 entries"
- [ ] Shows correct total pool value
- [ ] Calculates fee (5%) and prize pool
- [ ] Outputs a Merkle root
- [ ] Writes JSON file to `output-<address>.json`
- [ ] JSON contains entries with scores, ranks, and prize amounts

### 1G. Test Merkle Root + Claim Flow

```bash
# Read the Merkle root from scorer output
ROOT=$(cat output-*.json | python3 -c "import sys,json; print(json.load(sys.stdin)['merkleRoot'])")

# Post Merkle root (this also transfers 5% fee to treasury)
cast send $POOL_ADDRESS "setMerkleRoot(bytes32)" $ROOT \
  --rpc-url http://127.0.0.1:8545 --private-key <account_0_private_key>

# Verify fee was taken
cast call <MOCK_USDC_ADDRESS> "balanceOf(address)" <TREASURY_ADDRESS> --rpc-url http://127.0.0.1:8545
cast call <MOCK_USDC_ADDRESS> "balanceOf(address)" $POOL_ADDRESS --rpc-url http://127.0.0.1:8545
```

**Verify:**
- [ ] Treasury received 5% fee
- [ ] Pool balance = total pool value - fee
- [ ] Pool balance matches sum of prize amounts in scorer JSON

### 1H. Document Any Issues

If anything fails or behaves unexpectedly during testing, create a file:

```
docs/testing-issues.md
```

Document each issue with:
- What you did
- What you expected
- What actually happened
- Error messages (if any)

---

## Step 2: Build Remaining Frontend (Tasks 3.5-3.8)

Only start this after Step 1 passes. These tasks are detailed in the implementation plan at `docs/plans/2025-02-10-bracket-pool-implementation.md` (search for "Tasks 3.5-3.8").

### Task 3.5: Bracket Picker UI

**What to build:** An interactive bracket tree component where users select winners for all 67 games and enter a tiebreaker value.

**Files to create:**
- `web/src/components/BracketPicker.tsx` — interactive bracket UI
- `web/src/lib/teams.ts` — mapping of display names to bytes32 IDs

**Requirements:**
- User clicks to select winners in each game, advancing teams through rounds
- First Four (4 games) → Round of 64 (32) → Round of 32 (16) → Sweet 16 (8) → Elite 8 (4) → Final Four (2) → Championship (1)
- Tiebreaker input: "Predicted total points in the championship game"
- Output: `bytes32[67]` array of picks + `uint256` tiebreaker
- Wire into the pool detail page (replace the placeholder in the "Submit Your Bracket" section)

### Task 3.6: Entry Submission

**What to build:** Two-step USDC approve → `pool.enter()` flow.

**Files to create:**
- `web/src/hooks/useEnterPool.ts` — hook wrapping the approve + enter transaction flow
- `web/src/components/EntrySubmit.tsx` — UI component with state machine

**Requirements:**
- Read current price from `getCurrentPrice()`
- Step 1: `usdc.approve(poolAddress, price)` — wait for confirmation
- Step 2: `pool.enter(picks, tiebreaker)` — wait for confirmation
- State machine: Idle → Approving → Submitting → Done
- Show transaction hashes and status
- Handle errors (insufficient USDC, pool locked, etc.)
- Use `useWriteContract` from wagmi

**USDC ABI needed:** You'll need to add a minimal ERC20 ABI for the approve call. Create `web/src/lib/abis/ERC20.json` with just the `approve` and `allowance` functions, or use viem's built-in `erc20Abi`.

### Task 3.7: Claim UI

**What to build:** Interface for winners to claim their prizes.

**Files to create:**
- `web/src/hooks/useClaim.ts` — hook for claim transactions
- `web/src/components/ClaimPrize.tsx` — UI component

**Requirements:**
- Read `proofsCID` from contract
- Fetch proof JSON from IPFS gateway: `https://ipfs.io/ipfs/<cid>`
- Find connected user's entries in the proof data
- For each winning entry, show prize amount and "Claim" button
- Call `pool.claim(entryId, amount, proof)` — the Merkle proof from the JSON
- Show "Already claimed" for entries where `entryClaimed[entryId]` is true
- Show claim deadline warning if approaching

### Task 3.8: Refund UI

**What to build:** Refund button when eligible.

**Files to create:**
- `web/src/hooks/useRefund.ts` — hook for refund transactions
- `web/src/components/RefundEntry.tsx` — UI component

**Requirements:**
- Three refund conditions (any one triggers eligibility):
  1. `pool.cancelled() == true`
  2. `block.timestamp > lockTime` AND `entryCount < MIN_ENTRIES (2)` AND `merkleRoot == bytes32(0)`
  3. `block.timestamp > finalizeDeadline` AND `merkleRoot == bytes32(0)`
- Call `pool.refund(entryId)` for each user entry
- Show "Already refunded" for entries where `entryRefunded[entryId]` is true
- Read user's entries from `EntrySubmitted` events filtered by connected address

---

## Step 3: Integration Testing (Phase 4)

After Tasks 3.5-3.8 are complete, run a full end-to-end test on Anvil:

1. Deploy factory, create pool
2. Connect wallet in browser (MetaMask pointed at localhost:8545)
3. Pick a bracket using the bracket picker
4. Submit entry (approve + enter)
5. Warp time past lock, post results
6. Run scorer, post Merkle root
7. Claim prize in browser
8. Test refund flow (create a second pool, cancel it, claim refund)

This is described in detail in the implementation plan under "Phase 4: Integration Testing".

---

## Reference: Key Design Decisions

If you need to understand why something is built a certain way, read `docs/phase-0-decisions.md`. The most important ones:

- **67 games, 7 rounds** with scoring R0=5, R1=10, R2=20, R3=40, R4=80, R5=160, R6=320
- **Hash-only storage:** Contract stores `keccak256(abi.encodePacked(picks))`, full picks emitted in events
- **Fee formula:** `totalPoolValue * 500 / 10000` (5%) — scorer must use same integer division
- **Claim deadline:** `finalizeDeadline + 90 days`, then admin can sweep unclaimed funds
- **Tiebreaker:** Predicted championship total score, closest wins, ties split evenly

The full implementation plan is at `docs/plans/2025-02-10-bracket-pool-implementation.md`.

---

## Tips for Working with Claude

- Start your session by saying: "I'm picking up the bracket-pool-dapp project. Read `docs/next-steps.md` to get oriented."
- For building Tasks 3.5-3.8, you can say: "Use the subagent approach to implement Task 3.5 from the implementation plan"
- If something breaks during manual testing, describe the exact error and ask Claude to debug
- Always run `forge test` after any contract changes and `npm run build` after any frontend changes
- Commit frequently — one commit per logical change
