// World Cup 2026 bracket logic — pure TypeScript, no React/UI.
// Shared team data is copied into web/shared/ by the prebuild/predev script.
import { ALL_WC_TEAMS, GROUPS } from '../../shared/sports/worldcup2026/teams';
import type { WCTeam } from '../../shared/sports/worldcup2026/teams';

export { ALL_WC_TEAMS, GROUPS };
export type { WCTeam };

// ─── Types ─────────────────────────────────────────────────────────────────

export type Group = typeof GROUPS[number]; // 'A'|'B'|...|'L'

export type SlotSource =
  | { type: 'pick'; slotIndex: number }
  | { type: 'sfLoser'; sfSlots: [number, number] };

export interface Matchup {
  outputSlot: number;
  sourceA: SlotSource;
  sourceB: SlotSource;
  label: string;
}

export interface WCState {
  picks: (`0x${string}` | null)[];  // 88 slots
  pickNames: (string | null)[];
  tiebreaker: number;
}

export interface MatchupTeams {
  teamA: { id: `0x${string}`; name: string } | null;
  teamB: { id: `0x${string}`; name: string } | null;
}

// ─── Slot Helpers ──────────────────────────────────────────────────────────

/**
 * Returns the slot index for a group's finishing position.
 * groupIndex: 0=A … 11=L; pos: 0=1st, 1=2nd, 2=3rd, 3=4th
 */
export function groupSlot(group: Group, pos: 0 | 1 | 2 | 3): number {
  const groupIndex = GROUPS.indexOf(group);
  return groupIndex * 4 + pos;
}

/**
 * Returns the slot index for the i-th advancing 3rd-place team (slots 48–55).
 */
export function advSlot(i: number): number {
  return 48 + i;
}

// ─── R32 Matchups (slots 56–71) ────────────────────────────────────────────

// Helper to build a pick-based source
function pickSrc(slotIndex: number): SlotSource {
  return { type: 'pick', slotIndex };
}

/**
 * R32 pairings — 16 matchups, outputSlots 56–71.
 * Slots 68–71 are advancing 3rd-place matchups.
 * NOTE: The 3rd-place pairings (slots 68–71) are PLACEHOLDERS —
 * the actual FIFA WC 2026 bracket draw for best 3rd-place teams
 * needs to be verified once the official bracket structure is confirmed.
 */
export const R32_MATCHUPS: Matchup[] = [
  // Group crossovers (slots 56–67)
  { outputSlot: 56, sourceA: pickSrc(groupSlot('A', 0)), sourceB: pickSrc(groupSlot('B', 1)), label: '1A vs 2B' },
  { outputSlot: 57, sourceA: pickSrc(groupSlot('C', 0)), sourceB: pickSrc(groupSlot('D', 1)), label: '1C vs 2D' },
  { outputSlot: 58, sourceA: pickSrc(groupSlot('E', 0)), sourceB: pickSrc(groupSlot('F', 1)), label: '1E vs 2F' },
  { outputSlot: 59, sourceA: pickSrc(groupSlot('G', 0)), sourceB: pickSrc(groupSlot('H', 1)), label: '1G vs 2H' },
  { outputSlot: 60, sourceA: pickSrc(groupSlot('I', 0)), sourceB: pickSrc(groupSlot('J', 1)), label: '1I vs 2J' },
  { outputSlot: 61, sourceA: pickSrc(groupSlot('K', 0)), sourceB: pickSrc(groupSlot('L', 1)), label: '1K vs 2L' },
  { outputSlot: 62, sourceA: pickSrc(groupSlot('B', 0)), sourceB: pickSrc(groupSlot('A', 1)), label: '1B vs 2A' },
  { outputSlot: 63, sourceA: pickSrc(groupSlot('D', 0)), sourceB: pickSrc(groupSlot('C', 1)), label: '1D vs 2C' },
  { outputSlot: 64, sourceA: pickSrc(groupSlot('F', 0)), sourceB: pickSrc(groupSlot('E', 1)), label: '1F vs 2E' },
  { outputSlot: 65, sourceA: pickSrc(groupSlot('H', 0)), sourceB: pickSrc(groupSlot('G', 1)), label: '1H vs 2G' },
  { outputSlot: 66, sourceA: pickSrc(groupSlot('J', 0)), sourceB: pickSrc(groupSlot('I', 1)), label: '1J vs 2I' },
  { outputSlot: 67, sourceA: pickSrc(groupSlot('L', 0)), sourceB: pickSrc(groupSlot('K', 1)), label: '1L vs 2K' },

  // Advancing 3rd-place matchups (slots 68–71) — PLACEHOLDERS, needs FIFA WC 2026 bracket verification
  { outputSlot: 68, sourceA: pickSrc(advSlot(0)), sourceB: pickSrc(advSlot(1)), label: 'Adv3rd#1 vs Adv3rd#2' },
  { outputSlot: 69, sourceA: pickSrc(advSlot(2)), sourceB: pickSrc(advSlot(3)), label: 'Adv3rd#3 vs Adv3rd#4' },
  { outputSlot: 70, sourceA: pickSrc(advSlot(4)), sourceB: pickSrc(advSlot(5)), label: 'Adv3rd#5 vs Adv3rd#6' },
  { outputSlot: 71, sourceA: pickSrc(advSlot(6)), sourceB: pickSrc(advSlot(7)), label: 'Adv3rd#7 vs Adv3rd#8' },
];

