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
  sourceSeeds: [number, number] | null; // only for first-round games
}

export interface BracketState {
  picks: (`0x${string}` | null)[];
  pickNames: (string | null)[];
  tiebreaker: number;
}

function teamId(name: string): `0x${string}` {
  return keccak256(toHex(name));
}

const REGIONS = ['East', 'West', 'South', 'Midwest'] as const;

// Standard NCAA seeding matchups for Round of 64
const SEED_MATCHUPS: [number, number][] = [
  [1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15],
];

function generateTeams(): Team[] {
  const teams: Team[] = [];
  for (const region of REGIONS) {
    for (let seed = 1; seed <= 16; seed++) {
      const name = `${region} ${seed}`;
      teams.push({ name, seed, region, id: teamId(name) });
    }
  }
  // 4 First Four extras (play-in games)
  for (let i = 0; i < 4; i++) {
    const name = `First Four ${i + 1}`;
    teams.push({ name, seed: 16, region: REGIONS[i], id: teamId(name) });
  }
  return teams;
}

export const ALL_TEAMS = generateTeams();

export function getTeamsByRegion(region: string): Team[] {
  return ALL_TEAMS.filter((t) => t.region === region && !t.name.startsWith('First Four'));
}

function buildGames(gameCount: number): Game[] {
  const games: Game[] = [];

  if (gameCount === 67) {
    // Full 67-game bracket: 4 play-in + 32 R64 + 16 R32 + 8 S16 + 4 E8 + 2 FF + 1 Champ

    // Games 0-3: First Four (play-in)
    for (let i = 0; i < 4; i++) {
      games.push({ index: i, round: 0, region: REGIONS[i], sourceGames: null, sourceSeeds: null });
    }

    // Games 4-35: Round of 64 (8 per region)
    for (let r = 0; r < 4; r++) {
      for (let m = 0; m < 8; m++) {
        const idx = 4 + r * 8 + m;
        games.push({
          index: idx,
          round: 1,
          region: REGIONS[r],
          sourceGames: m === 0 ? [r, null as unknown as number] : null, // first game in each region fed by play-in
          sourceSeeds: SEED_MATCHUPS[m],
        });
      }
    }

    // Games 36-51: Round of 32 (4 per region)
    for (let r = 0; r < 4; r++) {
      for (let m = 0; m < 4; m++) {
        const idx = 36 + r * 4 + m;
        const baseR64 = 4 + r * 8;
        games.push({
          index: idx,
          round: 2,
          region: REGIONS[r],
          sourceGames: [baseR64 + m * 2, baseR64 + m * 2 + 1],
          sourceSeeds: null,
        });
      }
    }

    // Games 52-59: Sweet 16 (2 per region)
    for (let r = 0; r < 4; r++) {
      for (let m = 0; m < 2; m++) {
        const idx = 52 + r * 2 + m;
        const baseR32 = 36 + r * 4;
        games.push({
          index: idx,
          round: 3,
          region: REGIONS[r],
          sourceGames: [baseR32 + m * 2, baseR32 + m * 2 + 1],
          sourceSeeds: null,
        });
      }
    }

    // Games 60-63: Elite 8 (1 per region)
    for (let r = 0; r < 4; r++) {
      const idx = 60 + r;
      const baseS16 = 52 + r * 2;
      games.push({
        index: idx,
        round: 4,
        region: REGIONS[r],
        sourceGames: [baseS16, baseS16 + 1],
        sourceSeeds: null,
      });
    }

    // Games 64-65: Final Four
    games.push({ index: 64, round: 5, region: null, sourceGames: [60, 61], sourceSeeds: null });
    games.push({ index: 65, round: 5, region: null, sourceGames: [62, 63], sourceSeeds: null });

    // Game 66: Championship
    games.push({ index: 66, round: 6, region: null, sourceGames: [64, 65], sourceSeeds: null });
  } else {
    // Generic: treat all games as independent (no cascading)
    for (let i = 0; i < gameCount; i++) {
      games.push({ index: i, round: 0, region: null, sourceGames: null, sourceSeeds: null });
    }
  }

  return games;
}

