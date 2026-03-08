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
  getThirdPlaceCandidates,
  advancingThirdCount,
  getMatchupTeams,
  R32_MATCHUPS,
  QF_MATCHUPS,
  SF_MATCHUPS,
  SEMIFINAL_MATCHUP_1,
  SEMIFINAL_MATCHUP_2,
  FINAL_MATCHUP,
  THIRD_PLACE_MATCHUP,
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

export function WCPicker({ gameCount, poolName, onComplete, disabled }: WCPickerProps) {
  if (process.env.NODE_ENV !== 'production' && gameCount !== 88) {
    console.warn(`WCPicker: expected gameCount 88 but received ${gameCount}`);
  }
  const [state, setState] = useState<WCState>(() => createInitialWCState());
  const poolConfig = getPoolTypeConfig(poolName);

  const pickedCount = wcPickedCount(state);
  const complete = isWCComplete(state);

  const handleRandomize = useCallback(() => {
    if (disabled) return;
    setState(() => wcRandomFill());
  }, [disabled]);

  const handleTiebreaker = useCallback(
    (val: string) => {
      if (disabled) return;
      if (val === '') return;
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
    <div className="panel-90s p-2" onDragLeave={() => setOverPos(null)}>
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
  state,
  disabled,
  onToggle,
}: {
  state: WCState;
  disabled?: boolean;
  onToggle: (id: `0x${string}`, name: string) => void;
}) {
  const candidates = getThirdPlaceCandidates(state);
  const selectedCount = advancingThirdCount(state);
  const atMax = selectedCount >= 8;

  const selectedIds = new Set(
    state.picks.slice(48, 56).filter((p): p is `0x${string}` => p !== null),
  );

  return (
    <div>
      <div className="bracket-region-title">
        <span className="star">&#9733;</span> Advancing 3rd-Place Teams &mdash; Pick 8
      </div>
      <p className="text-xs mb-2">
        Selected: <b>{selectedCount}</b> / 8{' '}
        {selectedCount < 8 && (
          <span className="status-warning">({8 - selectedCount} more needed)</span>
        )}
        {selectedCount === 8 && <span className="status-success">Complete ✓</span>}
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '6px',
        }}
      >
        {candidates.map(({ id, name, group }) => {
          const isSelected = selectedIds.has(id);
          const isDisabledBtn = disabled || (!isSelected && atMax);
          return (
            <button
              key={id}
              type="button"
              disabled={isDisabledBtn}
              onClick={() => onToggle(id, name)}
              className={[
                'btn-90s text-xs py-1',
                isSelected ? 'btn-90s-primary' : '',
                isDisabledBtn ? 'opacity-50 cursor-not-allowed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              title={`Group ${group} 3rd place`}
            >
              <span className="text-xs text-gray-500 mr-1">{group}</span>
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── WCMatchupBox ─────────────────────────────────────────────────────────────

function WCMatchupBox({
  matchup,
  state,
  disabled,
  onPick,
}: {
  matchup: Matchup;
  state: WCState;
  disabled?: boolean;
  onPick: (matchup: Matchup, id: `0x${string}`, name: string) => void;
}) {
  const { teamA, teamB } = getMatchupTeams(matchup, state.picks, state.pickNames);
  const currentPick = state.picks[matchup.outputSlot];

  return (
    <div className="bracket-matchup" style={{ minWidth: 160, marginBottom: 4 }}>
      <div className="text-xs text-gray-500 px-1 pb-1">{matchup.label}</div>
      {([teamA, teamB] as const).map((team, i) => {
        const isSelected = !!(team && currentPick === team.id);
        const isDisabled = disabled || !team;
        return (
          <div
            key={i}
            className={[
              'bracket-team',
              i > 0 ? 'bracket-team-divider' : '',
              isSelected ? 'bracket-team-selected' : '',
              isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              !team ? 'bracket-team-tbd' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={isDisabled ? undefined : () => team && onPick(matchup, team.id, team.name)}
          >
            <span className="bracket-team-name text-xs">{team?.name ?? 'TBD'}</span>
            {isSelected && <span className="bracket-team-dot">&#9679;</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── KnockoutSection ─────────────────────────────────────────────────────────

const KNOCKOUT_ROUNDS = [
  { label: 'Round of 32', matchups: R32_MATCHUPS },
  { label: 'Quarterfinals', matchups: QF_MATCHUPS },
  { label: 'Quarterfinal Winners — Pick Semifinalists', matchups: SF_MATCHUPS },
  { label: 'Semifinals — Pick Finalists', matchups: [SEMIFINAL_MATCHUP_1, SEMIFINAL_MATCHUP_2] },
  { label: 'Final + 3rd Place', matchups: [FINAL_MATCHUP, THIRD_PLACE_MATCHUP] },
];

function KnockoutSection({
  state,
  disabled,
  onPick,
}: {
  state: WCState;
  disabled?: boolean;
  onPick: (matchup: Matchup, id: `0x${string}`, name: string) => void;
}) {
  return (
    <div>
      <div className="bracket-region-title">
        <span className="star">&#9733;</span> Knockout Bracket
      </div>
      {disabled && (
        <p className="text-xs text-gray-500 mb-2">
          Select 8 advancing 3rd-place teams above to unlock the knockout bracket.
        </p>
      )}
      {KNOCKOUT_ROUNDS.map(({ label, matchups }) => (
        <div key={label} className="mb-4">
          <div className="text-xs font-bold mb-2">{label}</div>
          <div className="overflow-x-auto">
            <div className="flex flex-wrap gap-2">
              {matchups.map((matchup) => (
                <WCMatchupBox
                  key={matchup.outputSlot}
                  matchup={matchup}
                  state={state}
                  disabled={disabled}
                  onPick={onPick}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
