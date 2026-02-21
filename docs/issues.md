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