// ─── QF Matchups (slots 72–79) ─────────────────────────────────────────────

/**
 * QF matchups — 8 matchups, outputSlots 72–79.
 * Each sources two adjacent R32 output slots: 56+57→72, 58+59→73, etc.
 */
export const QF_MATCHUPS: Matchup[] = [
  { outputSlot: 72, sourceA: pickSrc(56), sourceB: pickSrc(57), label: 'QF1' },
  { outputSlot: 73, sourceA: pickSrc(58), sourceB: pickSrc(59), label: 'QF2' },
  { outputSlot: 74, sourceA: pickSrc(60), sourceB: pickSrc(61), label: 'QF3' },
  { outputSlot: 75, sourceA: pickSrc(62), sourceB: pickSrc(63), label: 'QF4' },
  { outputSlot: 76, sourceA: pickSrc(64), sourceB: pickSrc(65), label: 'QF5' },
  { outputSlot: 77, sourceA: pickSrc(66), sourceB: pickSrc(67), label: 'QF6' },
  { outputSlot: 78, sourceA: pickSrc(68), sourceB: pickSrc(69), label: 'QF7' },
  { outputSlot: 79, sourceA: pickSrc(70), sourceB: pickSrc(71), label: 'QF8' },
];

// ─── SF Matchups (slots 80–83) ─────────────────────────────────────────────

/**
 * SF matchups — 4 matchups, outputSlots 80–83.
 * Each sources two adjacent QF output slots: 72+73→80, 74+75→81, 76+77→82, 78+79→83.
 */
export const SF_MATCHUPS: Matchup[] = [
  { outputSlot: 80, sourceA: pickSrc(72), sourceB: pickSrc(73), label: 'SF1' },
  { outputSlot: 81, sourceA: pickSrc(74), sourceB: pickSrc(75), label: 'SF2' },
  { outputSlot: 82, sourceA: pickSrc(76), sourceB: pickSrc(77), label: 'SF3' },
  { outputSlot: 83, sourceA: pickSrc(78), sourceB: pickSrc(79), label: 'SF4' },
];

// ─── Semifinal / Final / 3rd Place ─────────────────────────────────────────

/**
 * SF match 1: picks[80] vs picks[81] → winner goes to picks[84]
 */
export const SEMIFINAL_MATCHUP_1: Matchup = {
  outputSlot: 84,
  sourceA: pickSrc(80),
  sourceB: pickSrc(81),
  label: 'Semifinal 1',
};

/**
 * SF match 2: picks[82] vs picks[83] → winner goes to picks[85]
 */
export const SEMIFINAL_MATCHUP_2: Matchup = {
  outputSlot: 85,
  sourceA: pickSrc(82),
  sourceB: pickSrc(83),
  label: 'Semifinal 2',
};

/**
 * Final: picks[84] vs picks[85] → winner goes to picks[86]
 */
export const FINAL_MATCHUP: Matchup = {
  outputSlot: 86,
  sourceA: pickSrc(84),
  sourceB: pickSrc(85),
  label: 'Final',
};

/**
 * 3rd place: loser of SF1 (picks[80]/picks[81]) vs loser of SF2 (picks[82]/picks[83])
 * → winner goes to picks[87]
 */
export const THIRD_PLACE_MATCHUP: Matchup = {
  outputSlot: 87,
  sourceA: { type: 'sfLoser', sfSlots: [80, 81] },
  sourceB: { type: 'sfLoser', sfSlots: [82, 83] },
  label: '3rd Place',
};

/**
 * All knockout matchups in order.
 */
