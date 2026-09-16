import type { GameState } from '../game/types';
import { hasTent, occupants, siteDef } from '../game/engine';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { useInfo } from './InfoSheet';
import { useDragPawn } from '../hooks/useDragPawn';
import { RESOURCE_ICON, RESOURCE_LABEL } from './Bits';
import type { MoveOption } from '../game/engine';

interface Props {
  state: GameState;
  moves: MoveOption[];
  selectedHiker: string | null;
  onSelectHiker: (id: string) => void;
  onMove: (option: MoveOption) => void;
  interactive: boolean;
  /** Whose pawns this device may pick up. Seat 0 in single-device play. */
  seat?: number | null;
  /** Table mode: a pawn can be dragged to the site it walks to. */
  draggable?: boolean;
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
  seat = 0,
  draggable = false,
  lastCpuMove,
}: Props) {
  const info = useInfo();
  const strip = useRef<HTMLDivElement>(null);
  useWalkingPawns(strip, state);
  const drag = useDragPawn({
    moves,
    onMove,
    onSelect: onSelectHiker,
    enabled: draggable && interactive,
  });

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
            data-site={index}
            className={[
              'site',
              `site-${kind}`,
              index === 0 ? 'site-start' : '',
              isEnd ? 'site-finish' : '',
              target ? 'site-target' : '',
              needsFire ? 'site-target-fire' : '',
              tent ? 'site-tent' : '',
              lastCpuMove?.index === index ? 'site-just-taken' : '',
              drag.over === index && target ? 'site-drop' : '',
              drag.over === index && !target ? 'site-drop-no' : '',
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
              {here.map((hikerId, slot) => {
                const owner = state.players[Number(hikerId[1])];
                const selectable =
                  interactive && !isEnd && (seat === null ? owner.isHuman : owner.index === seat);
                return (
                  <button
                    key={hikerId}
                    type="button"
                    data-hiker={hikerId}
                    className={`hiker${selectedHiker === hikerId ? ' hiker-selected' : ''}${
                      selectable ? ' hiker-selectable' : ''
                    }${drag.dragging === hikerId ? ' hiker-dragging' : ''}`}
                    {...(selectable ? drag.handlers(hikerId) : {})}
                    // The stack leans a little further right with each pawn, so a
                    // crowded site reads as a crowd rather than one pawn.
                    style={{ background: owner.color, '--slot': slot } as CSSProperties}
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

/** How long a pawn takes to walk to its new site. */
const WALK_MS = 520;

/**
 * Walks the pawns between sites instead of teleporting them. React rebuilds the
 * pawn in its new tile, so the old screen position is remembered per hiker and
 * replayed as a hop from there (a FLIP animation). Positions are measured
 * against the strip's scrolled content, so scrolling the trail never registers
 * as a move.
 */
function useWalkingPawns(strip: RefObject<HTMLDivElement>, state: GameState): void {
  const seen = useRef(new Map<string, { x: number; y: number }>());

  useLayoutEffect(() => {
    const root = strip.current;
    if (!root) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const base = root.getBoundingClientRect();
    const next = new Map<string, { x: number; y: number }>();

    for (const pawn of root.querySelectorAll<HTMLElement>('.hiker')) {
      const id = pawn.dataset.hiker;
      if (!id) continue;
      const box = pawn.getBoundingClientRect();
      const now = {
        x: box.left - base.left + root.scrollLeft,
        y: box.top - base.top + root.scrollTop,
      };
      next.set(id, now);

      const was = seen.current.get(id);
      if (!was || still || typeof pawn.animate !== 'function') continue;
      const dx = was.x - now.x;
      const dy = was.y - now.y;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;

      // Lift off the card while travelling so the pawn is never hidden behind
      // the tile it is passing.
      pawn.style.zIndex = '6';
      const walk = pawn.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(1)` },
          { transform: `translate(${dx / 2}px, ${dy / 2 - 16}px) scale(1.2)`, offset: 0.55 },
          { transform: 'translate(0, 0) scale(1)' },
        ],
        { duration: WALK_MS, easing: 'cubic-bezier(.3, .72, .3, 1)' },
      );
      walk.finished
        .then(() => {
          pawn.style.zIndex = '';
        })
        .catch(() => {
          pawn.style.zIndex = '';
        });
    }

    seen.current = next;
  }, [state, strip]);
}
