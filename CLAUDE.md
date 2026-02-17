# Bracket Pool DApp

Sport-agnostic prediction pool platform on Ethereum. Users pay USDC to submit bracket picks, an off-chain scorer determines winners, and prizes are distributed via Merkle proof claims on-chain.

**Current launch target:** March Madness 2025 PoC, then World Cup 2026.

## Project Structure

```
contracts/   # Solidity smart contracts (Foundry)
scorer/      # Off-chain scoring engine (TypeScript)
web/         # Frontend (Next.js 16, React 19, Tailwind v4)
docs/        # Documentation and plans
```

## Commands

| What | Command | Directory |
|------|---------|-----------|
| Contract tests | `forge test` | `contracts/` |
| Scorer tests | `npm test` | `scorer/` |
| Frontend build | `npm run build` | `web/` |
| Frontend dev | `npm run dev` | `web/` |
| Lint | `npm run lint` | `web/` |
| Local deploy | `forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast` | `contracts/` |

## Architecture

### Smart Contracts (Foundry, Solidity 0.8.24)
- `BracketPool.sol` — Pool contract: entries, results, Merkle claims, refunds
- `BracketPoolFactory.sol` — Creates pools with configurable `gameCount`
- Sport-agnostic: `gameCount` is a parameter, not hardcoded
- 5% fee via bonding curve pricing
- Picks stored as `keccak256(abi.encodePacked(picks))` hash on-chain

### Scorer (TypeScript, Vitest)
- Reads entries from chain events, scores against results, builds Merkle tree
- `scoring.ts` — point-per-game mapping (63-game bracket, no First Four)
- `ranking.ts` — rank by score desc, tiebreaker distance asc
- `merkle.ts` — StandardMerkleTree for prize claims
- Run: `tsx src/index.ts <poolAddress> <rpcUrl> <actualTiebreaker>`

### Frontend (Next.js 16 app router, wagmi, RainbowKit)
- `/` — Pool list page
- `/pool/[address]` — Pool detail with bracket picker, entry, claim, refund
- `web/src/lib/teams.ts` — Team data and game structure (single source of truth)
- `web/src/components/BracketPicker.tsx` — Visual bracket tree UI
- 1990s web aesthetic (Windows 98 style)

## Key Conventions

### Team IDs
Team IDs are deterministic: `keccak256(toHex('Team Name'))` via viem. The same team always produces the same `bytes32` value across frontend, scorer, and contracts.

### Bracket Structure (March Madness)
- 63 games: 32 R64 + 16 R32 + 8 S16 + 4 E8 + 2 FF + 1 Championship
- No First Four play-in picks — those are resolved on the frontend before lock time
- Perfect bracket = 1,920 points (320 per round)
- Scoring doubles each round: 10, 20, 40, 80, 160, 320

### Team Data
Teams are a static array in `web/src/lib/teams.ts` (`ALL_TEAMS`). To update for a new season, use the `/update-teams` slash command which fetches from two sources, cross-references, and gets human approval before updating.

## Environment Variables

### web/.env.local
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # WalletConnect project ID
NEXT_PUBLIC_FACTORY_ADDRESS=            # Deployed BracketPoolFactory address
```

### contracts/.env
```
PRIVATE_KEY=
USDC_ADDRESS=
TREASURY_ADDRESS=
SEPOLIA_RPC_URL=
ETHERSCAN_API_KEY=
```

## Git

- Remote: `git@github.com:hank-butler/bracket-pool-dapp.git`
- Default branch: `main`
- Always create feature branches for new work
