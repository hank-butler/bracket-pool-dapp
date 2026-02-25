# Pool Type Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `gameCount`-based pool type detection with a `poolName` prefix convention so pool types are unambiguous regardless of game count.

**Architecture:** Add a prefix registry to `poolTypes.ts` (e.g. `"mm:"`, `"ipl:"`). `getPoolTypeConfig` takes `poolName` instead of `gameCount`. `CreatePoolForm` automatically prepends the prefix on submit. `EntrySubmit` passes `poolName` instead of `gameCount`.

**Tech Stack:** Next.js 16, TypeScript, Vitest (scorer tests unaffected — this is frontend-only)

---

## Task 1: Update `poolTypes.ts` — prefix-based lookup

**Files:**
- Modify: `web/src/lib/poolTypes.ts`

**Step 1: Write a failing test**

Create `web/src/lib/poolTypes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getPoolTypeConfig } from './poolTypes';

describe('getPoolTypeConfig', () => {
  it('returns March Madness config for mm: prefix', () => {
    const config = getPoolTypeConfig('mm:March Madness 2026');
    expect(config.sport).toBe('March Madness');
    expect(config.type).toBe('bracket');
  });

  it('returns IPL config for ipl: prefix', () => {
    const config = getPoolTypeConfig('ipl:IPL 2025');
    expect(config.sport).toBe('IPL');
    expect(config.type).toBe('standings');
  });

  it('returns World Cup config for wc: prefix', () => {
    const config = getPoolTypeConfig('wc:World Cup 2026');
    expect(config.sport).toBe('World Cup');
    expect(config.type).toBe('bracket');
  });

  it('returns default config for unknown prefix', () => {
    const config = getPoolTypeConfig('Some Pool Without Prefix');
    expect(config.sport).toBe('Unknown');
  });

  it('returns default config for empty string', () => {
    const config = getPoolTypeConfig('');
    expect(config.sport).toBe('Unknown');
  });
});

describe('stripPoolNamePrefix', () => {
  it('strips known prefix', () => {
    const { stripPoolNamePrefix } = require('./poolTypes');
    expect(stripPoolNamePrefix('mm:March Madness 2026')).toBe('March Madness 2026');
  });

  it('returns name unchanged if no prefix', () => {
    const { stripPoolNamePrefix } = require('./poolTypes');
    expect(stripPoolNamePrefix('Some Pool')).toBe('Some Pool');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run src/lib/poolTypes.test.ts
```

Expected: FAIL — `getPoolTypeConfig` currently takes `gameCount: number`, not a string.

**Step 3: Update `web/src/lib/poolTypes.ts`**

Replace the entire file with:

```typescript
/**
 * Pool type detection based on poolName prefix.
 * Format: "<prefix>:<display name>", e.g. "mm:March Madness 2026"
 * The contract is sport-agnostic — this mapping is purely a frontend concern.
 */

export type PoolType = 'bracket' | 'standings';

export interface PoolTypeConfig {
  type: PoolType;
  sport: string;
  label: string;
  tiebreakerLabel: string;
  tiebreakerPlaceholder: string;
  submitLabel: string;
  incompleteLabel: string;
  picksUnit: string;
}

export const POOL_TYPE_PREFIXES: Record<string, PoolTypeConfig> = {
  'mm:': {
    type: 'bracket',
    sport: 'March Madness',
    label: 'NCAA Tournament Bracket',
    tiebreakerLabel: 'Predicted championship total points',
    tiebreakerPlaceholder: 'e.g. 145',
    submitLabel: 'Submit Bracket',
    incompleteLabel: 'Pick all 63 games & set tiebreaker',
    picksUnit: 'games',
  },
  'ipl:': {
    type: 'standings',
    sport: 'IPL',
    label: 'IPL Standings Prediction',
    tiebreakerLabel: 'Predicted total sixes in the tournament',
    tiebreakerPlaceholder: 'e.g. 850',
    submitLabel: 'Submit Prediction',
    incompleteLabel: 'Rank all 10 teams & set tiebreaker',
    picksUnit: 'positions',
  },
  'wc:': {
    type: 'bracket',
    sport: 'World Cup',
    label: 'World Cup Bracket',
    tiebreakerLabel: 'Predicted total goals in the Final',
    tiebreakerPlaceholder: 'e.g. 3',
    submitLabel: 'Submit Bracket',
    incompleteLabel: 'Pick all games & set tiebreaker',
    picksUnit: 'games',
  },
};

const DEFAULT_CONFIG: PoolTypeConfig = {
  type: 'bracket',
  sport: 'Unknown',
  label: 'Prediction Pool',
  tiebreakerLabel: 'Tiebreaker value',
  tiebreakerPlaceholder: 'e.g. 100',
  submitLabel: 'Submit Entry',
  incompleteLabel: 'Complete all picks & set tiebreaker',
  picksUnit: 'picks',
};

export function getPoolTypeConfig(poolName: string): PoolTypeConfig {
  for (const prefix of Object.keys(POOL_TYPE_PREFIXES)) {
    if (poolName.startsWith(prefix)) {
      return POOL_TYPE_PREFIXES[prefix];
    }
  }
  return DEFAULT_CONFIG;
}

export function stripPoolNamePrefix(poolName: string): string {
  for (const prefix of Object.keys(POOL_TYPE_PREFIXES)) {
    if (poolName.startsWith(prefix)) {
      return poolName.slice(prefix.length);
    }
  }
  return poolName;
}
```

