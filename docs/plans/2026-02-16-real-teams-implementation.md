# Real 2025 Teams Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace placeholder team names ("East 1", "West 12") with real 2025 March Madness teams and simplify from 67-game to 63-game bracket (dropping First Four).

**Architecture:** Static team data in `web/src/lib/teams.ts`, updated scorer index ranges in `scorer/src/scoring.ts`. The `getGameTeams` return type gains a `seed` field so the UI can display seeds next to real team names. All 67→63 references updated.

**Tech Stack:** TypeScript, React, Vitest

---

### Task 1: Update scorer to 63-game index ranges

**Files:**
- Modify: `scorer/src/scoring.ts`
- Modify: `scorer/test/scoring.test.ts`

**Step 1: Update the tests first**

In `scorer/test/scoring.test.ts`, replace the entire file with:

```typescript
import { describe, it, expect } from 'vitest';
import { getPointsForGame, scoreEntry } from '../src/scoring';

describe('getPointsForGame', () => {
  it('returns 10 for Round of 64 (indices 0-31)', () => {
    expect(getPointsForGame(0)).toBe(10);
    expect(getPointsForGame(31)).toBe(10);
  });

  it('returns 20 for Round of 32 (indices 32-47)', () => {
    expect(getPointsForGame(32)).toBe(20);
    expect(getPointsForGame(47)).toBe(20);
  });

  it('returns 40 for Sweet 16 (indices 48-55)', () => {
    expect(getPointsForGame(48)).toBe(40);
    expect(getPointsForGame(55)).toBe(40);
  });

  it('returns 80 for Elite 8 (indices 56-59)', () => {
    expect(getPointsForGame(56)).toBe(80);
    expect(getPointsForGame(59)).toBe(80);
  });

  it('returns 160 for Final Four (indices 60-61)', () => {
    expect(getPointsForGame(60)).toBe(160);
    expect(getPointsForGame(61)).toBe(160);
  });

  it('returns 320 for Championship (index 62)', () => {
    expect(getPointsForGame(62)).toBe(320);
  });

  it('throws for out-of-range index', () => {
    expect(() => getPointsForGame(63)).toThrow();
    expect(() => getPointsForGame(-1)).toThrow();
  });
});

describe('scoreEntry', () => {
  const makeBytes32 = (n: number): `0x${string}` =>
    `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`;

  const makePicks = (count: number, offset = 0): `0x${string}`[] =>
    Array.from({ length: count }, (_, i) => makeBytes32(i + 1 + offset));

  it('perfect bracket = 1920', () => {
    const picks = makePicks(63);
    const results = makePicks(63);
    expect(scoreEntry(picks, results)).toBe(1920);
  });

  it('all wrong = 0', () => {
    const picks = makePicks(63, 0);
    const results = makePicks(63, 100);
    expect(scoreEntry(picks, results)).toBe(0);
  });

  it('only championship correct = 320', () => {
    const picks = makePicks(63, 0);
    const results = makePicks(63, 100);
    results[62] = picks[62];
    expect(scoreEntry(picks, results)).toBe(320);
  });

  it('throws on length mismatch', () => {
    expect(() => scoreEntry(makePicks(10), makePicks(63))).toThrow();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd scorer && npx vitest run test/scoring.test.ts`
Expected: FAIL — index ranges and totals don't match old 67-game implementation.

**Step 3: Update the scorer implementation**

In `scorer/src/scoring.ts`, replace the entire file with:

```typescript
export function getPointsForGame(gameIndex: number): number {
  if (gameIndex < 0 || gameIndex > 62) throw new Error(`Invalid game index: ${gameIndex}`);
  if (gameIndex < 32) return 10;   // Round of 64
  if (gameIndex < 48) return 20;   // Round of 32
  if (gameIndex < 56) return 40;   // Sweet 16
  if (gameIndex < 60) return 80;   // Elite 8
  if (gameIndex < 62) return 160;  // Final Four
  return 320;                       // Championship
}

export function scoreEntry(picks: `0x${string}`[], results: `0x${string}`[]): number {
  if (picks.length !== results.length) {
    throw new Error(`Length mismatch: picks=${picks.length}, results=${results.length}`);
  }

  let score = 0;
  for (let i = 0; i < picks.length; i++) {
    if (picks[i].toLowerCase() === results[i].toLowerCase()) {
      score += getPointsForGame(i);
    }
  }
  return score;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd scorer && npx vitest run test/scoring.test.ts`
