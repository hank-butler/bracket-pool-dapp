'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  type BracketState,
  type Game,
  type TeamInfo,
  createEmptyState,
  getGamesForCount,
  getGameTeams,
  selectWinner,
  isComplete,
  randomFill,
} from '@/lib/teams';

// Layout constants
const TEAM_H = 26;
const MATCHUP_H = TEAM_H * 2 + 4; // 2 teams + border
const MATCHUP_GAP = 8;
const ROUND_W = 144;     // matchup width (140) + 4 padding
const CONN_W = 24;
const REGIONS = ['South', 'East', 'Midwest', 'West'] as const;

const REGION_CLASS: Record<string, string> = {
  East: 'region-east',
  West: 'region-west',
  South: 'region-south',
  Midwest: 'region-midwest',
};

interface BracketPickerProps {
  gameCount: number;
  poolName: string;
  onComplete: (picks: (`0x${string}` | null)[], tiebreaker: number) => void;
  disabled?: boolean;
}

interface MatchupPos {
  game: Game;
  x: number;
  y: number;
  centerY: number;
}

export function BracketPicker({ gameCount, onComplete, disabled }: BracketPickerProps) {
  const [state, setState] = useState<BracketState>(() => createEmptyState(gameCount));
  const games = useMemo(() => getGamesForCount(gameCount), [gameCount]);

  const pickedCount = state.picks.filter((p) => p !== null).length;

  const handlePick = useCallback(
    (game: Game, winnerId: `0x${string}`, winnerName: string) => {
      if (disabled) return;
      setState((prev) => selectWinner(prev, game.index, winnerId, winnerName, games));
    },
    [disabled, games],
  );

  const handleRandomize = useCallback(() => {
    if (disabled) return;
    setState(randomFill(gameCount));
  }, [disabled, gameCount]);

  const handleTiebreaker = useCallback(
    (val: string) => {
      if (disabled) return;
      const num = parseInt(val, 10) || 0;
      setState((prev) => ({ ...prev, tiebreaker: num }));
    },
    [disabled],
  );

  const handleSubmit = useCallback(() => {
    if (isComplete(state)) {
      onComplete(state.picks, state.tiebreaker);
    }
  }, [state, onComplete]);

  // For non-63 game brackets, fall back to simple list
  if (gameCount !== 63) {
    return (
      <SimpleBracket
        games={games}
        state={state}
        pickedCount={pickedCount}
        gameCount={gameCount}
        disabled={disabled}
        onPick={handlePick}
        onRandomize={handleRandomize}
        onTiebreaker={handleTiebreaker}
        onSubmit={handleSubmit}
      />
    );
  }

  // Region games: rounds 1-4
  const regionGames = new Map<string, Game[]>();
  for (const r of REGIONS) regionGames.set(r, []);
  for (const g of games) {
    if (g.round >= 1 && g.round <= 4 && g.region) {
      regionGames.get(g.region)!.push(g);
    }
  }

  // Final Four & Championship
  const ffGames = games.filter((g) => g.round === 5);
  const champGame = games.find((g) => g.round === 6)!;

  return (
    <div className="space-y-4">
      {/* Progress + Randomize */}
      <div className="flex items-center justify-between">
        <span className="text-xs">
          Progress: <b>{pickedCount}</b>/{gameCount} games picked
        </span>
        <button
          type="button"
          onClick={handleRandomize}
          disabled={disabled}
          className="btn-90s"
        >
          Randomize
        </button>
      </div>
      <div className="progress-90s">
        <div
          className="progress-90s-fill"
          style={{ width: `${(pickedCount / gameCount) * 100}%` }}
        />
      </div>

      {/* Region Brackets */}
      {REGIONS.map((region) => (
        <RegionBracket
          key={region}
          region={region}
          regionClass={REGION_CLASS[region]}
          games={regionGames.get(region)!}
          picks={state.picks}
          pickNames={state.pickNames}
          onPick={handlePick}
          disabled={disabled}
        />
      ))}

      <hr />

      {/* Final Four + Championship */}
      <FinalFourBracket
        ffGames={ffGames}
        champGame={champGame}
        picks={state.picks}
        pickNames={state.pickNames}
        onPick={handlePick}
        disabled={disabled}
      />

      <hr />

      {/* Tiebreaker + Submit */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-bold">
            Tiebreaker: Predicted championship total points
          </span>
          <input
            type="number"
            min={1}
            value={state.tiebreaker || ''}
            onChange={(e) => handleTiebreaker(e.target.value)}
            disabled={disabled}
            className="input-90s block mt-1 w-32"
            placeholder="e.g. 145"
          />
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !isComplete(state)}
          className="btn-90s-primary w-full py-2 text-sm"
        >
          {isComplete(state) ? 'Submit Bracket' : `Pick all ${gameCount} games & set tiebreaker`}
        </button>
      </div>
    </div>
  );
}

