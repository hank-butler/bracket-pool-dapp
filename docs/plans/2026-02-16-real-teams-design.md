# Replace Placeholder Teams with Real 2025 March Madness Data

> **Status:** Approved
> **Date:** 2026-02-16

---

## Problem

The frontend uses placeholder team names like "East 1", "West 12", "First Four 3" generated programmatically in `web/src/lib/teams.ts`. These need to be replaced with real 2025 NCAA Tournament teams for the PoC to look credible.

Additionally, the current code assumes 67 games (4 First Four + 63 main bracket). We're simplifying to a 63-game bracket that drops First Four picks entirely.

---

## Decision: 63-Game Bracket, No First Four Picks

- **gameCount = 63** (was 67)
- **64 teams** in the main bracket (16 per region)
- All 68 tournament teams are in the config (including 8 First Four teams), but users only pick 63 games (Round of 64 through Championship)
- First Four play-in results are resolved on the frontend before lock time — the 4 winners slot into their R64 positions
- Lock time is set to Thursday (Round of 64 start), giving users until after First Four games to finalize picks
- No contract or scorer changes needed for First Four handling — it's purely a frontend concern

### First Four Flow

1. Before First Four (Tuesday): Bracket shows "TBD" or both options for 4 play-in slots
2. After First Four (Wednesday night): Teams config is updated with winners; they appear in R64
3. Lock time (Thursday): Picks are locked, main tournament starts

The "update" is a one-line change per play-in game in the teams config file.

---

## Game Index Layout (63 games)

| Index Range | Count | Round |
|-------------|-------|-------|
| 0-31 | 32 | Round of 64 (8 per region) |
| 32-47 | 16 | Round of 32 (4 per region) |
| 48-55 | 8 | Sweet 16 (2 per region) |
| 56-59 | 4 | Elite 8 (1 per region) |
| 60-61 | 2 | Final Four |
| 62 | 1 | Championship |
| **Total** | **63** | |

---

## Scoring (63-game bracket)

| Round | Points per Correct | Games | Max Total |
|-------|--------------------|-------|-----------|
| Round of 64 | 10 | 32 | 320 |
| Round of 32 | 20 | 16 | 320 |
| Sweet 16 | 40 | 8 | 320 |
| Elite 8 | 80 | 4 | 320 |
| Final Four | 160 | 2 | 320 |
| Championship | 320 | 1 | 320 |
| **Total** | | **63** | **1,920** |

---

## 2025 March Madness Teams

### South Region
| Seed | Team |
|------|------|
| 1 | Auburn |
| 2 | Michigan State |
| 3 | Iowa State |
| 4 | Texas A&M |
| 5 | Michigan |
| 6 | Ole Miss |
| 7 | Marquette |
| 8 | Louisville |
| 9 | Creighton |
| 10 | New Mexico |
| 11 | TBD (San Diego State vs North Carolina) |
| 12 | UC San Diego |
| 13 | Yale |
| 14 | Lipscomb |
| 15 | Bryant |
| 16 | TBD (Alabama State vs St. Francis) |

### East Region
| Seed | Team |
|------|------|
| 1 | Duke |
| 2 | Alabama |
| 3 | Wisconsin |
| 4 | Arizona |
| 5 | Oregon |
| 6 | BYU |
| 7 | Saint Mary's |
| 8 | Mississippi State |
| 9 | Baylor |
| 10 | Vanderbilt |
| 11 | VCU |
| 12 | Liberty |
| 13 | Akron |
| 14 | Montana |
| 15 | Robert Morris |
| 16 | TBD (American vs Mount St. Mary's) |

### Midwest Region
| Seed | Team |
|------|------|
| 1 | Houston |
| 2 | Tennessee |
| 3 | Kentucky |
| 4 | Purdue |
| 5 | Clemson |
| 6 | Illinois |
| 7 | UCLA |
| 8 | Gonzaga |
| 9 | Georgia |
| 10 | Utah State |
| 11 | TBD (Texas vs Xavier) |
| 12 | McNeese |
| 13 | High Point |
| 14 | Troy |
| 15 | Wofford |
| 16 | SIUE |

### West Region
| Seed | Team |
|------|------|
| 1 | Florida |
| 2 | St. John's |
| 3 | Texas Tech |
| 4 | Maryland |
| 5 | Memphis |
| 6 | Missouri |
| 7 | Kansas |
| 8 | UConn |
| 9 | Oklahoma |
| 10 | Arkansas |
| 11 | Drake |
| 12 | Colorado State |
| 13 | Grand Canyon |
| 14 | UNCW |
| 15 | Omaha |
| 16 | Norfolk State |

### First Four Play-In Teams (resolved before lock, not directly picked)
- South 11: San Diego State vs North Carolina
- South 16: Alabama State vs St. Francis
- Midwest 11: Texas vs Xavier
- East 16: American vs Mount St. Mary's

---

## Files Changed

| File | Change |
|------|--------|
| `web/src/lib/teams.ts` | Replace `generateTeams()` with static 64-team array using real 2025 data. Remove First Four game logic from `buildGames`. Update `getGameTeams` to remove play-in handling. Update `GAMES_67` to `GAMES_63`. Update `ROUND_NAMES` (remove "First Four"). |
| `scorer/src/scoring.ts` | Update `getPointsForGame()` index ranges for 63-game layout. |
| `scorer/src/scoring.test.ts` | Update test expectations for new index ranges. |

## Files NOT Changed

- Smart contracts (gameCount is a pool creation parameter)
- BracketPicker component (reads from teams.ts exports)
- Entry/Claim/Refund flows
- Contract tests (existing tests use whatever gameCount they pass)

---

## Team Data Strategy

- **Now:** Populate with real 2025 March Madness teams (static config file)
- **2026 Selection Sunday:** Paste bracket data into Claude Code to regenerate the file
- **First Four resolution:** Update 4 TBD slots in config after play-in games finish (before lock time)
- **Future sports (World Cup etc.):** Same pattern — static config file per tournament, committed to repo