Expected: All tests PASS.

**Step 5: Run all scorer tests**

Run: `cd scorer && npx vitest run`
Expected: All tests PASS (ranking and merkle tests are score-agnostic).

**Step 6: Commit**

```bash
git add scorer/src/scoring.ts scorer/test/scoring.test.ts
git commit -m "feat(scorer): update to 63-game bracket, drop First Four"
```

---

### Task 2: Replace placeholder teams with real 2025 data in teams.ts

**Files:**
- Modify: `web/src/lib/teams.ts`

**Step 1: Replace `generateTeams()` with static 2025 team data and update `buildGames` to 63-game structure**

Replace the entire `web/src/lib/teams.ts` file. Key changes:
- Remove `generateTeams()` function — replace with static `ALL_TEAMS` array of 64 real teams
- Update `buildGames()` — remove First Four (round 0) logic, start at Round of 64 as index 0
- Update `getGameTeams()` — remove play-in handling, simplify to just seed-matchup and source-game logic. Return type gains `seed` field.
- Update `GAMES_67` → `GAMES_63`
- Update `ROUND_NAMES` — remove "First Four", renumber starting from round 1
- Update `randomFill` and `getGamesForCount` — use 63 instead of 67
- Add `getTeamById()` helper to look up seed by team id

```typescript
import { keccak256, toHex } from 'viem';

export interface Team {
  name: string;
  seed: number;
  region: string;
  id: `0x${string}`;
}

export interface Game {
  index: number;
  round: number;
  region: string | null; // null for Final Four / Championship
  sourceGames: [number, number] | null; // null for first-round games
  sourceSeeds: [number, number] | null; // only for Round of 64 games
}

export interface BracketState {
  picks: (`0x${string}` | null)[];
  pickNames: (string | null)[];
  tiebreaker: number;
}

export interface TeamInfo {
  id: `0x${string}`;
  name: string;
  seed: number;
}

function teamId(name: string): `0x${string}` {
  return keccak256(toHex(name));
}

const REGIONS = ['South', 'East', 'Midwest', 'West'] as const;

// Standard NCAA seeding matchups for Round of 64
const SEED_MATCHUPS: [number, number][] = [
  [1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15],
];

// ─── 2025 NCAA Tournament Teams ────────────────────────────────────────────

export const ALL_TEAMS: Team[] = [
  // South Region
  { name: 'Auburn', seed: 1, region: 'South', id: teamId('Auburn') },
  { name: 'Michigan State', seed: 2, region: 'South', id: teamId('Michigan State') },
  { name: 'Iowa State', seed: 3, region: 'South', id: teamId('Iowa State') },
  { name: 'Texas A&M', seed: 4, region: 'South', id: teamId('Texas A&M') },
  { name: 'Michigan', seed: 5, region: 'South', id: teamId('Michigan') },
  { name: 'Ole Miss', seed: 6, region: 'South', id: teamId('Ole Miss') },
  { name: 'Marquette', seed: 7, region: 'South', id: teamId('Marquette') },
  { name: 'Louisville', seed: 8, region: 'South', id: teamId('Louisville') },
  { name: 'Creighton', seed: 9, region: 'South', id: teamId('Creighton') },
  { name: 'New Mexico', seed: 10, region: 'South', id: teamId('New Mexico') },
  { name: 'North Carolina', seed: 11, region: 'South', id: teamId('North Carolina') }, // First Four winner (vs San Diego State)
  { name: 'UC San Diego', seed: 12, region: 'South', id: teamId('UC San Diego') },
  { name: 'Yale', seed: 13, region: 'South', id: teamId('Yale') },
  { name: 'Lipscomb', seed: 14, region: 'South', id: teamId('Lipscomb') },
  { name: 'Bryant', seed: 15, region: 'South', id: teamId('Bryant') },
  { name: 'Alabama State', seed: 16, region: 'South', id: teamId('Alabama State') }, // First Four winner (vs St. Francis)

  // East Region
  { name: 'Duke', seed: 1, region: 'East', id: teamId('Duke') },
  { name: 'Alabama', seed: 2, region: 'East', id: teamId('Alabama') },
  { name: 'Wisconsin', seed: 3, region: 'East', id: teamId('Wisconsin') },
  { name: 'Arizona', seed: 4, region: 'East', id: teamId('Arizona') },
  { name: 'Oregon', seed: 5, region: 'East', id: teamId('Oregon') },
  { name: 'BYU', seed: 6, region: 'East', id: teamId('BYU') },
  { name: "Saint Mary's", seed: 7, region: 'East', id: teamId("Saint Mary's") },
  { name: 'Mississippi State', seed: 8, region: 'East', id: teamId('Mississippi State') },
  { name: 'Baylor', seed: 9, region: 'East', id: teamId('Baylor') },
  { name: 'Vanderbilt', seed: 10, region: 'East', id: teamId('Vanderbilt') },
  { name: 'VCU', seed: 11, region: 'East', id: teamId('VCU') },
  { name: 'Liberty', seed: 12, region: 'East', id: teamId('Liberty') },
  { name: 'Akron', seed: 13, region: 'East', id: teamId('Akron') },
  { name: 'Montana', seed: 14, region: 'East', id: teamId('Montana') },
  { name: 'Robert Morris', seed: 15, region: 'East', id: teamId('Robert Morris') },
  { name: "Mount St. Mary's", seed: 16, region: 'East', id: teamId("Mount St. Mary's") }, // First Four winner (vs American)

  // Midwest Region
  { name: 'Houston', seed: 1, region: 'Midwest', id: teamId('Houston') },
  { name: 'Tennessee', seed: 2, region: 'Midwest', id: teamId('Tennessee') },
  { name: 'Kentucky', seed: 3, region: 'Midwest', id: teamId('Kentucky') },
  { name: 'Purdue', seed: 4, region: 'Midwest', id: teamId('Purdue') },
  { name: 'Clemson', seed: 5, region: 'Midwest', id: teamId('Clemson') },
  { name: 'Illinois', seed: 6, region: 'Midwest', id: teamId('Illinois') },
  { name: 'UCLA', seed: 7, region: 'Midwest', id: teamId('UCLA') },
  { name: 'Gonzaga', seed: 8, region: 'Midwest', id: teamId('Gonzaga') },
  { name: 'Georgia', seed: 9, region: 'Midwest', id: teamId('Georgia') },
  { name: 'Utah State', seed: 10, region: 'Midwest', id: teamId('Utah State') },
  { name: 'Texas', seed: 11, region: 'Midwest', id: teamId('Texas') }, // First Four winner (vs Xavier)
  { name: 'McNeese', seed: 12, region: 'Midwest', id: teamId('McNeese') },
  { name: 'High Point', seed: 13, region: 'Midwest', id: teamId('High Point') },
  { name: 'Troy', seed: 14, region: 'Midwest', id: teamId('Troy') },
  { name: 'Wofford', seed: 15, region: 'Midwest', id: teamId('Wofford') },
  { name: 'SIUE', seed: 16, region: 'Midwest', id: teamId('SIUE') },

  // West Region
  { name: 'Florida', seed: 1, region: 'West', id: teamId('Florida') },
  { name: "St. John's", seed: 2, region: 'West', id: teamId("St. John's") },
  { name: 'Texas Tech', seed: 3, region: 'West', id: teamId('Texas Tech') },
  { name: 'Maryland', seed: 4, region: 'West', id: teamId('Maryland') },
  { name: 'Memphis', seed: 5, region: 'West', id: teamId('Memphis') },
  { name: 'Missouri', seed: 6, region: 'West', id: teamId('Missouri') },
  { name: 'Kansas', seed: 7, region: 'West', id: teamId('Kansas') },
  { name: 'UConn', seed: 8, region: 'West', id: teamId('UConn') },
  { name: 'Oklahoma', seed: 9, region: 'West', id: teamId('Oklahoma') },
  { name: 'Arkansas', seed: 10, region: 'West', id: teamId('Arkansas') },
  { name: 'Drake', seed: 11, region: 'West', id: teamId('Drake') },
  { name: 'Colorado State', seed: 12, region: 'West', id: teamId('Colorado State') },
  { name: 'Grand Canyon', seed: 13, region: 'West', id: teamId('Grand Canyon') },
  { name: 'UNCW', seed: 14, region: 'West', id: teamId('UNCW') },
  { name: 'Omaha', seed: 15, region: 'West', id: teamId('Omaha') },
  { name: 'Norfolk State', seed: 16, region: 'West', id: teamId('Norfolk State') },
];

export function getTeamsByRegion(region: string): Team[] {
  return ALL_TEAMS.filter((t) => t.region === region);
}

function getTeamById(id: `0x${string}`): Team | undefined {
  return ALL_TEAMS.find((t) => t.id === id);
}

// ─── Game Structure ────────────────────────────────────────────────────────

function buildGames(gameCount: number): Game[] {
  const games: Game[] = [];

  if (gameCount === 63) {
    // 63-game bracket: 32 R64 + 16 R32 + 8 S16 + 4 E8 + 2 FF + 1 Championship

    // Games 0-31: Round of 64 (8 per region)
    for (let r = 0; r < 4; r++) {
      for (let m = 0; m < 8; m++) {
        const idx = r * 8 + m;
        games.push({
          index: idx,
          round: 1,
          region: REGIONS[r],
          sourceGames: null,
          sourceSeeds: SEED_MATCHUPS[m],
        });
      }
    }

    // Games 32-47: Round of 32 (4 per region)
    for (let r = 0; r < 4; r++) {
      for (let m = 0; m < 4; m++) {
        const idx = 32 + r * 4 + m;
        const baseR64 = r * 8;
        games.push({
          index: idx,
          round: 2,
          region: REGIONS[r],
          sourceGames: [baseR64 + m * 2, baseR64 + m * 2 + 1],
          sourceSeeds: null,
        });
      }
    }

    // Games 48-55: Sweet 16 (2 per region)
    for (let r = 0; r < 4; r++) {
      for (let m = 0; m < 2; m++) {
        const idx = 48 + r * 2 + m;
        const baseR32 = 32 + r * 4;
        games.push({
          index: idx,
          round: 3,
          region: REGIONS[r],
          sourceGames: [baseR32 + m * 2, baseR32 + m * 2 + 1],
          sourceSeeds: null,
        });
      }
    }

    // Games 56-59: Elite 8 (1 per region)
    for (let r = 0; r < 4; r++) {
      const idx = 56 + r;
      const baseS16 = 48 + r * 2;
      games.push({
        index: idx,
        round: 4,
        region: REGIONS[r],
        sourceGames: [baseS16, baseS16 + 1],
        sourceSeeds: null,
      });
    }

    // Games 60-61: Final Four
    games.push({ index: 60, round: 5, region: null, sourceGames: [56, 57], sourceSeeds: null });
    games.push({ index: 61, round: 5, region: null, sourceGames: [58, 59], sourceSeeds: null });

    // Game 62: Championship
    games.push({ index: 62, round: 6, region: null, sourceGames: [60, 61], sourceSeeds: null });
  } else {
    // Generic: treat all games as independent (no cascading)
    for (let i = 0; i < gameCount; i++) {
      games.push({ index: i, round: 0, region: null, sourceGames: null, sourceSeeds: null });
    }
  }

  return games;
}

export const GAMES_63 = buildGames(63);

export const ROUND_NAMES: Record<number, string> = {
  1: 'Round of 64',
  2: 'Round of 32',
  3: 'Sweet 16',
  4: 'Elite 8',
  5: 'Final Four',
  6: 'Championship',
};

// ─── Game Team Resolution ──────────────────────────────────────────────────

export function getGameTeams(
  game: Game,
  picks: (`0x${string}` | null)[],
  pickNames: (string | null)[],
): [TeamInfo | null, TeamInfo | null] {
  if (game.round === 1 && game.sourceSeeds) {
    // Round of 64: teams come from seed matchups
    const [seedA, seedB] = game.sourceSeeds;
    const region = game.region!;
    const a = getTeamsByRegion(region).find((t) => t.seed === seedA)!;
    const b = getTeamsByRegion(region).find((t) => t.seed === seedB)!;
    return [
      { id: a.id, name: a.name, seed: a.seed },
      { id: b.id, name: b.name, seed: b.seed },
    ];
  }

  // Later rounds: teams come from source game winners
  if (game.sourceGames) {
    const [srcA, srcB] = game.sourceGames;
    const teamA = picks[srcA]
      ? { id: picks[srcA]!, name: pickNames[srcA] || 'TBD', seed: getTeamById(picks[srcA]!)?.seed ?? 0 }
      : null;
    const teamB = picks[srcB]
      ? { id: picks[srcB]!, name: pickNames[srcB] || 'TBD', seed: getTeamById(picks[srcB]!)?.seed ?? 0 }
      : null;
    return [teamA, teamB];
  }

  return [null, null];
}

// ─── Downstream Invalidation ───────────────────────────────────────────────

function getDownstreamGames(gameIndex: number, games: Game[]): number[] {
  const downstream: number[] = [];
  for (const g of games) {
    if (g.sourceGames && g.sourceGames.includes(gameIndex)) {
      downstream.push(g.index);
      downstream.push(...getDownstreamGames(g.index, games));
    }
  }
  return downstream;
}

export function selectWinner(
  state: BracketState,
  gameIndex: number,
  winnerId: `0x${string}`,
  winnerName: string,
  games: Game[],
): BracketState {
  const newPicks = [...state.picks];
  const newNames = [...state.pickNames];

  newPicks[gameIndex] = winnerId;
  newNames[gameIndex] = winnerName;

  // Clear invalidated downstream picks
  const downstream = getDownstreamGames(gameIndex, games);
  for (const idx of downstream) {
    if (newPicks[idx] && newPicks[idx] !== winnerId) {
      const oldPick = state.picks[gameIndex];
      if (oldPick && oldPick !== winnerId) {
        if (newPicks[idx] === oldPick) {
          newPicks[idx] = null;
          newNames[idx] = null;
        }
      }
    }
  }

  return { picks: newPicks, pickNames: newNames, tiebreaker: state.tiebreaker };
}

// ─── State Helpers ─────────────────────────────────────────────────────────

export function createEmptyState(gameCount: number): BracketState {
  return {
    picks: new Array(gameCount).fill(null),
    pickNames: new Array(gameCount).fill(null),
    tiebreaker: 0,
  };
}

export function isComplete(state: BracketState): boolean {
  return state.picks.every((p) => p !== null) && state.tiebreaker > 0;
}

export function picksToBytes32Array(state: BracketState): `0x${string}`[] {
  return state.picks.map((p) => p || ('0x' + '0'.repeat(64) as `0x${string}`));
}

export function randomFill(gameCount: number): BracketState {
  const games = gameCount === 63 ? GAMES_63 : buildGames(gameCount);
  let state = createEmptyState(gameCount);

  for (const game of games) {
    const [teamA, teamB] = getGameTeams(game, state.picks, state.pickNames);
    if (teamA && teamB) {
      const winner = Math.random() < 0.5 ? teamA : teamB;
      state = selectWinner(state, game.index, winner.id, winner.name, games);
    } else if (teamA) {
      state = selectWinner(state, game.index, teamA.id, teamA.name, games);
    } else if (teamB) {
      state = selectWinner(state, game.index, teamB.id, teamB.name, games);
    }
  }

  state.tiebreaker = Math.floor(Math.random() * 200) + 100;
  return state;
}

export function getGamesForCount(gameCount: number): Game[] {
  return gameCount === 63 ? GAMES_63 : buildGames(gameCount);
}
```

