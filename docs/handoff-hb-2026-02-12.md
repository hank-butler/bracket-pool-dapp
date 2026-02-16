# Handoff — 2026-02-12

## What Got Done

- Deployed contracts locally on Anvil (MockUSDC, Factory, Pool)
- Configured MetaMask: Anvil network, deployer account, MockUSDC token
- Tested full entry flow end-to-end:
  - Manual bracket picks + submit (confirmed USDC approval + entry)
  - Randomize button + submit (confirmed auto-fill + entry)
  - Pool page correctly shows entry count and pool value

## Deployed Addresses (will change on Anvil restart)

| Contract   | Address                                      |
|------------|----------------------------------------------|
| MockUSDC   | `0x5FbDB2315678afecb367f032d93F642f64180aa3`  |
| Factory    | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`  |
| Pool       | `0xCafac3dD18aC6c6e92c921884f9E4176737C052c`  |

## Tomorrow's Setup

Anvil state resets on restart, so you'll need to:

1. Start Anvil in Terminal 1:
   ```bash
   cd ~/Desktop/Projects/bracket-pool-dapp/contracts && anvil
   ```
2. Deploy in another terminal:
   ```bash
   cd ~/Desktop/Projects/bracket-pool-dapp/contracts && ~/.foundry/bin/forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
   ```
3. Update `web/.env.local` with the new Factory address (if it changes)
4. Start frontend in Terminal 2:
   ```bash
   cd ~/Desktop/Projects/bracket-pool-dapp/web && npm run dev
   ```

MetaMask should already be configured from today (Anvil network + deployer account + MockUSDC token). You may need to re-add the MockUSDC token if the address changes.

## Next Up: Tasks 3.7 & 3.8

- **3.7 Claim UI** — Merkle proof-based prize claiming
- **3.8 Refund UI** — eligibility check + refund transaction

## Known Nits

- Randomize button is easy to miss (styled as subtle gray text). Could be made more prominent.
- `forge` is at `~/.foundry/bin/forge` (not on PATH in this terminal environment)
