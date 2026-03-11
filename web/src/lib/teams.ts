// Team data lives in shared/ (copied into web/shared/ by prebuild)
import { ALL_TEAMS } from '../../shared/sports/marchmadness/teams';
import type { MMTeam } from '../../shared/sports/marchmadness/teams';

export type Team = MMTeam;
export { ALL_TEAMS };

export interface Game {
  index: number;
  round: number;
  region: string | null;
  sourceGames: [number, number] | null;
  sourceSeeds: [number, number] | null;
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

const REGIONS = ['South', 'East', 'Midwest', 'West'] as const;

const SEED_MATCHUPS: [number, number][] = [
  [1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15],
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
    const [seedA, seedB] = game.sourceSeeds;
    const region = game.region!;
    const a = getTeamsByRegion(region).find((t) => t.seed === seedA)!;
    const b = getTeamsByRegion(region).find((t) => t.seed === seedB)!;
    return [
      { id: a.id, name: a.name, seed: a.seed },
      { id: b.id, name: b.name, seed: b.seed },
    ];
  }

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