**Step 2: Verify the frontend builds**

Run: `cd web && npm run build`
Expected: Build should succeed (BracketPicker imports from teams.ts will still compile since the exports are the same names).

**Step 3: Commit**

```bash
git add web/src/lib/teams.ts
git commit -m "feat(web): replace placeholder teams with real 2025 March Madness data

Drop First Four, simplify to 63-game bracket. Add seed field to
TeamInfo type for proper seed display in bracket UI."
```

---

### Task 3: Update BracketPicker to work with 63-game bracket and real team names

**Files:**
- Modify: `web/src/components/BracketPicker.tsx`

**Step 1: Update the BracketPicker component**

Changes needed:
1. Line 22: Update `REGIONS` order to match teams.ts (`'South', 'East', 'Midwest', 'West'`)
2. Line 79: Change `gameCount !== 67` to `gameCount !== 63`
3. Lines 95-152: Remove the First Four section entirely
4. Lines 451-456: Remove `extractSeed()` function — use `team.seed` from the `TeamInfo` type instead
5. Lines 458-493: Update `TeamRow` to accept `TeamInfo` (which includes `seed`) instead of `{ id, name }`

Specific edits:

**Edit 1:** Update REGIONS to match teams.ts order:
```
- const REGIONS = ['East', 'West', 'South', 'Midwest'] as const;
+ const REGIONS = ['South', 'East', 'Midwest', 'West'] as const;
```