**Step 4: Run test to verify it passes**

```bash
cd web && npx vitest run src/lib/poolTypes.test.ts
```

Expected: all 7 tests pass.

**Step 5: Commit**

```bash
git add web/src/lib/poolTypes.ts web/src/lib/poolTypes.test.ts
git commit -m "feat: replace gameCount pool type detection with poolName prefix"
```

---

## Task 2: Update `EntrySubmit.tsx` — pass `poolName` instead of `gameCount`

**Files:**
- Modify: `web/src/components/EntrySubmit.tsx`
- Modify: `web/src/app/pool/[address]/page.tsx`

**Step 1: Update the `EntrySubmit` component props**

In `web/src/components/EntrySubmit.tsx`, change the interface and usage:

```typescript
// Change interface:
interface EntrySubmitProps {
  poolAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  currentPrice: bigint;
  gameCount: number;
  poolName: string;  // add this
}

// Change function signature:
export function EntrySubmit({ poolAddress, usdcAddress, currentPrice, gameCount, poolName }: EntrySubmitProps) {

// Change line 49:
const poolConfig = getPoolTypeConfig(poolName);
```

**Step 2: Update the caller in `web/src/app/pool/[address]/page.tsx`**

Find the `EntrySubmit` usage and add `poolName`:

```tsx
<EntrySubmit
  poolAddress={poolAddress}
  usdcAddress={pool.usdcAddress}
  currentPrice={pool.currentPrice}
  gameCount={pool.gameCount}
  poolName={pool.poolName}
/>
```

**Step 3: Build to verify no type errors**

```bash
cd web && npm run build 2>&1 | tail -15
```

Expected: clean build, no TypeScript errors.

**Step 4: Commit**

```bash
git add web/src/components/EntrySubmit.tsx web/src/app/pool/[address]/page.tsx
git commit -m "feat: pass poolName to EntrySubmit for prefix-based type detection"
```

---

## Task 3: Update `CreatePoolForm.tsx` — auto-prepend prefix

**Files:**
- Modify: `web/src/components/CreatePoolForm.tsx`

**Step 1: Add IPL to the SPORTS array and add prefix field**

```typescript
import { POOL_TYPE_PREFIXES } from '@/lib/poolTypes';

const SPORTS = [
  { label: 'March Madness', value: 'marchmadness', gameCount: 63, prefix: 'mm:' },
  { label: 'IPL', value: 'ipl', gameCount: 10, prefix: 'ipl:' },
  { label: 'World Cup', value: 'worldcup', gameCount: 88, prefix: 'wc:' },
];
```

**Step 2: Auto-prepend prefix on submit**

In `handleSubmit`, prepend the prefix before calling `createPool`:

```typescript
function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  createPool({
    poolName: `${sport.prefix}${poolName}`,
    gameCount: sport.gameCount,
    lockTime: Math.floor(new Date(lockTime).getTime() / 1000),
    finalizeDeadline: Math.floor(new Date(finalizeDeadline).getTime() / 1000),
    basePrice: parseUnits(basePrice, 6),
    priceSlope: BigInt(priceSlope),
  });
}
```

**Step 3: Show prefix hint in the pool name input label**

```tsx
<label className="block text-sm font-bold mb-1">
  Pool Name <span className="font-normal text-gray-500">(stored as "{sport.prefix}{poolName || '...'}")</span>
</label>
```

**Step 4: Build to verify**

```bash
cd web && npm run build 2>&1 | tail -15
```

Expected: clean build.

**Step 5: Commit**

```bash
git add web/src/components/CreatePoolForm.tsx
git commit -m "feat: auto-prepend sport prefix to pool name on creation"
```

---

## Task 4: Strip prefix from display names

Anywhere `pool.poolName` is rendered to users, strip the prefix so they see `"March Madness 2026"` not `"mm:March Madness 2026"`.

**Files:**
- Modify: `web/src/app/pool/[address]/page.tsx`
- Modify: `web/src/app/admin/page.tsx`
- Modify: `web/src/app/admin/pool/[address]/page.tsx`

**Step 1: Import and apply `stripPoolNamePrefix` in each page**

In each file, import `stripPoolNamePrefix` from `@/lib/poolTypes` and wrap `pool.poolName` where it's rendered:

```typescript
import { stripPoolNamePrefix } from '@/lib/poolTypes';

// Replace:
pool.poolName || 'Pool Details'
// With:
stripPoolNamePrefix(pool.poolName) || 'Pool Details'
```

Apply the same pattern wherever `pool.poolName` or `poolName` is displayed as text (not in contract calls).

**Step 2: Build to verify**

```bash
cd web && npm run build 2>&1 | tail -15
```

Expected: clean build.

**Step 3: Commit**

```bash
git add web/src/app/pool/[address]/page.tsx web/src/app/admin/page.tsx web/src/app/admin/pool/[address]/page.tsx
git commit -m "feat: strip pool name prefix from display strings"
```

---

## Task 5: Update `docs/issues.md` — mark issue #1 resolved

**Files:**
- Modify: `docs/issues.md`

**Step 1: Mark issue #1 resolved**

Add `**Status:** Resolved — 2026-02-24` under the issue #1 heading and a one-line note: `Pool name prefix convention implemented. See poolTypes.ts.`

**Step 2: Commit**

```bash
git add docs/issues.md
git commit -m "docs: mark pool type detection issue resolved"
```
