# Bracket Pool DApp

A sport-agnostic prediction pool platform on Ethereum. Users pay USDC to submit bracket picks, an off-chain scorer determines winners, and prizes are distributed via Merkle proof claims on-chain.

**Sports supported:** March Madness · World Cup 2026 (in development)

---

## How It Works

1. **Enter** — Pay USDC to submit bracket picks before pool lock time. Entry price follows a bonding curve (increases with each entry, 5% fee to treasury).
2. **Score** — After the tournament, an off-chain scorer reads on-chain entries, scores them against results, and builds a Merkle tree of prizes.
3. **Claim** — Winners submit a Merkle proof on-chain to claim their USDC prize.
4. **Refund** — If the pool is cancelled or finalization deadline passes, entrants can reclaim their entry fee.

---

## Repository Structure

```
contracts/          # Solidity smart contracts (Foundry)
scorer/             # Off-chain scoring engine (TypeScript)
shared/             # Sport modules shared across scorer + frontend
  sports/
    marchmadness/   # MM teams, scoring, bracket logic
    worldcup2026/   # WC 2026 teams, scoring, bracket logic
web/                # Frontend (Next.js 16, React 19, Tailwind v4)
```

---

## Smart Contracts

Built with Foundry, Solidity 0.8.24, OpenZeppelin.

| Contract | Description |
|---|---|
| `BracketPool.sol` | Pool lifecycle: entries, results, Merkle claims, refunds |
| `BracketPoolFactory.sol` | Deploys pools with configurable `gameCount`, `sportId`, `payoutBps` |

Picks are stored as `keccak256(abi.encodePacked(picks))` — only the hash lives on-chain. Team IDs are deterministic `bytes32` values: `keccak256(toHex('Team Name'))` via viem.

---

## Scorer

TypeScript CLI that runs after tournament completion.

```
scorer/src/
  index.ts       # Entry point
  reader.ts      # Reads on-chain entry events
  scoring.ts     # Points-per-game mapping
  ranking.ts     # Score desc, tiebreaker distance asc
  merkle.ts      # Builds StandardMerkleTree for prize claims
  pipeline.ts    # End-to-end pipeline
```

**Run:**
```bash
cd scorer
tsx src/index.ts <poolAddress> <rpcUrl> <actualTiebreaker>
```

---

## Frontend

Next.js 16 app router, wagmi v2, RainbowKit. 1990s Windows 98 aesthetic.

| Route | Description |
|---|---|
| `/` | Pool list |
| `/pool/[address]` | Pool detail — bracket picker, entry submission, claim, refund |

---

## Development

### Prerequisites

- [Foundry](https://getfoundry.sh/)
- Node.js 20+
- A local Ethereum node (e.g. `anvil`)

### Commands

| Task | Command | Directory |
|---|---|---|
| Contract tests | `forge test` | `contracts/` |
| Scorer tests | `npm test` | `scorer/` |
| Frontend dev | `npm run dev` | `web/` |
| Frontend build | `npm run build` | `web/` |
| Local deploy | `forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast` | `contracts/` |

### Environment Variables

**`web/.env.local`**
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_FACTORY_ADDRESS=
```

**`contracts/.env`**
```
PRIVATE_KEY=
USDC_ADDRESS=
TREASURY_ADDRESS=
SEPOLIA_RPC_URL=
ETHERSCAN_API_KEY=
```

---

## Bracket Scoring

### March Madness (63 games)
- Rounds: R64 → R32 → S16 → E8 → Final Four → Championship
- Points double each round: 10 / 20 / 40 / 80 / 160 / 320
- Perfect bracket = 1,920 points
- No First Four picks — play-in results are resolved on the frontend before lock

### World Cup 2026 (88 slots)
- 48-team group stage → R32 knockout → R16 → QF → SF → Final
- Advancing third-place group pairings follow official FIFA bracket

---

## License

MIT
