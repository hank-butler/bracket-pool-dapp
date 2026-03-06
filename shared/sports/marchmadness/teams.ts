import { keccak256, toHex } from 'viem';

export interface MMTeam {
  id: `0x${string}`;
  name: string;
  seed: number;
  region: 'South' | 'East' | 'Midwest' | 'West';
}

function teamId(name: string): `0x${string}` {
  return keccak256(toHex(name));
}

export const ALL_TEAMS: MMTeam[] = [
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
  { name: 'North Carolina', seed: 11, region: 'South', id: teamId('North Carolina') },
  { name: 'UC San Diego', seed: 12, region: 'South', id: teamId('UC San Diego') },
  { name: 'Yale', seed: 13, region: 'South', id: teamId('Yale') },
  { name: 'Lipscomb', seed: 14, region: 'South', id: teamId('Lipscomb') },
  { name: 'Bryant', seed: 15, region: 'South', id: teamId('Bryant') },
  { name: 'Alabama State', seed: 16, region: 'South', id: teamId('Alabama State') },

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
  { name: "Mount St. Mary's", seed: 16, region: 'East', id: teamId("Mount St. Mary's") },

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
  { name: 'Texas', seed: 11, region: 'Midwest', id: teamId('Texas') },
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
