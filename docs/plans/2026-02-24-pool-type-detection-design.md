# Pool Type Detection — Design

> **Status:** Approved
> **Date:** 2026-02-24

## Problem

The frontend infers pool type from `gameCount` alone — 63 maps to March Madness, 10 maps to IPL. This is brittle: `gameCount` is not a unique discriminator across sports, and adding new game types means adding more magic numbers to `POOL_TYPE_MAP`.

## Solution: Pool Name Prefix Convention

Encode pool type as a short prefix in `poolName`: `"mm:"`, `"ipl:"`, `"wc:"`. The prefix is invisible to end users — the Create Pool form strips it for display and the UI renders only the human-readable portion.

## Prefix Registry

| Prefix | Sport | Pool Type |
|--------|-------|-----------|
| `mm:` | March Madness | `bracket` |
| `ipl:` | IPL | `standings` |
| `wc:` | World Cup | `bracket` |

## Changes

### `web/src/lib/poolTypes.ts`
- Replace `POOL_TYPE_MAP` (keyed by `gameCount`) with `POOL_TYPE_PREFIX_MAP` (keyed by prefix)
- `getPoolTypeConfig(poolName: string)` — extract prefix from poolName, look up config, fall back to default

### `web/src/components/CreatePoolForm.tsx`
- Sport dropdown automatically prepends the correct prefix to `poolName` on submit
- Input field displays and accepts the name without the prefix (invisible to admin)

### Callers of `getPoolTypeConfig`
- `web/src/components/EntrySubmit.tsx` — pass `poolName` instead of `gameCount`
- Admin wizard components that use pool type — pass `poolName` instead of `gameCount`

## Backwards Compatibility

Existing deployed pools with no prefix fall back to `DEFAULT_CONFIG`. Test pools are unaffected.

## Non-Goals

- No contract changes
- No migration of existing pools
