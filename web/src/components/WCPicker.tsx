'use client';
import { useState, useCallback } from 'react';
import {
  GROUPS,
  createInitialWCState,
  swapGroupPositions,
  toggleAdvancingThird,
  selectKnockoutWinner,
  isWCComplete,
  wcPickedCount,
  wcRandomFill,
  type WCState,
  type Matchup,
  type Group,
} from '@/lib/wc-bracket';
import { getPoolTypeConfig } from '@/lib/poolTypes';

const TOTAL_PICKS = 88;
const POS_LABELS = ['1st', '2nd', '3rd', '4th'];

interface WCPickerProps {
  gameCount: number;
  poolName: string;
  onComplete: (picks: (`0x${string}` | null)[], tiebreaker: number) => void;
  disabled?: boolean;
}

export function WCPicker({ gameCount: _gameCount, poolName, onComplete, disabled }: WCPickerProps) {
  const [state, setState] = useState<WCState>(() => createInitialWCState());
  const poolConfig = getPoolTypeConfig(poolName);

  const pickedCount = wcPickedCount(state);
  const complete = isWCComplete(state);

  const handleRandomize = useCallback(() => {
    if (disabled) return;
    setState(wcRandomFill());
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
    if (isWCComplete(state)) {
      onComplete(state.picks, state.tiebreaker);
    }
  }, [state, onComplete]);

  const handleGroupSwap = useCallback(
    (group: Group, posA: number, posB: number) => {
      if (disabled) return;
      setState((prev) => swapGroupPositions(prev, group, posA, posB));
    },
    [disabled],
  );

  const handleAdvancingToggle = useCallback(
    (id: `0x${string}`, name: string) => {
      if (disabled) return;
      setState((prev) => toggleAdvancingThird(prev, id, name));
    },
    [disabled],
  );

  const handleKnockoutPick = useCallback(
    (matchup: Matchup, id: `0x${string}`, name: string) => {
      if (disabled) return;
      setState((prev) => selectKnockoutWinner(prev, matchup, id, name));
    },
    [disabled],
  );

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <span className="text-xs">
          Progress: <b>{pickedCount}</b>/{TOTAL_PICKS} picks filled
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
          style={{ width: `${(pickedCount / TOTAL_PICKS) * 100}%` }}
        />
      </div>

      <GroupStageSection state={state} disabled={disabled} onSwap={handleGroupSwap} />

      <hr />

      <AdvancingThirdSection state={state} disabled={disabled} onToggle={handleAdvancingToggle} />

      <hr />

      <KnockoutSection state={state} disabled={disabled} onPick={handleKnockoutPick} />

      <hr />

      {/* Tiebreaker + Submit */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-bold">{poolConfig.tiebreakerLabel}</span>
          <input
            type="number"
            min={1}
            value={state.tiebreaker || ''}
            onChange={(e) => handleTiebreaker(e.target.value)}
            disabled={disabled}
            className="input-90s block mt-1 w-32"
            placeholder={poolConfig.tiebreakerPlaceholder}
          />
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !complete}
          className="btn-90s-primary w-full py-2 text-sm"
        >
          {complete ? poolConfig.submitLabel : poolConfig.incompleteLabel}
        </button>
      </div>
    </div>
  );
}

// ─── GroupStageSection ───────────────────────────────────────────────────────

function GroupStageSection({
  state,
  disabled,
  onSwap,
}: {
  state: WCState;
  disabled?: boolean;
  onSwap: (group: Group, posA: number, posB: number) => void;
}) {
  return (
    <div>
      <div className="bracket-region-title">
        <span className="star">&#9733;</span> Group Stage &mdash; Rank Each Group
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '12px',
        }}
      >
        {GROUPS.map((group) => {
          const groupIndex = GROUPS.indexOf(group);
          const teams = [0, 1, 2, 3].map((pos) => {
            const slot = groupIndex * 4 + pos;
            return {
              id: state.picks[slot],
              name: state.pickNames[slot] ?? 'TBD',
              pos,
            };
          });
          return (
            <GroupCard
              key={group}
              group={group}
              teams={teams}
              disabled={disabled}
              onSwap={(posA, posB) => onSwap(group, posA, posB)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── GroupCard ───────────────────────────────────────────────────────────────

function GroupCard({
  group,
  teams,
  disabled,
  onSwap,
}: {
  group: Group;
  teams: { id: `0x${string}` | null; name: string; pos: number }[];
  disabled?: boolean;
  onSwap: (posA: number, posB: number) => void;
}) {
  const [draggingPos, setDraggingPos] = useState<number | null>(null);
  const [overPos, setOverPos] = useState<number | null>(null);

  return (
    <div className="panel-90s p-2">
      <div className="bracket-region-title text-xs mb-1">Group {group}</div>
      {teams.map(({ id, name, pos }) => {
        const isDragging = draggingPos === pos;
        const isOver = overPos === pos && draggingPos !== pos;

        const rowClass = [
          'bracket-team',
          pos > 0 ? 'bracket-team-divider' : '',
          isDragging ? 'opacity-40' : '',
          isOver ? 'bracket-team-selected' : '',
          disabled ? 'cursor-not-allowed' : 'cursor-grab',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div
            key={pos}
            className={rowClass}
            draggable={!disabled}
            onDragStart={() => setDraggingPos(pos)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverPos(pos);
            }}
            onDrop={() => {
              if (draggingPos !== null && draggingPos !== pos) {
                onSwap(draggingPos, pos);
              }
              setDraggingPos(null);
              setOverPos(null);
            }}
            onDragEnd={() => {
              setDraggingPos(null);
              setOverPos(null);
            }}
          >
            <span className="text-xs mr-1 text-gray-500 select-none">&#8801;</span>
            <span className="bracket-seed text-xs">{POS_LABELS[pos]}</span>
            <span className="bracket-team-name text-xs">{id ? name : 'TBD'}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Stubs ───────────────────────────────────────────────────────────────────

function AdvancingThirdSection({
  state: _state,
  disabled: _disabled,
  onToggle: _onToggle,
}: {
  state: WCState;
  disabled?: boolean;
  onToggle: (id: `0x${string}`, name: string) => void;
}) {
  return (
    <div className="panel-90s p-2 text-xs text-center">
      Advancing 3rd &mdash; coming next
    </div>
  );
}

function KnockoutSection({
  state: _state,
  disabled: _disabled,
  onPick: _onPick,
}: {
  state: WCState;
  disabled?: boolean;
  onPick: (matchup: Matchup, id: `0x${string}`, name: string) => void;
}) {
  return (
    <div className="panel-90s p-2 text-xs text-center">
      Knockout bracket &mdash; coming next
    </div>
  );
}
