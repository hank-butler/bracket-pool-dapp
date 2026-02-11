# Bracket Pool: World Cup 2026 Pivot & Multi-Sport Vision

> **Status:** Approved design. Supersedes March Madness as the primary launch target.
> **Date:** 2026-02-10

---

## Product Vision

**Bracket Pool** is a sport-agnostic prediction pool platform on Ethereum. Users pay USDC to submit bracket/prediction picks for any tournament, winners are determined by an off-chain scorer, and prizes are distributed via Merkle proof claims on-chain.

**Launch target:** FIFA World Cup 2026 (June 11 – July 19, 2026)

**Follow-on sports:** NBA Playoffs, NHL Playoffs, March Madness — each is a new pool with a different scorer module and bracket picker UI. The smart contracts are unchanged across all sports.

**Business model:** 5% fee on all pool entries via bonding curve pricing. Early entries are cheaper, price increases as the pool grows.

**Current state:** Working PoC built for March Madness with:
- Sport-agnostic smart contracts (factory + pool pattern, Merkle distributor)
- Off-chain TypeScript scorer (modular, swappable per sport)
- Next.js frontend (read-only pool list + detail pages)

**What the pivot requires:**
- One contract change: add `sportId` parameter
- New scorer module for World Cup rules
- New frontend bracket picker for group stage + knockout
- Shared sports config directory used by both scorer and frontend
- No changes to the core contract logic (entries, claims, refunds, Merkle distribution)

---

## World Cup 2026 Tournament Format

- **48 teams** in 12 groups of 4 (Groups A–L)
- **Group stage:** 72 matches. Each team plays 3. Top 2 per group advance automatically (24 teams). 8 best 3rd-place teams also advance (32 total).
- **Knockout stage:** Round of 32 → Round of 16 → Quarterfinals → Semifinals → 3rd Place Match → Final (32 matches)
- **Total: 104 matches**