**Edit 2:** Update the gameCount check:
```
- if (gameCount !== 67) {
+ if (gameCount !== 63) {
```

**Edit 3:** Remove the First Four section. Delete lines 95-154 (the `firstFourGames` variable and the First Four rendering block including the `<hr />`).

**Edit 4:** Import `TeamInfo` from teams.ts and update `MatchupBox` and `TeamRow` to use it:

In `TeamRow`, replace `extractSeed(team.name)` with `team.seed`:
```
- const seed = extractSeed(team.name);
+ const seed = team.seed;
```

And update the seed display to always show (since all teams have a seed):
```
- {seed && <span className="bracket-seed">{seed}</span>}
+ {seed > 0 && <span className="bracket-seed">{seed}</span>}
```

Update the team prop type in `TeamRow` from `{ id, name }` to `TeamInfo`:
```
- team: { id: `0x${string}`; name: string } | null;
+ team: TeamInfo | null;
```

Same in `MatchupBox`:
```
- const [teamA, teamB] = getGameTeams(game, picks, pickNames);
```
(This line stays the same — `getGameTeams` now returns `TeamInfo | null` instead of `{ id, name } | null`)

Delete the `extractSeed` function entirely.

Update the `REGION_CLASS` keys to match new region order (values stay the same, just ensure all 4 exist).

