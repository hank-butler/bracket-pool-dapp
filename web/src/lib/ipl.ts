import { keccak256, toHex } from 'viem';

// ─── IPL Team Data ────────────────────────────────────────────────────────────

export interface IplTeam {
  name: string;
  abbreviation: string;
  id: `0x${string}`;
}

function teamId(name: string): `0x${string}` {
  return keccak256(toHex(name));
}

export const IPL_TEAMS: IplTeam[] = [
  { name: 'Mumbai Indians', abbreviation: 'MI', id: teamId('Mumbai Indians') },
  { name: 'Chennai Super Kings', abbreviation: 'CSK', id: teamId('Chennai Super Kings') },
  { name: 'Royal Challengers Bengaluru', abbreviation: 'RCB', id: teamId('Royal Challengers Bengaluru') },
  { name: 'Kolkata Knight Riders', abbreviation: 'KKR', id: teamId('Kolkata Knight Riders') },
  { name: 'Delhi Capitals', abbreviation: 'DC', id: teamId('Delhi Capitals') },
  { name: 'Punjab Kings', abbreviation: 'PBKS', id: teamId('Punjab Kings') },
  { name: 'Rajasthan Royals', abbreviation: 'RR', id: teamId('Rajasthan Royals') },
  { name: 'Sunrisers Hyderabad', abbreviation: 'SRH', id: teamId('Sunrisers Hyderabad') },
  { name: 'Gujarat Titans', abbreviation: 'GT', id: teamId('Gujarat Titans') },
  { name: 'Lucknow Super Giants', abbreviation: 'LSG', id: teamId('Lucknow Super Giants') },
];

export const IPL_TEAM_COUNT = IPL_TEAMS.length; // 10

export function getIplTeamById(id: `0x${string}`): IplTeam | undefined {
  return IPL_TEAMS.find((t) => t.id === id);
}

// ─── Standings State ──────────────────────────────────────────────────────────

export interface StandingsState {
  /** picks[i] = team ID predicted to finish in position i+1 */
  picks: (`0x${string}` | null)[];
  pickNames: (string | null)[];
  tiebreaker: number;
}

export function createEmptyStandingsState(): StandingsState {
  return {
    picks: new Array(IPL_TEAM_COUNT).fill(null),
    pickNames: new Array(IPL_TEAM_COUNT).fill(null),
    tiebreaker: 0,
  };
}

export function isStandingsComplete(state: StandingsState): boolean {
  return state.picks.every((p) => p !== null) && state.tiebreaker > 0;
}

export function standingsPicksToBytes32Array(state: StandingsState): `0x${string}`[] {
  return state.picks.map((p) => p || ('0x' + '0'.repeat(64) as `0x${string}`));
}