Sources:
- [ESPN: 2026 FIFA World Cup Format](https://www.espn.com/soccer/story/_/id/47108758/2026-fifa-world-cup-format-tiebreakers-fixtures-schedule)
- [FIFA: How the World Cup 26 will work](https://www.fifa.com/en/articles/article-fifa-world-cup-2026-mexico-canada-usa-new-format-tournament-football-soccer)

---

## Pick Structure

Users predict:
1. **Group finishing order** (1st–4th) in each of 12 groups
2. **Which 8 third-place teams advance** to the knockout stage
3. **Which teams survive to each knockout round** (not individual match winners, since matchups aren't known until groups finish)
4. **The tournament winner**
5. **The 3rd place match winner**

### Pick Encoding (bytes32[] Array)

All picks are encoded as a flat `bytes32[88]` array. The contract stores `keccak256(abi.encodePacked(picks))` on-chain. The scorer interprets the array positions.

| Index Range | Count | Content |
|-------------|-------|---------|
| 0–47 | 48 | Group finishing order: 4 teams per group × 12 groups (positions 1st, 2nd, 3rd, 4th in order) |
| 48–55 | 8 | Which 3rd-place teams advance (8 team IDs) |
| 56–71 | 16 | Teams in Round of 16 |
| 72–79 | 8 | Teams in Quarterfinals |
| 80–83 | 4 | Teams in Semifinals |
| 84–85 | 2 | Finalists |
| 86 | 1 | Winner |
| 87 | 1 | 3rd place match winner |
| **Total** | **88** | **`gameCount = 88`** |

Each `bytes32` value is a team identifier: `keccak256(abi.encodePacked("BRA"))` for Brazil, etc. Deterministic from the FIFA country code.

### Pool Creation

```
createPool(usdc, treasury, "World Cup 2026", "worldcup2026", 88, lockTime, finalizeDeadline, basePrice, priceSlope)
```

`gameCount = 88` for World Cup. March Madness remains `gameCount = 67`.

---

## Scoring

### Group Stage

| Pick | Points per Correct | Count | Max Total |
|------|--------------------|-------|-----------|
| Correct 1st place in group | 10 | 12 | 120 |
| Correct 2nd place in group | 8 | 12 | 96 |
| Correct 3rd place in group | 5 | 12 | 60 |
| Correct 4th place in group | 3 | 12 | 36 |
| Correct advancing 3rd-place team | 5 | 8 | 40 |
| **Group subtotal** | | | **352** |

### Knockout Stage

| Round | Points per Correct Team | Teams | Max Total |
|-------|-------------------------|-------|-----------|
| Correct team in Round of 16 | 10 | 16 | 160 |
| Correct team in Quarterfinals | 20 | 8 | 160 |
| Correct team in Semifinals | 40 | 4 | 160 |
| Correct finalist | 80 | 2 | 160 |
| Correct winner | 100 | 1 | 100 |
| Correct 3rd place winner | 40 | 1 | 40 |
| **Knockout subtotal** | | | **780** |

### Total

**Perfect bracket = 1,132 points**

Group stage is worth ~31% of total points. Knockout stage is worth ~69%. The knockout rounds have consistent ~160-point totals per round, weighted toward the later rounds.

### Tiebreaker

Predicted total goals in the Final. Closest to actual total wins. Equal distance splits the prize evenly (same mechanic as March Madness).

### Scorer Validation Rules

Before scoring, the scorer validates each entry's internal consistency:
- Teams in R16 must be a subset of the user's predicted group advancers (1st + 2nd) and advancing 3rd-place picks
- QF teams must be a subset of R16 picks
- SF teams must be a subset of QF picks
- Finalists must be a subset of SF picks
- Winner must be one of the 2 finalists
- 3rd place winner must be one of the 2 semifinal losers (finalists removed from SF picks)

Invalid picks score 0 for that slot — not disqualified entirely. A user who picks an impossible bracket still gets credit for whatever they got right.

---

## Scorer Architecture

The scorer pipeline has sport-agnostic steps (shared) and sport-specific steps (swappable).

### Pipeline Steps

| Step | Sport-Agnostic? | Description |
|------|-----------------|-------------|
| 1. Read entries from events | Yes | Fetch `EntrySubmitted` logs, verify against `picksHash` |
| 2. Read results from contract | Yes | Fetch `gameResults` via `getGameResults()` |
| 3. Validate pick consistency | **No** | Sport-specific rules (group→knockout subset checks) |
| 4. Score entries | **No** | Sport-specific point table and index mapping |
| 5. Rank entries | Yes | Sort by score desc, tiebreaker distance asc, entryId asc |
| 6. Calculate prizes | Yes | Fee formula, even split for ties, dust handling |
| 7. Build Merkle tree | Yes | `StandardMerkleTree.of(values, ['address', 'uint256', 'uint256'])` |
| 8. Verify balances | Yes | Confirm `balanceOf(pool) == sum(prizeAmounts)` post-fee |
| 9. Publish proofs | Yes | Pin to IPFS, admin stores CID on-chain |

### Sport Module Interface

Each sport exports a standard interface:

```typescript
interface SportModule {
  gameCount: number;
  sportId: string;
  scorePicks(picks: `0x${string}`[], results: `0x${string}`[]): number;
  validatePicks(picks: `0x${string}`[]): boolean;
  getTeams(): Team[];
}
```

### Directory Structure

```
shared/
  sports/
    interface.ts              # SportModule type definition
    worldcup2026/
      teams.ts                # 48 teams: id, name, fifaCode, group, flag
      encoding.ts             # INDEX_MAP, gameCount=88
      scoring.ts              # scorePicks(), validatePicks()
    marchmadness2026/
      teams.ts                # 68 teams: id, name, region, seed
      encoding.ts             # INDEX_MAP, gameCount=67
      scoring.ts              # scorePicks(), validatePicks()
    nba2026/
      teams.ts
      encoding.ts
      scoring.ts
```

This directory is imported by both the scorer (`scorer/`) and the frontend (`web/`).

---

## Team Definitions

Each sport/tournament has a static config file defining all teams. Created once when the tournament draw/bracket is announced, committed to the repo.

```typescript
// shared/sports/worldcup2026/teams.ts
export interface Team {
  id: `0x${string}`;       // keccak256(abi.encodePacked(fifaCode))
  name: string;             // "Brazil"
  code: string;             // "BRA"
  group: string;            // "A"
  flag: string;             // "🇧🇷" or URL to flag asset
}

export const teams: Team[] = [
  { id: '0x...', name: 'Brazil', code: 'BRA', group: 'A', flag: '🇧🇷' },
  { id: '0x...', name: 'Germany', code: 'GER', group: 'A', flag: '🇩🇪' },
  // ... 48 teams total
];
```

Team IDs are deterministic: `keccak256(abi.encodePacked("BRA"))`. This means the same team always produces the same bytes32 value across frontend, scorer, and admin tooling.

**Timing:** World Cup 2026 draw already happened (December 2025). Teams and groups are known. March Madness teams are announced on Selection Sunday (mid-March each year).

---

## Contract Changes

**Only one change:** Add `sportId` string to BracketPool and BracketPoolFactory.

### BracketPool.sol

```solidity
// New state variable
string public sportId;

// Constructor adds one parameter
constructor(
    address _usdc,
    address _treasury,
    address _admin,
    string memory _poolName,
    string memory _sportId,    // NEW
    uint256 _gameCount,
    uint256 _lockTime,
    uint256 _finalizeDeadline,
    uint256 _basePrice,
    uint256 _priceSlope
) {
    // ...existing validation...
    sportId = _sportId;
}
```

### BracketPoolFactory.sol

```solidity
function createPool(
    address _usdc,
    address _treasury,
    string calldata _poolName,
    string calldata _sportId,    // NEW
    uint256 _gameCount,
    uint256 _lockTime,
    uint256 _finalizeDeadline,
    uint256 _basePrice,
    uint256 _priceSlope
) external onlyOwner returns (address) {
    BracketPool pool = new BracketPool(
        _usdc, _treasury, msg.sender, _poolName, _sportId,
        _gameCount, _lockTime, _finalizeDeadline, _basePrice, _priceSlope
    );
    // ...existing logic...
}
```

### Impact on Existing Code

- All test files need the extra `_sportId` parameter in constructor calls (e.g., `"marchmadness"`)
- Frontend `usePoolDetails` hook adds `sportId` to the batch read
- Frontend uses `sportId` to select which bracket picker component to render
- Deploy script adds `sportId` parameter
- No logic changes to any existing function

---

## Frontend Architecture

### Sport-Agnostic Layer (Already Built / Shared)

- Pool list page — shows all pools from factory, any sport
- Pool detail page — shows pool stats, status, entry count, value
- Wallet connect, providers, contract config
- Entry submission flow — USDC approve + `pool.enter(picks, tiebreaker)`
- Claim UI — fetch proofs from IPFS, call `pool.claim()`
- Refund UI — check 3 refund conditions, call `pool.refund()`

### Sport-Specific Layer (New Per Sport)

- **Bracket picker** — the UI where users make their picks. Completely different per sport:
  - World Cup: group stage tables (drag to reorder) + knockout advancement picker + tiebreaker input
  - March Madness: single-elimination bracket tree + tiebreaker input
  - NBA/NHL: conference brackets + finals
- **Results display** — showing how a user's picks compared to actual results, highlighted correct/incorrect

### Routing by sportId

The pool detail page reads `sportId` from the contract and dynamically loads the appropriate bracket picker:

```typescript
const sportPickers: Record<string, ComponentType> = {
  'worldcup2026': WorldCupPicker,
  'marchmadness2026': MarchMadnessPicker,
};

const Picker = sportPickers[pool.sportId];
```

---

## Implementation Roadmap

### Phase A: Finish the PoC (Now — next 2-3 weeks)

- Complete manual integration testing (Anvil E2E per `docs/next-steps.md`)
- Build remaining frontend Tasks 3.5-3.8 using March Madness format
- This becomes the demo for investor meetings and raises

### Phase B: Contract Update (1 day)

- Add `sportId` parameter to BracketPool constructor + BracketPoolFactory.createPool
- Update all 64+ Solidity tests with the new parameter
- Update deploy script
- Redeploy to Sepolia

### Phase C: Shared Sports Config (1 week)

- Create `shared/` directory with the `SportModule` interface
- Extract March Madness scoring/encoding into `shared/sports/marchmadness2026/`
- Refactor scorer to use sport module pattern (`pipeline.ts` + swappable sport modules)
- Refactor frontend to dynamically load bracket picker based on `sportId`
- Verify existing March Madness flow still works end-to-end

### Phase D: World Cup Implementation (2-3 weeks)

- Create `shared/sports/worldcup2026/` — teams, encoding, scoring, validation
- Build World Cup bracket picker UI:
  - Group stage: 12 group tables, drag/click to set finishing order
  - 3rd-place picker: select which 8 third-place teams advance
  - Knockout picker: select teams advancing through each round
  - Tiebreaker: "Total goals in the Final" input
- Build results display component
- Populate teams config (draw already happened December 2025)

### Phase E: Testing + Testnet (1-2 weeks)

- Full E2E on Anvil with World Cup format (88 picks, new scoring)
- Deploy to Sepolia, create test World Cup pool, run full flow
- Audit / peer review of the `sportId` contract change
- Stress test scorer with large entry counts

### Phase F: Mainnet Launch (before June 11, 2026)

- Deploy to Ethereum mainnet
- Create first World Cup 2026 pool
- Pin team config and scoring rules to IPFS for transparency
- Marketing push

### Future Sports (Post-Launch)

Each new sport is Phase D only — add a sport module + bracket picker. No contract changes, no scorer pipeline changes, no redeployment.

- **NBA Playoffs 2026** — 16 teams, conference brackets, 4 rounds, best-of-7 series predictions
- **NHL Playoffs 2026** — similar to NBA format
- **March Madness 2027** — already built, just update teams config on Selection Sunday

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Group stage pick format | Predict finishing order (1st-4th) | Standard pool format, good differentiation |
| 3rd-place advancement | Users predict which 8 advance | More skill expression, authentic to format |
| Knockout picks | Predict teams in each round, not match winners | Matchups unknown until groups finish |
| Scoring | Tiered: 10/8/5/3 for group positions, escalating for knockout | Rewards harder predictions more |
| Tiebreaker | Total goals in the Final | Simple, mirrors March Madness approach |
| Pick encoding | Flat bytes32[88] array | Contract stays sport-agnostic |
| Contract changes | Add `sportId` only | Minimal change, high value for multi-sport |
| Team definitions | Static config per tournament | Simple, determined by draw, no on-chain cost |
| Sport modularity | Shared directory with standard interface | One codebase, multiple sports |
| Launch target | World Cup 2026 (June 11) | ~4 months runway, massive audience |
