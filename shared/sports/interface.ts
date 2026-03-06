export interface Team {
  id: `0x${string}`;
  name: string;
  code?: string;  // sport-specific short code (e.g. FIFA 3-letter for WC; absent for MM)
}

export interface SportModule {
  sportKey: string;
  gameCount: number;
  scorePicks(picks: `0x${string}`[], results: `0x${string}`[]): number;
  validatePicks(picks: `0x${string}`[]): boolean;
  getTeams(): Team[];
}
