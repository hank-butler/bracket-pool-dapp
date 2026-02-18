# Handoff — 2026-02-17 — HB

> **Author:** HB | **Date:** 2026-02-17

## Project Status

The MVP is fully deployed to Sepolia testnet with a live frontend on Vercel. A test pool has been created and a bracket entry successfully submitted via the live site. The full E2E cycle (scorer → Merkle root → claim) still needs to be completed once the test pool's lock time passes.

| Layer | Status | Tests |
|-------|--------|-------|
| Smart Contracts (Foundry) | Complete | 64 tests pass |
| Off-Chain Scorer (TypeScript) | Complete | Pre-existing Node.js version issue (needs Node 16+) |
| Frontend (Next.js + wagmi) | Complete | Live on Vercel, manually E2E verified |

## What Was Done This Session

- **Deployed frontend to Vercel** at `https://bracket-pool-dapp.vercel.app/`
  - Root directory set to `web/`
  - Env vars added to Vercel dashboard: `NEXT_PUBLIC_FACTORY_ADDRESS`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- **Fixed chain ordering bug** — wagmi config had `foundry` first, causing reads to default to localhost when no wallet connected; moved `sepolia` first (commit `9b40b2d`)
- **Merged `feature/real-teams-2025` → `main`** via PR #3
- **Created test pool on Sepolia** via `cast send` against the factory
  - Pool address: `0x5eBca3ae0c84F597C922f3B0A8B2631b8049BCc3`
  - Lock time: 2 hours after creation, Finalize deadline: 7 days
  - Base price: 10 USDC, slope: 1%
- **Successfully submitted a bracket entry** via the live Vercel site on Sepolia — full entry flow verified

## What's Next

1. **Complete the Sepolia E2E cycle** — after pool lock time passes:
   - Run scorer: `tsx src/index.ts <poolAddress> <rpcUrl> <tiebreaker>` from `scorer/`
   - Post Merkle root via `cast send` or admin UI
   - Claim prize via browser
2. **Fix Node.js version** — scorer and `npm run build` require Node 16+; install via `nvm`
3. **Production readiness** — security audit/peer review, mainnet deploy, Gnosis Safe multisig for admin/treasury, verify contracts on mainnet Etherscan
4. **World Cup 2026 pivot** — Phase B (`sportId` in contracts), Phase C (shared sports config), Phase D (World Cup bracket picker UI). Design doc: `docs/plans/2025-02-10-world-cup-pivot-design.md`

## Current Branch State

- **Branch:** `main`
- **Pushed:** Yes, up to date with `origin/main`
- **Open PR:** None
- **Uncommitted:** Only untracked files (`claude.md`, `docs/handoff-hb-2026-02-11.md`, `docs/screenshots/`) — none blocking

## Local Development Setup

Anvil state resets on restart. To get back to a working state locally:

```bash
# Terminal 1 — start Anvil
cd contracts
~/.foundry/bin/anvil

# Terminal 2 — deploy contracts
cd contracts
export PATH="$HOME/.foundry/bin:$PATH"
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
# Note the Factory and MockUSDC addresses from output

# Terminal 3 — start frontend
# Update web/.env.local with the factory address from deploy output
cd web
npm run dev
# Open http://localhost:3000
```

### MetaMask Configuration

- **Local (Anvil):** Network RPC `http://127.0.0.1:8545`, Chain ID `31337`; import Anvil account #0 key `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- **Sepolia:** Use the dedicated deployer wallet (not the Anvil key); get test USDC from faucet.circle.com
- Use Chrome/Brave (Safari doesn't support wallet extensions)

### Environment Files (not tracked by git)

**`contracts/.env`:**
```
PRIVATE_KEY=<deployer wallet private key>
USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238   # Circle Sepolia USDC
TREASURY_ADDRESS=<treasury address>
SEPOLIA_RPC_URL=<Alchemy Sepolia HTTPS URL>
ETHERSCAN_API_KEY=<Etherscan API key>
```

**`web/.env.local`:**
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<WalletConnect project ID>
NEXT_PUBLIC_FACTORY_ADDRESS=0x93a9e45C2aF7D6b858F54CFd70cD2a677552Cedd
```

### Sepolia Deployment

- **Factory:** `0x93a9e45C2aF7D6b858F54CFd70cD2a677552Cedd` (verified on Sepolia Etherscan)
- **Test Pool:** `0x5eBca3ae0c84F597C922f3B0A8B2631b8049BCc3`
- **Frontend:** `https://bracket-pool-dapp.vercel.app/`
- **USDC:** Circle Sepolia USDC at `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- Deploy command: `source .env && forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify` (from `contracts/`)
- Create pool command: `source .env && cast send <factory> "createPool(string,uint256,uint256,uint256,uint256,uint256)" "<name>" 63 $(($(date +%s) + 7200)) $(($(date +%s) + 604800)) 10000000 100 --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY`

## Key Architecture Decisions

- **63 games** (Round of 64 through Championship, no First Four), 6 rounds with doubling points (10/20/40/80/160/320)
- **First Four handling** — play-in winners are resolved on the frontend before lock time, not picked by users. Lock time set to Thursday (R64 start)
- **Hash-only storage** — contract stores `keccak256(picks)`, full picks emitted in events
- **5% fee** via `totalPoolValue * 500 / 10000` (Solidity integer division)
- **Merkle tree claims** — scorer generates tree, root posted on-chain, proofs hosted on IPFS
- **Claim deadline** — `finalizeDeadline + 90 days`, then admin can sweep unclaimed funds
- **Tiebreaker** — predicted championship total score, closest wins, ties split evenly
- **Team data** — static config file in `web/src/lib/teams.ts`, updated via `/update-teams` slash command on Selection Sunday
- **Sport-agnostic contracts** — `gameCount` is a parameter, World Cup will use `gameCount=88` with a future `sportId` field
