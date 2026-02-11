# Handoff — Hank Butler, Feb 10 2026

## What was done this session

### 1. Verified all three project layers build and pass tests
- **Contracts** (`contracts/`): `forge test -vvv` — all 64 tests pass
- **Scorer** (`scorer/`): `npm test` — all 23 tests pass
- **Web** (`web/`): `npm run build` — compiles and builds cleanly

### 2. Fixed environment issues
- **Node.js was v12.22.9** — far too old. Installed `nvm` and Node v20.20.0.
  - nvm is installed at `~/.nvm`. Make sure your shell loads it:
    ```bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    ```
  - If commands like `npm`, `node`, or `npx` fail, you probably need to run the above or open a new terminal.

- **wagmi v3 / RainbowKit v2 peer conflict** — `@rainbow-me/rainbowkit@2.2.10` requires `wagmi@^2.9.0`, but `package.json` had `wagmi@^3.4.3`. Downgraded to `wagmi@^2.19.5` in `web/package.json`.

- **Anvil chain not configured in frontend** — `web/src/lib/wagmi.ts` only had `sepolia` and `mainnet`. Added `foundry` (chain ID 31337) so the frontend can talk to the local Anvil node.

### 3. Deployed contracts to local Anvil
- Started Anvil: `cd contracts && anvil`
- Created `contracts/.env` with Anvil defaults:
  - Private key: Anvil account #0 (`0xac0974...`)
  - Treasury: Anvil account #1 (`0x70997970...`)
  - USDC address: placeholder (`0x...0001`) — no mock USDC deployed yet
- Deployed factory: `forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast`
- **Factory address: `0x5FbDB2315678afecb367f032d93F642f64180aa3`**

### 4. Created a test pool and verified frontend
- Created "March Madness 2026" pool via `cast send` (67 games, 10 USDC base price, 7-day lock, 30-day finalize deadline)
- **Pool address: `0xa16E02E87b7454126E5E10d957A927A7F5B5d2be`**
- Confirmed the pool card appears on `http://localhost:3000`

## Files changed (uncommitted)

| File | Change |
|------|--------|
| `web/package.json` | wagmi `^3.4.3` → `^2.19.5` |
| `web/package-lock.json` | Regenerated from fresh install |
| `web/src/lib/wagmi.ts` | Added `foundry` chain import and config |
| `contracts/.env` | Created (Anvil defaults — not tracked by git) |
| `web/.env.local` | Created with factory address (not tracked by git) |

## Current state

- Anvil is **not running** — you'll need to restart it and redeploy (addresses will be the same if Anvil starts fresh)
- The dev server is **not running** — start with `cd web && npm run dev`
- No mock USDC is deployed, so entry submission won't work yet
- The pool card shows on the frontend but all interactive features (bracket picker, entry submit, claim, refund) are not built yet

## How to get back to where we left off

```bash
# Terminal 1 — start Anvil
cd ~/Desktop/Projects/bracket-pool-dapp/contracts && anvil

# Terminal 2 — deploy contracts + create test pool
cd ~/Desktop/Projects/bracket-pool-dapp/contracts
export PATH="$HOME/.foundry/bin:$PATH"
source .env
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Create a test pool (adjust timestamps as needed)
cast send 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  "createPool(string,uint256,uint256,uint256,uint256,uint256)" \
  "March Madness 2026" 67 \
  $(( $(date +%s) + 86400 * 7 )) \
  $(( $(date +%s) + 86400 * 30 )) \
  10000000 100 \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Terminal 3 — start frontend
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd ~/Desktop/Projects/bracket-pool-dapp/web && npm run dev

# Open http://localhost:3000
```

## What's next

Refer to `docs/next-steps.md` for full details. The remaining work:

1. **Deploy a mock USDC** on Anvil so entry submission can work end-to-end
2. **Build interactive UI components** (Phase 3, tasks 3.5–3.8):
   - 3.5 — Bracket Picker (interactive bracket selection UI)
   - 3.6 — Entry Submission (USDC approve + `pool.enter()` flow)
   - 3.7 — Claim UI (Merkle proof-based prize claiming)
   - 3.8 — Refund UI (eligibility check + refund transaction)
3. **Full E2E integration testing** — connect MetaMask to localhost, pick bracket, submit entry, claim/refund
4. **Testnet deployment** — deploy to Sepolia with real USDC
