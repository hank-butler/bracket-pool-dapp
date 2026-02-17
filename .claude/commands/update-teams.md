# Update March Madness Teams

Update the NCAA tournament teams in `web/src/lib/teams.ts` for a new season.

## When to Use

Run this when the NCAA Selection Sunday bracket is announced (mid-March) and you need to swap in real team data for the new season.

## Input

The user will paste or describe the bracket — typically a list of 64 teams organized by region (South, East, Midwest, West) with seeds 1-16.

There are also 4 First Four play-in matchups. For each play-in, pick the expected winner or ask the user which team to use. The play-in winners fill the 4 contested seed slots (typically two 16-seeds and two 11-seeds, but the specific seeds vary by year).

## What to Update

**File:** `web/src/lib/teams.ts`

**Only change the `ALL_TEAMS` array.** Do not change any other code in the file — game structure, scoring, interfaces, and helper functions stay the same.

### Team Format

Each team entry follows this exact structure:

```typescript
{ name: 'Team Name', seed: N, region: 'Region', id: teamId('Team Name') },
```

- `name`: Official school name (e.g., `'Duke'`, `'Saint Mary\'s'`, `'Texas A&M'`)
- `seed`: Integer 1-16
- `region`: One of `'South'`, `'East'`, `'Midwest'`, `'West'`
- `id`: Always `teamId('Team Name')` — the function generates a deterministic `keccak256` hash

### Array Structure

The array must have exactly **64 teams**: 4 regions x 16 seeds. Teams are grouped by region in this order:

```
South (seeds 1-16)
East (seeds 1-16)
Midwest (seeds 1-16)
West (seeds 1-16)
```

Within each region, teams are listed in seed order (1 through 16).

### Critical Rules

1. **Exactly 64 teams** — no more, no less
2. **Exactly 16 teams per region** — seeds 1 through 16, no gaps, no duplicates
3. **`teamId()` argument must match `name` exactly** — `teamId('Texas A&M')` not `teamId('Texas A & M')`
4. **Region names must be exact:** `'South'`, `'East'`, `'Midwest'`, `'West'`
5. **The `REGIONS` const must match:** `['South', 'East', 'Midwest', 'West']`

## Verification

After updating, run:

```bash
cd web && npm run build
```

Build must pass with no TypeScript errors.

Then verify team count:
- Grep for `teamId(` in the ALL_TEAMS array — should be exactly 64 occurrences
- Each region should have seeds 1-16 with no gaps

## Example

For the 2025 bracket, the South region looks like:

```typescript
// South Region
{ name: 'Auburn', seed: 1, region: 'South', id: teamId('Auburn') },
{ name: 'Michigan State', seed: 2, region: 'South', id: teamId('Michigan State') },
{ name: 'Iowa State', seed: 3, region: 'South', id: teamId('Iowa State') },
// ... seeds 4-15 ...
{ name: 'Alabama State', seed: 16, region: 'South', id: teamId('Alabama State') },
```

## Downstream Impact

- **Scorer** (`scorer/src/scoring.ts`): No changes needed — it compares pick hashes to result hashes, doesn't reference team names
- **BracketPicker** (`web/src/components/BracketPicker.tsx`): No changes needed — it reads from `ALL_TEAMS` via `getGameTeams()`
- **Contracts**: No changes needed — `gameCount` is a parameter, team IDs are deterministic hashes