export const GAMES_67 = buildGames(67);

export const ROUND_NAMES: Record<number, string> = {
  0: 'First Four',
  1: 'Round of 64',
  2: 'Round of 32',
  3: 'Sweet 16',
  4: 'Elite 8',
  5: 'Final Four',
  6: 'Championship',
};

// Get the two team options for a game given current picks
export function getGameTeams(
  game: Game,
  picks: (`0x${string}` | null)[],
  pickNames: (string | null)[],
): [{ id: `0x${string}`; name: string } | null, { id: `0x${string}`; name: string } | null] {
  if (game.round === 0) {
    // Play-in: two First Four teams + the region's 16-seed
    const ff = ALL_TEAMS.find((t) => t.name === `First Four ${game.index + 1}`)!;
    const seed16 = ALL_TEAMS.find((t) => t.region === game.region && t.seed === 16 && !t.name.startsWith('First Four'))!;
    return [
      { id: ff.id, name: ff.name },
      { id: seed16.id, name: seed16.name },
    ];
  }

  if (game.round === 1 && game.sourceSeeds) {
    const [seedA, seedB] = game.sourceSeeds;
    const region = game.region!;

    let teamA: { id: `0x${string}`; name: string };
    if (seedA === 16 || seedB === 16) {
      // The 1v16 matchup: 16-seed spot may be filled by play-in winner
      const playInIndex = REGIONS.indexOf(region as typeof REGIONS[number]);
      if (seedA === 16 && picks[playInIndex]) {
        teamA = { id: picks[playInIndex]!, name: pickNames[playInIndex] || 'TBD' };
      } else if (seedA === 16) {
        // Play-in not yet decided
        return [null, { id: getTeamsByRegion(region).find((t) => t.seed === seedB)!.id, name: `${region} ${seedB}` }];
      } else {
        teamA = { id: getTeamsByRegion(region).find((t) => t.seed === seedA)!.id, name: `${region} ${seedA}` };
      }

      let teamB: { id: `0x${string}`; name: string };
      if (seedB === 16 && picks[playInIndex]) {
        teamB = { id: picks[playInIndex]!, name: pickNames[playInIndex] || 'TBD' };
      } else if (seedB === 16) {
        return [{ id: getTeamsByRegion(region).find((t) => t.seed === seedA)!.id, name: `${region} ${seedA}` }, null];
      } else {
        teamB = { id: getTeamsByRegion(region).find((t) => t.seed === seedB)!.id, name: `${region} ${seedB}` };
      }

      return [teamA, teamB];
    }

    const a = getTeamsByRegion(region).find((t) => t.seed === seedA)!;
    const b = getTeamsByRegion(region).find((t) => t.seed === seedB)!;
    return [
      { id: a.id, name: a.name },
      { id: b.id, name: b.name },
    ];
  }

  // Later rounds: teams come from source game winners
  if (game.sourceGames) {
    const [srcA, srcB] = game.sourceGames;
    const teamA = picks[srcA] ? { id: picks[srcA]!, name: pickNames[srcA] || 'TBD' } : null;
    const teamB = picks[srcB] ? { id: picks[srcB]!, name: pickNames[srcB] || 'TBD' } : null;
    return [teamA, teamB];
  }

  return [null, null];
}

// Find all downstream game indices that depend on a given game
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
      // Check if the downstream pick was the OLD winner of this game — if so clear it
      const oldPick = state.picks[gameIndex];
      if (oldPick && oldPick !== winnerId) {
        // Invalidate any downstream pick that was the old winner
        if (newPicks[idx] === oldPick) {
          newPicks[idx] = null;
          newNames[idx] = null;
        }
      }
    }
  }

  return { picks: newPicks, pickNames: newNames, tiebreaker: state.tiebreaker };
}

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
  const games = gameCount === 67 ? GAMES_67 : buildGames(gameCount);
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
  return gameCount === 67 ? GAMES_67 : buildGames(gameCount);
}
