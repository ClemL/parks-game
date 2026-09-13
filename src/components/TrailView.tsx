import type { GameState } from '../game/types';
import { occupants, siteDef } from '../game/engine';
import type { MoveOption } from '../game/engine';

interface Props {
  state: GameState;
  moves: MoveOption[];
  selectedHiker: string | null;
  onSelectHiker: (id: string) => void;
  onMove: (option: MoveOption) => void;
  interactive: boolean;
}

export function TrailView({ state, moves, selectedHiker, onSelectHiker, onMove, interactive }: Props) {
  const movesFor = (index: number) =>
    moves.filter((m) => m.to === index && (!selectedHiker || m.hikerId === selectedHiker));

  return (
    <div className="trail" role="list" aria-label="Trail">
      {state.trail.map((kind, index) => {
        const def = siteDef(kind);
        const here = occupants(state, index);
        const options = interactive ? movesFor(index) : [];
        const target = options[0];
        const needsFire = target?.useCampfire ?? false;
        const isEnd = index === state.trail.length - 1;

        return (
          <div
            key={index}
            role="listitem"
            className={[
              'site',
              `site-${kind}`,
              index === 0 ? 'site-start' : '',
              isEnd ? 'site-finish' : '',
              target ? 'site-target' : '',
              needsFire ? 'site-target-fire' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <button
              type="button"
              className="site-hit"
              disabled={!target}
              onClick={() => target && onMove(target)}
              title={target ? `Move here${needsFire ? ' (spends a campfire)' : ''}` : def.text}
              aria-label={`${def.name}. ${def.text}${target ? ' Move here.' : ''}`}
            >
              <span className="site-index">{index === 0 ? 'start' : isEnd ? 'end' : index}</span>
              <span className="site-icon" aria-hidden="true">
                {def.icon}
              </span>
              <span className="site-name">{def.name}</span>
              {needsFire && <span className="site-fire-badge">🔥 share</span>}
            </button>

            <div className="site-hikers">
              {here.map((hikerId) => {
                const owner = state.players[Number(hikerId[1])];
                const selectable = interactive && owner.isHuman && !isEnd;
                return (
                  <button
                    key={hikerId}
                    type="button"
                    className={`hiker${selectedHiker === hikerId ? ' hiker-selected' : ''}${
                      selectable ? ' hiker-selectable' : ''
                    }`}
                    style={{ background: owner.color }}
                    onClick={() => selectable && onSelectHiker(hikerId)}
                    disabled={!selectable}
                    title={`${owner.name}'s hiker`}
                    aria-label={`${owner.name}'s hiker${selectedHiker === hikerId ? ', selected' : ''}`}
                  >
                    {owner.isHuman ? '🚶' : owner.name.split(' ')[0][0]}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
