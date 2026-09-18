import type { GameState, Player } from '../game/types';
import { RESOURCES } from '../game/types';
import { bonusCardById, bottleDef, usableBottles } from '../game/engine';
import { ResourceChip } from './Bits';
import { useInfo } from './InfoSheet';
import type { ArtMap } from '../art/parkArt';
import { ParkCardView } from './ParkCardView';
import { reservedCount } from '../game/view';

export function PlayerPanel({
  player,
  state,
  art,
  revealBonuses,
  open,
  onToggle,
  kitShownAbove,
  mine,
  onUseBottle,
}: {
  player: Player;
  state: GameState;
  art: ArtMap;
  revealBonuses: boolean;
  /** Folded panels show a one-line summary instead of the full holdings. */
  open: boolean;
  onToggle: () => void;
  /** True when the kit bar above the board already carries these. */
  kitShownAbove?: boolean;
  /**
   * Whether this panel is the reader's own seat. On a shared table nobody's
   * panel is, so the label is left off rather than pinned to every human.
   */
  mine?: boolean;
  onUseBottle?: (bottleId: string) => void;
}) {
  const active = state.current === player.index && state.phase === 'playing';
  const vp = player.parks.reduce((sum, p) => sum + p.vp, 0);
  const usable = new Set(usableBottles(player).map((b) => b.id));
  const canUseBottles = !!onUseBottle && active && !state.pending;
  const reserved = reservedCount(state, player.index);
  const info = useInfo();

  return (
    <section className={`player${active ? ' player-active' : ''}`} style={{ borderColor: player.color }}>
      <header className="player-head">
        <button
          type="button"
          className="player-toggle"
          aria-expanded={open}
          onClick={onToggle}
          title={open ? 'Fold this player away' : 'Show this player'}
        >
          <span className="chev" aria-hidden="true">
            ▾
          </span>
          <span className="player-dot" style={{ background: player.color }} aria-hidden="true" />
          <h3>{(mine ?? player.isHuman) && player.name !== 'You' ? `${player.name} (you)` : player.name}</h3>
        </button>
        {state.firstPlayer === player.index && (
          <span className="badge" title="First player token — sets turn order and scores 1 VP">
            1st
          </span>
        )}
        {state.cameraHolder === player.index && (
          <span className="badge badge-camera" title="Holds the camera — photos cost 1 sun">
            📷
          </span>
        )}
        {/* Remounting on a change restarts the bump, so a purchase is visible. */}
        <span key={vp} className="player-vp" title="Park points so far">
          {vp} VP
        </span>
      </header>

      {!kitShownAbove && (
      <div className="player-res">
        {RESOURCES.map((r) => (
          <ResourceChip key={r} resource={r} count={player.resources[r] ?? 0} dim={(player.resources[r] ?? 0) === 0} />
        ))}
        <button
          type="button"
          className="chip chip-info"
          title="Campfire tokens: spend one to share an occupied site"
          onClick={() =>
            info.show({
              title: 'Campfire tokens',
              icon: '🔥',
              lines: [
                'Spend one to move onto a site another hiker already occupies.',
                'Everyone starts each season with one, and it re-lights when your first hiker reaches the Trail End.',
                { label: 'Alight now', value: String(player.campfires) },
              ],
            })
          }
        >
          <span aria-hidden="true">🔥</span>
          <b>{player.campfires}</b>
        </button>
        <button
          type="button"
          className="chip chip-info"
          title="Photos taken"
          onClick={() =>
            info.show({
              title: 'Photos',
              icon: '📸',
              lines: [
                'Each photo scores 1 VP, or 2 VP with the Photo Album.',
                'A photo costs 2 sun, or 1 while you hold the camera.',
                { label: 'Taken', value: String(player.photos) },
              ],
            })
          }
        >
          <span aria-hidden="true">📸</span>
          <b>{player.photos}</b>
        </button>
      </div>
      )}

      {open && (
        <>
      <div className="player-row">
        <span className="player-label">Hikers</span>
        <span className="player-hikers">
          {player.hikers.map((h) => (
            <span key={h.id} className={`pawn${h.finished ? ' pawn-done' : ''}`} style={{ background: player.color }}>
              {h.finished ? '🏕️' : `#${h.position}`}
            </span>
          ))}
        </span>
      </div>

      {!kitShownAbove && (
      <div className="player-row">
        <span className="player-label">Bottles</span>
        <span className="player-bottles">
          {player.bottles.map((bottle) => {
            const def = bottleDef(bottle.kind);
            const ready = !bottle.used && usable.has(bottle.id);
            const label = `${def.name}: 1 water → ${Object.entries(def.gain)
              .map(([r, n]) => `${n} ${r === 'forest' ? 'tree' : r}`)
              .join(' + ')}`;
            if (canUseBottles) {
              return (
                <button
                  key={bottle.id}
                  type="button"
                  className={`bottle${bottle.used ? ' bottle-used' : ''}${ready ? ' bottle-ready' : ''}`}
                  disabled={!ready}
                  onClick={() => onUseBottle?.(bottle.id)}
                  title={bottle.used ? `${def.name} — already used this season` : `Use — ${label}`}
                >
                  <span aria-hidden="true">{def.icon}</span> {def.name}
                  {bottle.used ? ' (used)' : ''}
                </button>
              );
            }
            return (
              <button
                key={bottle.id}
                type="button"
                className={`bottle card-info${bottle.used ? ' bottle-used' : ''}`}
                title={bottle.used ? `${def.name} — already used this season` : label}
                onClick={() =>
                  info.show({
                    title: def.name,
                    icon: def.icon,
                    lines: [
                      label,
                      'Only the water their latest stop paid out will fill a flask.',
                      'One conversion per bottle per season; they refill at the season break.',
                      {
                        label: 'State',
                        value: bottle.used
                          ? 'used this season'
                          : player.waterThisTurn > 0
                            ? 'ready'
                            : 'needs freshly drawn water',
                      },
                    ],
                  })
                }
              >
                <span aria-hidden="true">{def.icon}</span> {def.name}
                {bottle.used ? ' (used)' : ''}
              </button>
            );
          })}
        </span>
      </div>
      )}

      {player.gear.length > 0 && !kitShownAbove && (
        <div className="player-row">
          <span className="player-label">Gear</span>
          <span className="player-gear">
            {player.gear.map((g) => (
              <span key={g.id} className="gear-mini" title={`${g.name}: ${g.text}`}>
                {g.icon} {g.name}
              </span>
            ))}
          </span>
        </div>
      )}

      {reserved > 0 && (
        <div className="player-row">
          <span className="player-label">Reserved</span>
          <span className="mini-parks">
            {player.reserved.map((p) => (
              <ParkCardView key={p.id} park={p} art={art} compact />
            ))}
            {/* On another player's device the cards are theirs to know; only the
                count crosses the table. */}
            {Array.from({ length: reserved - player.reserved.length }, (_, i) => (
              <span key={`hidden-${i}`} className="park-facedown" title="Reserved — only they can see which">
                🎴
              </span>
            ))}
          </span>
        </div>
      )}

      <div className="player-row">
        <span className="player-label">Parks ({player.parks.length})</span>
        <span className="mini-parks">
          {player.parks.length === 0 && <span className="muted">none yet</span>}
          {player.parks.map((p) => (
            <ParkCardView key={p.id} park={p} art={art} compact />
          ))}
        </span>
      </div>

      <div className="player-row">
        <span className="player-label">Bonus cards</span>
        <span className="bonus-list">
          {player.bonusCards.map((id, slot) => {
            const card = bonusCardById(id);
            // A card this device was never told the name of stays face down
            // whatever the reveal flag says: in table mode the only bonus cards
            // that arrive in full are the ones the seat is entitled to read.
            if (!card || (!revealBonuses && !player.isHuman)) {
              return (
                <span key={`${id}-${slot}`} className="bonus-hidden" title="Hidden until scoring">
                  🂠 hidden
                </span>
              );
            }
            return (
              <span key={id} className="bonus" title={card.text}>
                <b>{card.name}</b> — {card.text}
              </span>
            );
          })}
        </span>
      </div>
        </>
      )}
      {!open && (
        <p className="player-fold-summary">
          {player.parks.length} park{player.parks.length === 1 ? '' : 's'} · {player.photos} photo
          {player.photos === 1 ? '' : 's'} · {player.gear.length} gear ·{' '}
          {player.hikers.filter((h) => h.finished).length}/{player.hikers.length} home
        </p>
      )}
    </section>
  );
}
