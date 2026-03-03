# Token Allowlist Design

> **Status:** Approved — 2026-03-02

## Goal

Restrict `BracketPoolFactory.createPool()` to a set of admin-approved stablecoin addresses. Prevents pools from being created with arbitrary ERC-20 tokens while keeping the contract flexible for future stables without a redeploy.

## Architecture

`BracketPoolFactory` gains a `mapping(address => bool) public allowedTokens` registry. Two `onlyOwner` functions manage it: `addToken(address)` and `removeToken(address)`. `createPool` reverts with `"Token not allowed"` if the supplied token is not on the list.

No changes to `BracketPool.sol` — the token address is immutable per pool once created. Removing a token from the allowlist only affects future pool creation.

## Constructor Seeding

The factory constructor takes an `address[] memory initialTokens` parameter so deployment scripts can pre-populate the allowlist atomically (no separate `addToken` call needed after deploy).

## Events

- `TokenAdded(address indexed token)`
- `TokenRemoved(address indexed token)`

Standard pattern for on-chain registries; allows the frontend to read the current allowed set via logs if needed.

## Tests (~4 new cases)

- `createPool` succeeds with an allowed token
- `createPool` reverts with `"Token not allowed"` for a disallowed token
- `addToken` / `removeToken` revert when called by non-owner
- Removing a token from the list does not affect existing pools that already use it

## Frontend

- Regenerate `BracketPoolFactory.json` ABI from compiled output
- Add `addToken` / `removeToken` write hooks to `useAdminPool.ts`
- `CreatePoolForm` reads `allowedTokens` mapping to populate a token dropdown instead of a free-text address field

## Deploy Script Impact

`DeployLocal.s.sol` and any Sepolia deploy script: pass `[mockUSDC]` (local) or `[USDC_ADDRESS]` (Sepolia) as `initialTokens` to the factory constructor.
