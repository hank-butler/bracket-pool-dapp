import { keccak256, toHex } from 'viem';

export interface WCTeam {
  id: `0x${string}`;
  name: string;
  code: string;   // FIFA 3-letter code
  group: string;  // "A" through "L"
}

function teamId(code: string): `0x${string}` {
  return keccak256(toHex(code));
}

// 48 teams, 12 groups of 4
// Draw results from December 5, 2025.
// 6 slots marked TBD-* pending UEFA playoffs (Mar 26-31) and
// intercontinental playoffs (Mar 2026) — update codes before pool lock.
export const ALL_WC_TEAMS: WCTeam[] = [
  // Group A
  { id: teamId('MEX'), name: 'Mexico',       code: 'MEX', group: 'A' },
  { id: teamId('KOR'), name: 'South Korea',  code: 'KOR', group: 'A' },
  { id: teamId('RSA'), name: 'South Africa', code: 'RSA', group: 'A' },
  { id: teamId('TBD-A'), name: 'UEFA Playoff D', code: 'TBD-A', group: 'A' },

  // Group B
  { id: teamId('CAN'), name: 'Canada',      code: 'CAN', group: 'B' },
  { id: teamId('SUI'), name: 'Switzerland', code: 'SUI', group: 'B' },
  { id: teamId('QAT'), name: 'Qatar',       code: 'QAT', group: 'B' },
  { id: teamId('TBD-B'), name: 'UEFA Playoff A', code: 'TBD-B', group: 'B' },

  // Group C
  { id: teamId('BRA'), name: 'Brazil',   code: 'BRA', group: 'C' },
  { id: teamId('MAR'), name: 'Morocco',  code: 'MAR', group: 'C' },
  { id: teamId('SCO'), name: 'Scotland', code: 'SCO', group: 'C' },
  { id: teamId('HAI'), name: 'Haiti',    code: 'HAI', group: 'C' },

  // Group D
  { id: teamId('USA'), name: 'United States', code: 'USA', group: 'D' },
  { id: teamId('AUS'), name: 'Australia',     code: 'AUS', group: 'D' },
  { id: teamId('PAR'), name: 'Paraguay',      code: 'PAR', group: 'D' },
  { id: teamId('TBD-D'), name: 'UEFA Playoff C', code: 'TBD-D', group: 'D' },

  // Group E
  { id: teamId('GER'), name: 'Germany',       code: 'GER', group: 'E' },
  { id: teamId('ECU'), name: 'Ecuador',       code: 'ECU', group: 'E' },
  { id: teamId('CIV'), name: "Côte d'Ivoire", code: 'CIV', group: 'E' },
  { id: teamId('CUW'), name: 'Curaçao',       code: 'CUW', group: 'E' },

  // Group F
  { id: teamId('NED'), name: 'Netherlands', code: 'NED', group: 'F' },
  { id: teamId('JPN'), name: 'Japan',       code: 'JPN', group: 'F' },
  { id: teamId('TUN'), name: 'Tunisia',     code: 'TUN', group: 'F' },
  { id: teamId('TBD-F'), name: 'UEFA Playoff B', code: 'TBD-F', group: 'F' },

  // Group G
  { id: teamId('BEL'), name: 'Belgium',     code: 'BEL', group: 'G' },
  { id: teamId('IRN'), name: 'Iran',        code: 'IRN', group: 'G' },
  { id: teamId('EGY'), name: 'Egypt',       code: 'EGY', group: 'G' },
  { id: teamId('NZL'), name: 'New Zealand', code: 'NZL', group: 'G' },

  // Group H
  { id: teamId('ESP'), name: 'Spain',        code: 'ESP', group: 'H' },
  { id: teamId('URU'), name: 'Uruguay',      code: 'URU', group: 'H' },
  { id: teamId('KSA'), name: 'Saudi Arabia', code: 'KSA', group: 'H' },
  { id: teamId('CPV'), name: 'Cape Verde',   code: 'CPV', group: 'H' },

  // Group I
  { id: teamId('FRA'), name: 'France',  code: 'FRA', group: 'I' },
  { id: teamId('SEN'), name: 'Senegal', code: 'SEN', group: 'I' },
  { id: teamId('NOR'), name: 'Norway',  code: 'NOR', group: 'I' },
  { id: teamId('TBD-I'), name: 'Intercontinental Playoff 1', code: 'TBD-I', group: 'I' },

  // Group J
  { id: teamId('ARG'), name: 'Argentina', code: 'ARG', group: 'J' },
  { id: teamId('AUT'), name: 'Austria',   code: 'AUT', group: 'J' },
  { id: teamId('ALG'), name: 'Algeria',   code: 'ALG', group: 'J' },
  { id: teamId('JOR'), name: 'Jordan',    code: 'JOR', group: 'J' },

  // Group K
  { id: teamId('POR'), name: 'Portugal',   code: 'POR', group: 'K' },
  { id: teamId('COL'), name: 'Colombia',   code: 'COL', group: 'K' },
  { id: teamId('UZB'), name: 'Uzbekistan', code: 'UZB', group: 'K' },
  { id: teamId('TBD-K'), name: 'Intercontinental Playoff 2', code: 'TBD-K', group: 'K' },

  // Group L
  { id: teamId('ENG'), name: 'England', code: 'ENG', group: 'L' },
  { id: teamId('CRO'), name: 'Croatia', code: 'CRO', group: 'L' },
  { id: teamId('PAN'), name: 'Panama',  code: 'PAN', group: 'L' },
  { id: teamId('GHA'), name: 'Ghana',   code: 'GHA', group: 'L' },
];

export const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'] as const;

export function getGroupTeams(group: string): WCTeam[] {
  return ALL_WC_TEAMS.filter(t => t.group === group);
}
