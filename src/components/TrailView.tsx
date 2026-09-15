import type { GameState } from '../game/types';
import { hasTent, occupants, siteDef } from '../game/engine';
import { useEffect, useRef } from 'react';
import { useInfo } from './InfoSheet';
import { RESOURCE_LABEL } from './Bits';
import type { MoveOption } from '../game/engine';
import { RESOURCE_ICON } from './Bits';

interface Props {
  state: GameState;
  moves: MoveOption[];
  selectedHiker: string | null;
  onSelectHiker: (id: string) => void;
  onMove: (option: MoveOption) => void;
  interactive: boolean;
  /** The site a CPU just stepped onto, highlighted briefly. */
  lastCpuMove?: { index: number; player: number } | null;
}

export function TrailView({
  state,
  moves,
  selectedHiker,
  onSelectHiker,
  onMove,
  interactive,
  lastCpuMove,
}: Props) {
  const info = useInfo();
  const strip = useRef<HTMLDivElement>(null);

  // Bring the nearest site you could actually move to into view, so the trail
  // does not have to be hunted along by hand.
  const firstTarget = moves
    .filter((m) => !selectedHiker || m.hikerId === selectedHiker)
    .map((m) => m.to)
    .sort((a, b) => a - b)[0];
  useEffect(() => {
    if (firstTarget === undefined || !strip.current) return;
    const tile = strip.current.children[firstTarget] as HTMLElement | undefined;
    tile?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [firstTarget]);

  const movesFor = (index: number) =>
    moves.filter((m) => m.to === index && (!selectedHiker || m.hikerId === selectedHiker));

  /** Tapping a site you cannot move to explains what it does instead. */
  const explain = (index: number) => {
    const def = siteDef(state.trail[index]);
    const token = state.siteTokens[index];
    const here = occupants(state, index).map((id) => state.players[Number(id[1])].name);
    info.show({
      title: def.name,
      icon: def.icon,
      lines: [
        def.text,
        ...(token ? [{ label: 'Season token', value: `1 ${RESOURCE_LABEL[token]} to the first hiker here` }] : []),
        ...(hasTent(state, index)
          ? ['Tent site: camp here instead of taking the action, if a campsite is open.']
          : []),
        ...(here.length > 0 ? [{ label: 'Occupied by', value: here.join(', ') }] : []),
        ...(def.capacity === Infinity ? ['Unlimited room.'] : ['One hiker at a time, unless a campfire is spent.']),
      ],
    });
  };

  return (
    <div className="trail" role="list" aria-label="Trail" ref={strip}>
      {state.trail.map((kind, index) => {
        const def = siteDef(kind);
        const here = occupants(state, index);
        const token = state.siteTokens[index];
        const tent = hasTent(state, index);
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
              tent ? 'site-tent' : '',
              lastCpuMove?.index === index ? 'site-just-taken' : '',
              siteDef(kind).tier === 'advanced' ? 'site-advanced' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <button
              type="button"
              className={`site-hit${target ? '' : ' site-hit-info'}`}
              onClick={() => (target ? onMove(target) : explain(index))}
              title={target ? `Move here${needsFire ? ' (spends a campfire)' : ''}` : def.text}
              aria-label={`${def.name}. ${def.text}${
                token ? ` A ${token} season token is still here.` : ''
              }${target ? ' Move here.' : ' Tap to read what it does.'}`}
            >
              <span className="site-index">
                {index === 0 ? 'start' : isEnd ? 'end' : index}
                {tent && (
                  <span className="site-tent-badge" title="Tent site: camp here instead of taking the site action">
                    ⛺
                  </span>
                )}
              </span>
              <span className="site-icon" aria-hidden="true">
                {def.icon}
              </span>
              <span className="site-name">{def.name}</span>
              {token && (
                <span className="site-token" title={`First hiker here also takes 1 ${token}`}>
                  <span aria-hidden="true">{RESOURCE_ICON[token]}</span>
                </span>
              )}
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