**Step 2: Verify the frontend builds**

Run: `cd web && npm run build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add web/src/components/BracketPicker.tsx
git commit -m "feat(web): update BracketPicker for 63-game bracket with real teams

Remove First Four section, use TeamInfo.seed for seed display,
update gameCount check from 67 to 63."
```

---

### Task 4: Verify end-to-end with dev server

**Step 1: Start the dev server**

Run: `cd web && npm run dev`

**Step 2: Manual verification checklist**

Open browser to localhost:3000 and verify:
- [ ] Pool list page loads
- [ ] Pool detail page loads
- [ ] Bracket picker shows real team names (Auburn, Duke, Houston, Florida as 1-seeds)
- [ ] Seeds display correctly next to team names
- [ ] All 4 regions render with correct teams in correct seed matchups
- [ ] Clicking a team advances them to the next round
- [ ] Downstream picks clear when changing an earlier pick
- [ ] Randomize button fills all 63 games
- [ ] Final Four and Championship render correctly
- [ ] Tiebreaker input works
- [ ] "Submit Bracket" button enables when all 63 picks + tiebreaker are set
- [ ] No console errors

**Step 3: Commit any fixes if needed**

---

### Task 5: Final cleanup and verification

**Step 1: Run all scorer tests**

Run: `cd scorer && npx vitest run`
Expected: All tests pass.

**Step 2: Run frontend build**

Run: `cd web && npm run build`
Expected: Clean build, no warnings.

**Step 3: Verify no stale 67-game references remain**

Search for remaining "67" references:
Run: `grep -rn "67" web/src/ scorer/src/ scorer/test/ --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: No hits related to game count (may see unrelated numbers).

Search for "First Four" references:
Run: `grep -rn "First Four\|firstFour\|first_four" web/src/ scorer/src/ --include="*.ts" --include="*.tsx"`
Expected: No hits.

**Step 4: Final commit if any cleanup was done**

```bash
git commit -m "chore: clean up stale 67-game and First Four references"
```