export const ALL_KNOCKOUT_MATCHUPS: Matchup[] = [
  ...R32_MATCHUPS,
  ...QF_MATCHUPS,
  ...SF_MATCHUPS,
  SEMIFINAL_MATCHUP_1,
  SEMIFINAL_MATCHUP_2,
  FINAL_MATCHUP,
  THIRD_PLACE_MATCHUP,
];

// ─── getMatchupTeams ────────────────────────────────────────────────────────

/**
 * Resolves team A and team B for a matchup given the current picks array.
 *
 * For sfLoser sources: the SF participants are picks[sfSlots[0]] and picks[sfSlots[1]].
 * The finalist (winner) is picks[outputSlot - 4] ... actually we determine the winner
 * by looking at which of the two SF participants advanced to the final (picks[84] or picks[85]).
 * The loser is whichever of picks[sfSlots[0]], picks[sfSlots[1]] is NOT the finalist.
 * If the finalist slot is null, return null.
 */
export function getMatchupTeams(
  matchup: Matchup,
  picks: (`0x${string}` | null)[],
  pickNames: (string | null)[],
): MatchupTeams {
  function resolveSource(src: SlotSource): { id: `0x${string}`; name: string } | null {
    if (src.type === 'pick') {
      const id = picks[src.slotIndex];
      const name = pickNames[src.slotIndex];
      if (!id) return null;
      return { id, name: name ?? 'TBD' };
    }
    // sfLoser: src.sfSlots = [sfParticipantSlotA, sfParticipantSlotB]
    // The semifinal winner went to outputSlot 84 (SF1) or 85 (SF2).
    // We need to find the finalist slot for this SF pair.
    // SF1: sfSlots=[80,81] → finalist at slot 84
    // SF2: sfSlots=[82,83] → finalist at slot 85
    const [slotA, slotB] = src.sfSlots;
    // Determine which final slot corresponds to this SF pair
    let finalistSlot: number;
    if (slotA === 80 && slotB === 81) {
      finalistSlot = 84;
    } else if (slotA === 82 && slotB === 83) {
      finalistSlot = 85;
    } else {
      return null;
    }
    const finalistId = picks[finalistSlot];
    if (!finalistId) return null;
    // Find the loser: whichever participant is not the finalist
    const participantA = picks[slotA];
    const participantB = picks[slotB];
    let loserId: `0x${string}` | null = null;
    let loserName: string | null = null;
    if (participantA && participantA !== finalistId) {
      loserId = participantA;
      loserName = pickNames[slotA];
    } else if (participantB && participantB !== finalistId) {
      loserId = participantB;
      loserName = pickNames[slotB];
    }
    if (!loserId) return null;
    return { id: loserId, name: loserName ?? 'TBD' };
  }

  return {
    teamA: resolveSource(matchup.sourceA),
    teamB: resolveSource(matchup.sourceB),
  };
}

// ─── getDownstreamKnockoutSlots ─────────────────────────────────────────────

/**
 * Returns all downstream knockout slot indices that depend on changedSlot.
 * This includes indirect dependencies (transitive closure).
 */
export function getDownstreamKnockoutSlots(changedSlot: number): number[] {
  const result = new Set<number>();

  function visit(slot: number) {
    for (const matchup of ALL_KNOCKOUT_MATCHUPS) {
      if (result.has(matchup.outputSlot)) continue;
      let dependsOnSlot = false;
      for (const source of [matchup.sourceA, matchup.sourceB]) {
        if (source.type === 'pick' && source.slotIndex === slot) {
          dependsOnSlot = true;
          break;
        }
        if (source.type === 'sfLoser') {
          // sfLoser depends on the two SF participant slots and the finalist slot
          const [a, b] = source.sfSlots;
          const finalistSlot = (a === 80 && b === 81) ? 84 : (a === 82 && b === 83) ? 85 : -1;
          if (source.sfSlots.includes(slot as never) || finalistSlot === slot) {
            dependsOnSlot = true;
            break;
          }
        }
      }
      if (dependsOnSlot) {
        result.add(matchup.outputSlot);
        visit(matchup.outputSlot);
      }
    }
  }

  visit(changedSlot);
  return Array.from(result);
}

// ─── createInitialWCState ───────────────────────────────────────────────────

/**
 * Creates initial WCState with group stage pre-filled in FIFA draw order
 * (the order teams appear in ALL_WC_TEAMS, 4 per group).
 * Slots 48–87 are null.
 */
