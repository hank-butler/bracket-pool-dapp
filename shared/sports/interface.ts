export interface Team {
  id: `0x${string}`;  // keccak256(abi.encodePacked(code))
  name: string;
  code: string;
}

export interface SportModule {
  sportKey: string;
  gameCount: number;
  scorePicks(picks: `0x${string}`[], results: `0x${string}`[]): number;
  validatePicks(picks: `0x${string}`[]): boolean;
  getTeams(): Team[];
}