// ─── Region Bracket ─────────────────────────────────────────────────────────

function RegionBracket({
  region,
  regionClass,
  games,
  picks,
  pickNames,
  onPick,
  disabled,
}: {
  region: string;
  regionClass: string;
  games: Game[];
  picks: (`0x${string}` | null)[];
  pickNames: (string | null)[];
  onPick: (game: Game, winnerId: `0x${string}`, winnerName: string) => void;
  disabled?: boolean;
}) {
  const byRound = new Map<number, Game[]>();
  for (const g of games) {
    const arr = byRound.get(g.round) || [];
    arr.push(g);
    byRound.set(g.round, arr);
  }
  const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);

  // Position matchups
  const positions = new Map<number, MatchupPos>();

  // Round 1 (R64): 8 matchups stacked
  const r1Games = (byRound.get(1) || []).sort((a, b) => a.index - b.index);
  r1Games.forEach((game, i) => {
    const y = i * (MATCHUP_H + MATCHUP_GAP);
    positions.set(game.index, { game, x: 0, y, centerY: y + MATCHUP_H / 2 });
  });

  // Later rounds: center between sources
  for (const round of rounds) {
    if (round <= 1) continue;
    const roundIdx = round - 1;
    const roundGames = (byRound.get(round) || []).sort((a, b) => a.index - b.index);

    for (const game of roundGames) {
      const x = roundIdx * (ROUND_W + CONN_W);
      let centerY = 0;

      if (game.sourceGames) {
        const posA = positions.get(game.sourceGames[0]);
        const posB = positions.get(game.sourceGames[1]);
        if (posA && posB) {
          centerY = (posA.centerY + posB.centerY) / 2;
        }
      }

      positions.set(game.index, { game, x, y: centerY - MATCHUP_H / 2, centerY });
    }
  }

  const totalRounds = rounds.length;
  const containerW = totalRounds * ROUND_W + (totalRounds - 1) * CONN_W;
  const r1Count = r1Games.length;
  const containerH = r1Count * MATCHUP_H + (r1Count - 1) * MATCHUP_GAP;

  // Build connectors
  const connectors: { key: string; d: string }[] = [];
  for (const [, pos] of positions) {
    const game = pos.game;
    if (!game.sourceGames) continue;

    for (const srcIdx of game.sourceGames) {
      const srcPos = positions.get(srcIdx);
      if (!srcPos) continue;

      const srcRight = srcPos.x + ROUND_W;
      const midX = srcRight + CONN_W / 2;
      const d = `M ${srcRight} ${srcPos.centerY} H ${midX} V ${pos.centerY} H ${pos.x}`;
      connectors.push({ key: `${srcIdx}-${game.index}`, d });
    }
  }

  return (
    <div className={`mb-4 ${regionClass}`}>
      <div className="bracket-region-title">
        <span className="star">&#9733;</span> {region} Region
      </div>
      <div className="overflow-x-auto">
        <div style={{ position: 'relative', width: containerW, height: containerH }}>
          <svg
            style={{ position: 'absolute', top: 0, left: 0, width: containerW, height: containerH, pointerEvents: 'none' }}
          >
            {connectors.map((c) => (
              <path key={c.key} d={c.d} className="bracket-connector" />
            ))}
          </svg>

          {Array.from(positions.values()).map((pos) => (
            <MatchupBox
              key={pos.game.index}
              game={pos.game}
              picks={picks}
              pickNames={pickNames}
              onPick={onPick}
              disabled={disabled}
              style={{ position: 'absolute', left: pos.x, top: pos.y, width: 140 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Final Four Bracket ─────────────────────────────────────────────────────

function FinalFourBracket({
  ffGames,
  champGame,
  picks,
  pickNames,
  onPick,
  disabled,
}: {
  ffGames: Game[];
  champGame: Game;
  picks: (`0x${string}` | null)[];
  pickNames: (string | null)[];
  onPick: (game: Game, winnerId: `0x${string}`, winnerName: string) => void;
  disabled?: boolean;
}) {
  const sorted = [...ffGames].sort((a, b) => a.index - b.index);

  const positions: MatchupPos[] = [];
  sorted.forEach((game, i) => {
    const y = i * (MATCHUP_H + MATCHUP_GAP * 4);
    positions.push({ game, x: 0, y, centerY: y + MATCHUP_H / 2 });
  });

  const champCenterY = (positions[0].centerY + positions[1].centerY) / 2;
  const champPos: MatchupPos = {
    game: champGame,
    x: ROUND_W + CONN_W,
    y: champCenterY - MATCHUP_H / 2,
    centerY: champCenterY,
  };

  const containerW = 2 * ROUND_W + CONN_W;
  const containerH = positions[1].y + MATCHUP_H;

  const connectors: { key: string; d: string }[] = [];
  for (const semiPos of positions) {
    const srcRight = semiPos.x + ROUND_W;
    const midX = srcRight + CONN_W / 2;
    const d = `M ${srcRight} ${semiPos.centerY} H ${midX} V ${champPos.centerY} H ${champPos.x}`;
    connectors.push({ key: `ff-${semiPos.game.index}`, d });
  }

  return (
    <div className="mb-4 region-final">
      <div className="bracket-region-title">
        <span className="star">&#9733;</span> Final Four &amp; Championship
      </div>
      <div className="overflow-x-auto">
        <div style={{ position: 'relative', width: containerW, height: containerH }}>
          <svg
            style={{ position: 'absolute', top: 0, left: 0, width: containerW, height: containerH, pointerEvents: 'none' }}
          >
            {connectors.map((c) => (
              <path key={c.key} d={c.d} className="bracket-connector" />
            ))}
          </svg>

          {positions.map((pos) => (
            <MatchupBox
              key={pos.game.index}
              game={pos.game}
              picks={picks}
              pickNames={pickNames}
              onPick={onPick}
              disabled={disabled}
              style={{ position: 'absolute', left: pos.x, top: pos.y, width: 140 }}
            />
          ))}

          <MatchupBox
            game={champGame}
            picks={picks}
            pickNames={pickNames}
            onPick={onPick}
            disabled={disabled}
            style={{ position: 'absolute', left: champPos.x, top: champPos.y, width: 140 }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Matchup Box ────────────────────────────────────────────────────────────

function MatchupBox({
  game,
  picks,
  pickNames,
  onPick,
  disabled,
  style,
}: {
  game: Game;
  picks: (`0x${string}` | null)[];
  pickNames: (string | null)[];
  onPick: (game: Game, winnerId: `0x${string}`, winnerName: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const [teamA, teamB] = getGameTeams(game, picks, pickNames);
  const currentPick = picks[game.index];

  return (
    <div className="bracket-matchup" style={style}>
      <TeamRow
        team={teamA}
        isSelected={!!(teamA && currentPick === teamA.id)}
        disabled={disabled || !teamA}
        onClick={() => teamA && onPick(game, teamA.id, teamA.name)}
      />
      <TeamRow
        team={teamB}
        isSelected={!!(teamB && currentPick === teamB.id)}
        disabled={disabled || !teamB}
        onClick={() => teamB && onPick(game, teamB.id, teamB.name)}
        divider
      />
    </div>
  );
}

function TeamRow({
  team,
  isSelected,
  disabled,
  onClick,
  divider,
}: {
  team: TeamInfo | null;
  isSelected: boolean;
  disabled?: boolean;
  onClick: () => void;
  divider?: boolean;
}) {
  if (!team) {
    return (
      <div className={`bracket-team bracket-team-tbd ${divider ? 'bracket-team-divider' : ''}`}>
        <span className="bracket-seed"></span>
        <span className="bracket-team-name">TBD</span>
      </div>
    );
  }

  const seed = team.seed;

  return (
    <div
      className={`bracket-team ${divider ? 'bracket-team-divider' : ''} ${
        isSelected ? 'bracket-team-selected' : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={disabled ? undefined : onClick}
    >
      {seed > 0 && <span className="bracket-seed">{seed}</span>}
      <span className="bracket-team-name">{team.name}</span>
      {isSelected && <span className="bracket-team-dot">&#9679;</span>}
    </div>
  );
}

// ─── Simple Bracket fallback (non-63 game) ──────────────────────────────────

function SimpleBracket({
  games,
  state,
  pickedCount,
  gameCount,
  disabled,
  onPick,
  onRandomize,
  onTiebreaker,
  onSubmit,
}: {
  games: Game[];
  state: BracketState;
  pickedCount: number;
  gameCount: number;
  disabled?: boolean;
  onPick: (game: Game, winnerId: `0x${string}`, winnerName: string) => void;
  onRandomize: () => void;
  onTiebreaker: (val: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs">
          Progress: <b>{pickedCount}</b>/{gameCount} games picked
        </span>
        <button type="button" onClick={onRandomize} disabled={disabled} className="btn-90s">
          Randomize
        </button>
      </div>
      <div className="progress-90s">
        <div className="progress-90s-fill" style={{ width: `${(pickedCount / gameCount) * 100}%` }} />
      </div>

      {games.map((game) => {
        const [teamA, teamB] = getGameTeams(game, state.picks, state.pickNames);
        const currentPick = state.picks[game.index];
        return (
          <div key={game.index} className="panel-90s-inset p-2 flex items-center gap-2">
            <span className="text-xs w-6 text-right">#{game.index + 1}</span>
            <button
              type="button"
              disabled={disabled || !teamA}
              onClick={() => teamA && onPick(game, teamA.id, teamA.name)}
              className={`btn-90s flex-1 text-xs ${teamA && currentPick === teamA.id ? 'btn-90s-primary' : ''}`}
            >
              {teamA?.name || 'TBD'}
            </button>
            <span className="text-xs">vs</span>
            <button
              type="button"
              disabled={disabled || !teamB}
              onClick={() => teamB && onPick(game, teamB.id, teamB.name)}
              className={`btn-90s flex-1 text-xs ${teamB && currentPick === teamB.id ? 'btn-90s-primary' : ''}`}
            >
              {teamB?.name || 'TBD'}
            </button>
          </div>
        );
      })}

      <hr />
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-bold">Tiebreaker: Predicted championship total points</span>
          <input
            type="number"
            min={1}
            value={state.tiebreaker || ''}
            onChange={(e) => onTiebreaker(e.target.value)}
            disabled={disabled}
            className="input-90s block mt-1 w-32"
            placeholder="e.g. 145"
          />
        </label>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !isComplete(state)}
          className="btn-90s-primary w-full py-2 text-sm"
        >
          {isComplete(state) ? 'Submit Bracket' : `Pick all ${gameCount} games & set tiebreaker`}
        </button>
      </div>
    </div>
  );
}
