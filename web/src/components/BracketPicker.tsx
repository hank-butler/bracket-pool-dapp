'use client';

import { useState, useCallback } from 'react';
import {
  type BracketState,
  type Game,
  createEmptyState,
  getGamesForCount,
  getGameTeams,
  selectWinner,
  isComplete,
  randomFill,
  ROUND_NAMES,
  GAMES_67,
} from '@/lib/teams';

interface BracketPickerProps {
  gameCount: number;
  onComplete: (picks: (`0x${string}` | null)[], tiebreaker: number) => void;
  disabled?: boolean;
}

export function BracketPicker({ gameCount, onComplete, disabled }: BracketPickerProps) {
  const [state, setState] = useState<BracketState>(() => createEmptyState(gameCount));
  const games = getGamesForCount(gameCount);

  const pickedCount = state.picks.filter((p) => p !== null).length;

  const handlePick = useCallback(
    (game: Game, winnerId: `0x${string}`, winnerName: string) => {
      if (disabled) return;
      setState((prev) => {
        const next = selectWinner(prev, game.index, winnerId, winnerName, games);
        return next;
      });
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

  // Group games by round
  const gamesByRound = new Map<number, Game[]>();
  for (const g of games) {
    const arr = gamesByRound.get(g.round) || [];
    arr.push(g);
    gamesByRound.set(g.round, arr);
  }

  const rounds = Array.from(gamesByRound.keys()).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Progress: {pickedCount}/{gameCount} games picked
        </p>
        <button
          type="button"
          onClick={handleRandomize}
          disabled={disabled}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
        >
          Randomize
        </button>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all"
          style={{ width: `${(pickedCount / gameCount) * 100}%` }}
        />
      </div>

      {rounds.map((round) => {
        const roundGames = gamesByRound.get(round)!;
        // Group by region within round
        const byRegion = new Map<string, Game[]>();
        for (const g of roundGames) {
          const key = g.region || 'Final';
          const arr = byRegion.get(key) || [];
          arr.push(g);
          byRegion.set(key, arr);
        }

        return (
          <div key={round} className="space-y-3">
            <h3 className="text-lg font-semibold border-b pb-1">
              {ROUND_NAMES[round] || `Round ${round}`}
            </h3>
            {Array.from(byRegion.entries()).map(([region, regionGames]) => (
              <div key={region} className="space-y-2">
                {byRegion.size > 1 && (
                  <h4 className="text-sm font-medium text-gray-500 uppercase">{region}</h4>
                )}
                {regionGames.map((game) => (
                  <GameRow
                    key={game.index}
                    game={game}
                    picks={state.picks}
                    pickNames={state.pickNames}
                    onPick={handlePick}
                    disabled={disabled}
                  />
                ))}
              </div>
            ))}
          </div>
        );
      })}

      <div className="border-t pt-4 space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Tiebreaker: Predicted championship total points
          </span>
          <input
            type="number"
            min={1}
            value={state.tiebreaker || ''}
            onChange={(e) => handleTiebreaker(e.target.value)}
            disabled={disabled}
            className="mt-1 block w-32 border rounded px-3 py-2 text-sm disabled:opacity-50"
            placeholder="e.g. 145"
          />
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !isComplete(state)}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isComplete(state) ? 'Submit Bracket' : `Pick all ${gameCount} games & set tiebreaker`}
        </button>
      </div>
    </div>
  );
}

function GameRow({
  game,
  picks,
  pickNames,
  onPick,
  disabled,
}: {
  game: Game;
  picks: (`0x${string}` | null)[];
  pickNames: (string | null)[];
  onPick: (game: Game, winnerId: `0x${string}`, winnerName: string) => void;
  disabled?: boolean;
}) {
  const [teamA, teamB] = getGameTeams(game, picks, pickNames);
  const currentPick = picks[game.index];

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-gray-400 w-6 text-right">#{game.index + 1}</span>
      <div className="flex gap-1 flex-1">
        <TeamButton
          team={teamA}
          isSelected={!!(teamA && currentPick === teamA.id)}
          disabled={disabled || !teamA}
          onClick={() => teamA && onPick(game, teamA.id, teamA.name)}
        />
        <span className="text-gray-400 self-center text-xs">vs</span>
        <TeamButton
          team={teamB}
          isSelected={!!(teamB && currentPick === teamB.id)}
          disabled={disabled || !teamB}
          onClick={() => teamB && onPick(game, teamB.id, teamB.name)}
        />
      </div>
    </div>
  );
}

function TeamButton({
  team,
  isSelected,
  disabled,
  onClick,
}: {
  team: { id: `0x${string}`; name: string } | null;
  isSelected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  if (!team) {
    return (
      <button
        type="button"
        disabled
        className="flex-1 px-3 py-2 text-sm border rounded bg-gray-50 text-gray-400 cursor-not-allowed"
      >
        TBD
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 px-3 py-2 text-sm border rounded transition-colors ${
        isSelected
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white hover:bg-blue-50 border-gray-300'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {team.name}
    </button>
  );
}
