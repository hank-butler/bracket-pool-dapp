'use client';

import { useState, useCallback } from 'react';
import {
  type StandingsState,
  type IplTeam,
  IPL_TEAMS,
  createEmptyStandingsState,
  isStandingsComplete,
} from '@/lib/ipl';
import { getPoolTypeConfig } from '@/lib/poolTypes';

interface StandingsPickerProps {
  gameCount: number;
  onComplete: (picks: (`0x${string}` | null)[], tiebreaker: number) => void;
  disabled?: boolean;
}

export function StandingsPicker({ gameCount, onComplete, disabled }: StandingsPickerProps) {
  const config = getPoolTypeConfig(gameCount);
  const [state, setState] = useState<StandingsState>(() => createEmptyStandingsState());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Teams placed in standings slots
  const placedTeamIds = new Set(state.picks.filter((p): p is `0x${string}` => p !== null));
  const unplacedTeams = IPL_TEAMS.filter((t) => !placedTeamIds.has(t.id));
  const filledCount = state.picks.filter((p) => p !== null).length;

  const placeTeam = useCallback(
    (position: number, team: IplTeam) => {
      if (disabled) return;
      setState((prev) => {
        const newPicks = [...prev.picks];
        const newNames = [...prev.pickNames];

        // If this team is already placed elsewhere, remove it
        const existingIdx = newPicks.indexOf(team.id);
        if (existingIdx !== -1) {
          newPicks[existingIdx] = null;
          newNames[existingIdx] = null;
        }

        // If this position already has a team, swap or clear
        if (newPicks[position] !== null && existingIdx !== -1) {
          // Swap: put the displaced team in the old slot
          newPicks[existingIdx] = prev.picks[position];
          newNames[existingIdx] = prev.pickNames[position];
        }

        newPicks[position] = team.id;
        newNames[position] = team.name;
        return { ...prev, picks: newPicks, pickNames: newNames };
      });
    },
    [disabled],
  );

  const removeTeam = useCallback(
    (position: number) => {
      if (disabled) return;
      setState((prev) => {
        const newPicks = [...prev.picks];
        const newNames = [...prev.pickNames];
        newPicks[position] = null;
        newNames[position] = null;
        return { ...prev, picks: newPicks, pickNames: newNames };
      });
    },
    [disabled],
  );

  const handleRandomize = useCallback(() => {
    if (disabled) return;
    const shuffled = [...IPL_TEAMS].sort(() => Math.random() - 0.5);
    setState({
      picks: shuffled.map((t) => t.id),
      pickNames: shuffled.map((t) => t.name),
      tiebreaker: Math.floor(Math.random() * 400) + 600,
    });
  }, [disabled]);

  const handleTiebreaker = useCallback(
    (val: string) => {
      if (disabled) return;
      const num = parseInt(val, 10) || 0;
      setState((prev) => ({ ...prev, tiebreaker: num }));
    },
    [disabled],
  );

  const handleSubmit = useCallback(() => {
    if (isStandingsComplete(state)) {
      onComplete(state.picks, state.tiebreaker);
    }
  }, [state, onComplete]);

  // Drag handlers for reordering placed teams
  const handleDragStart = useCallback(
    (index: number) => {
      if (disabled) return;
      setDragIndex(index);
    },
    [disabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      setDragOverIndex(index);
    },
    [],
  );

  const handleDrop = useCallback(
    (targetIndex: number, droppedTeam?: IplTeam) => {
      if (disabled) return;

      // Dropping an unplaced team into a slot
      if (droppedTeam) {
        placeTeam(targetIndex, droppedTeam);
        setDragIndex(null);
        setDragOverIndex(null);
        return;
      }

      // Reordering within the standings
      if (dragIndex === null || dragIndex === targetIndex) {
        setDragIndex(null);
        setDragOverIndex(null);
        return;
      }

      setState((prev) => {
        const newPicks = [...prev.picks];
        const newNames = [...prev.pickNames];

        // Swap the two positions
        [newPicks[dragIndex], newPicks[targetIndex]] = [newPicks[targetIndex], newPicks[dragIndex]];
        [newNames[dragIndex], newNames[targetIndex]] = [newNames[targetIndex], newNames[dragIndex]];

        return { ...prev, picks: newPicks, pickNames: newNames };
      });

      setDragIndex(null);
      setDragOverIndex(null);
    },
    [disabled, dragIndex, placeTeam],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const getTeamForSlot = (index: number): IplTeam | null => {
    const id = state.picks[index];
    if (!id) return null;
    return IPL_TEAMS.find((t) => t.id === id) ?? null;
  };

  return (
    <div className="space-y-4">
      {/* Progress + Randomize */}
      <div className="flex items-center justify-between">
        <span className="text-xs">
          Progress: <b>{filledCount}</b>/{gameCount} {config.picksUnit} ranked
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
          style={{ width: `${(filledCount / gameCount) * 100}%` }}
        />
      </div>

      <div className="flex gap-4 flex-col md:flex-row">
        {/* Standings slots */}
        <div className="flex-1">
          <div className="panel-90s p-2 mb-2">
            <span className="text-xs font-bold">Predicted Final Standings</span>
          </div>
          {Array.from({ length: gameCount }, (_, i) => {
            const team = getTeamForSlot(i);
            const isDragOver = dragOverIndex === i;
            return (
              <div
                key={i}
                className={`standings-slot ${isDragOver ? 'standings-slot-dragover' : ''} ${
                  team ? 'standings-slot-filled' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
              >
                <span className="standings-rank">#{i + 1}</span>
                {team ? (
                  <div
                    className="standings-team"
                    draggable={!disabled}
                    onDragStart={() => handleDragStart(i)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="standings-team-abbr">{team.abbreviation}</span>
                    <span className="standings-team-name">{team.name}</span>
                    <button
                      type="button"
                      className="standings-remove"
                      onClick={() => removeTeam(i)}
                      disabled={disabled}
                      title="Remove"
                    >
                      &#10005;
                    </button>
                  </div>
                ) : (
                  <span className="standings-empty">Drop team here</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Unplaced teams */}
        <div className="w-full md:w-48">
          <div className="panel-90s p-2 mb-2">
            <span className="text-xs font-bold">Available Teams</span>
          </div>
          {unplacedTeams.length === 0 ? (
            <p className="text-xs text-[#808080] p-2">All teams placed!</p>
          ) : (
            unplacedTeams.map((team) => (
              <div
                key={team.id}
                className="standings-available-team"
                draggable={!disabled}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', team.id);
                  setDragIndex(null);
                }}
                onDragEnd={handleDragEnd}
              >
                <span className="standings-team-abbr">{team.abbreviation}</span>
                <span className="standings-team-name">{team.name}</span>
              </div>
            ))
          )}

          {/* Quick-fill buttons */}
          {unplacedTeams.length > 0 && (
            <div className="mt-2 space-y-1">
              {unplacedTeams.map((team) => {
                const nextEmpty = state.picks.indexOf(null);
                if (nextEmpty === -1) return null;
                return (
                  <button
                    key={team.id}
                    type="button"
                    className="btn-90s w-full text-xs text-left"
                    disabled={disabled}
                    onClick={() => placeTeam(nextEmpty, team)}
                  >
                    + {team.abbreviation}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <hr />

      {/* Tiebreaker + Submit */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-bold">
            Tiebreaker: {config.tiebreakerLabel}
          </span>
          <input
            type="number"
            min={1}
            value={state.tiebreaker || ''}
            onChange={(e) => handleTiebreaker(e.target.value)}
            disabled={disabled}
            className="input-90s block mt-1 w-32"
            placeholder={config.tiebreakerPlaceholder}
          />
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !isStandingsComplete(state)}
          className="btn-90s-primary w-full py-2 text-sm"
        >
          {isStandingsComplete(state) ? config.submitLabel : config.incompleteLabel}
        </button>
      </div>
    </div>
  );
}
