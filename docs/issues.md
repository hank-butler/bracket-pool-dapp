# Identified Issues

Tracked issues to address in future work.

---

## 1. Pool Type Detection Relies on `gameCount` Magic Numbers

**Priority:** Medium
**Identified:** 2026-02-20
**Affected files:** `web/src/lib/poolTypes.ts`, `web/src/components/EntrySubmit.tsx`

### Problem

The frontend infers pool type from `gameCount` alone — 63 maps to March Madness bracket, 10 maps to IPL standings, anything else falls back to a generic bracket. This is brittle: `gameCount` is not a unique discriminator across sports, and adding new game types means adding more magic numbers to `POOL_TYPE_MAP`.

### Impact

Not blocking for March Madness 2025 launch (only one pool type deployed). Becomes a real problem when supporting multiple game types with potentially overlapping team/game counts.

### Proposed Solutions

1. **Add `bytes32 poolType` to contract** — Add an immutable field to `BracketPool.sol` and a parameter to the factory's `createPool`. Most robust, self-describing on-chain. Requires contract redeploy.
2. **Pool name prefix convention** — Use the existing `poolName` string with a type prefix (e.g. `"mm:March Madness 2026"`). Frontend parses the prefix. Zero contract changes.
3. **Frontend config mapping addresses to types** — Static config file mapping deployed pool addresses to their type. Simplest but requires manual sync at deploy time.

**Status:** Resolved — 2026-02-24. Pool name prefix convention implemented. See `web/src/lib/poolTypes.ts`.

---

## 2. Frontend Lint Errors (Pre-existing)

**Priority:** High
**Identified:** 2026-02-20
**Affected files:** `web/src/app/pool/[address]/page.tsx`, `web/src/components/ClaimPrize.tsx`, `web/src/hooks/useClaim.ts`, `web/src/hooks/useEnterPool.ts`

### Errors (6)

1. **Conditional hook calls** — `pool/[address]/page.tsx:28-30`: `usePoolDetails`, `usePoolStatus`, and `useAccount` are called after an early return, violating React's rules of hooks.
2. **Impure render call** — `ClaimPrize.tsx:32`: `Date.now()` called during render. Should use a hook or effect instead.
3. **setState in effect** — `useClaim.ts:50`: `setClaimables([])` called synchronously in a `useEffect` body, causing cascading renders.
4. **Variable accessed before declaration** — `useEnterPool.ts:79`: `submitEntry` is used inside `enter` callback before it's declared on line 89.

### Warnings (4)

- `pool/[address]/page.tsx:30` — Unused `userAddress` variable
- `pool/[address]/page.tsx:34` — Unused `showRefund` variable
- `EntrySubmit.tsx:23` — Unused `needsApproval` variable
- `useEnterPool.ts:86` — Missing `submitEntry` in dependency array