export function createInitialWCState(): WCState {
  const picks: (`0x${string}` | null)[] = new Array(88).fill(null);
  const pickNames: (string | null)[] = new Array(88).fill(null);

  for (const group of GROUPS) {
    const teams = ALL_WC_TEAMS.filter((t) => t.group === group);
    const groupIndex = GROUPS.indexOf(group);
    for (let pos = 0; pos < 4; pos++) {
      const slot = groupIndex * 4 + pos;
      if (teams[pos]) {
        picks[slot] = teams[pos].id;
        pickNames[slot] = teams[pos].name;
      }
    }
  }

  return { picks, pickNames, tiebreaker: 0 };
}

// ─── swapGroupPositions ─────────────────────────────────────────────────────

/**
 * Swaps two positions within a group (drag-to-rank).
 * If pos 2 (3rd-place) is one of the swapped positions, checks advancing-3rd slots
 * (48–55) for the OLD 3rd-place team of this group and clears it + downstream.
 */
export function swapGroupPositions(
  state: WCState,
  group: Group,
  posA: number,
  posB: number,
): WCState {
  const newPicks = [...state.picks];
  const newNames = [...state.pickNames];
  const groupIndex = GROUPS.indexOf(group);
  const slotA = groupIndex * 4 + posA;
  const slotB = groupIndex * 4 + posB;

  if (posA === posB) return state;

  // Identify the old 3rd-place team before the swap (pos 2)
  const thirdSlot = groupIndex * 4 + 2;
  const oldThirdId = newPicks[thirdSlot];

  // Perform the swap
  const tmpId = newPicks[slotA];
  const tmpName = newNames[slotA];
  newPicks[slotA] = newPicks[slotB];
  newNames[slotA] = newNames[slotB];
  newPicks[slotB] = tmpId;
  newNames[slotB] = tmpName;

  // If pos 2 is involved in the swap, handle advancing-3rd cascade
  if (posA === 2 || posB === 2) {
    const newThirdId = newPicks[thirdSlot];
    // If the old 3rd-place team was in any advancing-3rd slot, clear it and downstream
    if (oldThirdId && oldThirdId !== newThirdId) {
      for (let i = 0; i < 8; i++) {
        const advSlotIdx = advSlot(i);
        if (newPicks[advSlotIdx] === oldThirdId) {
          newPicks[advSlotIdx] = null;
          newNames[advSlotIdx] = null;
          // Clear downstream knockout slots that depend on this adv slot
          const downstream = getDownstreamKnockoutSlots(advSlotIdx);
          for (const ds of downstream) {
            newPicks[ds] = null;
            newNames[ds] = null;
          }
        }
      }
    }
  }

  // Also clear downstream knockout slots that depend on the swapped group slots
  // (1st/2nd place changes affect R32 matchups)
  const slotsToInvalidate = [slotA, slotB];
  for (const s of slotsToInvalidate) {
    const downstream = getDownstreamKnockoutSlots(s);
    for (const ds of downstream) {
      newPicks[ds] = null;
      newNames[ds] = null;
    }
  }

  return { picks: newPicks, pickNames: newNames, tiebreaker: state.tiebreaker };
}

// ─── toggleAdvancingThird ───────────────────────────────────────────────────

/**
 * Toggles a team into/out of advancing-3rd slots (48–55). Max 8.
 * Deselecting clears downstream knockout picks.
 */
export function toggleAdvancingThird(
  state: WCState,
  teamId: `0x${string}`,
  teamName: string,
): WCState {
  const newPicks = [...state.picks];
  const newNames = [...state.pickNames];

  // Check if already selected
  const existingIdx = newPicks.slice(48, 56).indexOf(teamId);
  if (existingIdx !== -1) {
    // Deselect: clear slot and downstream
    const slotIdx = 48 + existingIdx;
    newPicks[slotIdx] = null;
    newNames[slotIdx] = null;
    const downstream = getDownstreamKnockoutSlots(slotIdx);
    for (const ds of downstream) {
      newPicks[ds] = null;
      newNames[ds] = null;
    }
    return { picks: newPicks, pickNames: newNames, tiebreaker: state.tiebreaker };
  }

  // Add: find first empty slot in 48–55
  const count = newPicks.slice(48, 56).filter((p) => p !== null).length;
  if (count >= 8) {
    // Already at max — no-op
    return state;
  }
  const emptyIdx = newPicks.slice(48, 56).indexOf(null);
  if (emptyIdx === -1) return state;
  newPicks[48 + emptyIdx] = teamId;
  newNames[48 + emptyIdx] = teamName;

  return { picks: newPicks, pickNames: newNames, tiebreaker: state.tiebreaker };
}

// ─── selectKnockoutWinner ───────────────────────────────────────────────────

/**
 * Sets the winner of a knockout matchup (outputSlot).
 * Clears downstream if winner changed.
 */
export function selectKnockoutWinner(
  state: WCState,
  matchup: Matchup,
  winnerId: `0x${string}`,
  winnerName: string,
): WCState {
  const newPicks = [...state.picks];
  const newNames = [...state.pickNames];
  const { outputSlot } = matchup;

  const oldWinnerId = newPicks[outputSlot];

  newPicks[outputSlot] = winnerId;
  newNames[outputSlot] = winnerName;

  // If winner changed, clear ALL downstream slots unconditionally —
  // a team further along may have beaten the old winner in a later round.
  if (oldWinnerId && oldWinnerId !== winnerId) {
    const downstream = getDownstreamKnockoutSlots(outputSlot);
    for (const ds of downstream) {
      newPicks[ds] = null;
      newNames[ds] = null;
    }
  }

  return { picks: newPicks, pickNames: newNames, tiebreaker: state.tiebreaker };
}

// ─── State Query Helpers ────────────────────────────────────────────────────

/**
 * Returns true when all 88 slots are non-null and tiebreaker > 0.
 */
export function isWCComplete(state: WCState): boolean {
  return state.picks.every((p) => p !== null) && state.tiebreaker > 0;
}

/**
 * Count of non-null picks (0–88).
 */
export function wcPickedCount(state: WCState): number {
  return state.picks.filter((p) => p !== null).length;
}

/**
 * Count of advancing-3rd picks selected (slots 48–55).
 */
export function advancingThirdCount(state: WCState): number {
  return state.picks.slice(48, 56).filter((p) => p !== null).length;
}

/**
 * Returns the 12 third-place team IDs from group stage (slot pos 2 per group), in group order.
 */
export function getThirdPlaceCandidates(
  state: WCState,
): { id: `0x${string}`; name: string; group: Group }[] {
  const results: { id: `0x${string}`; name: string; group: Group }[] = [];
  for (const group of GROUPS) {
    const slot = groupSlot(group, 2);
    const id = state.picks[slot];
    const name = state.pickNames[slot];
    if (id) {
      results.push({ id, name: name ?? 'TBD', group });
    }
  }
  return results;
}

// ─── wcRandomFill ───────────────────────────────────────────────────────────

/**
 * Random fill for testing:
 * 1. Start with createInitialWCState()
 * 2. Shuffle each group's 4 team slots randomly
 * 3. Pick 8 random advancing-3rd teams from thirdPlaceCandidates
 * 4. Fill knockout slots in order (R32 → QF → SF → SF1 → SF2 → Final → 3rd place)
 * 5. Set tiebreaker = random integer 1–6
 */
export function wcRandomFill(): WCState {
  let state = createInitialWCState();
  const newPicks = [...state.picks];
  const newNames = [...state.pickNames];

  // 1. Shuffle each group
  for (const group of GROUPS) {
    const groupIndex = GROUPS.indexOf(group);
    const baseSlot = groupIndex * 4;
    // Fisher-Yates shuffle on the 4 group slots
    for (let i = 3; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmpId = newPicks[baseSlot + i];
      const tmpName = newNames[baseSlot + i];
      newPicks[baseSlot + i] = newPicks[baseSlot + j];
      newNames[baseSlot + i] = newNames[baseSlot + j];
      newPicks[baseSlot + j] = tmpId;
      newNames[baseSlot + j] = tmpName;
    }
  }

  state = { picks: newPicks, pickNames: newNames, tiebreaker: 0 };

  // 2. Pick 8 random advancing-3rd teams
  const candidates = getThirdPlaceCandidates(state);
  // Shuffle candidates
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const advancing = shuffled.slice(0, 8);
  for (let i = 0; i < advancing.length; i++) {
    state = toggleAdvancingThird(state, advancing[i].id, advancing[i].name);
  }

  // 3. Fill knockout matchups in order
  for (const matchup of ALL_KNOCKOUT_MATCHUPS) {
    const { teamA, teamB } = getMatchupTeams(matchup, state.picks, state.pickNames);
    if (!teamA || !teamB) continue;
    const winner = Math.random() < 0.5 ? teamA : teamB;
    state = selectKnockoutWinner(state, matchup, winner.id, winner.name);
  }

  // 4. Set tiebreaker = random integer 1–6
  state = { ...state, tiebreaker: Math.floor(Math.random() * 6) + 1 };

  return state;
}
