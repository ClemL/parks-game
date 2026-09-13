import type { GameState, Player } from '../game/types';
import { RESOURCES } from '../game/types';
import { bonusCardById, canteensAvailable } from '../game/engine';
import { ResourceChip } from './Bits';
import type { ArtMap } from '../art/parkArt';
import { ParkCardView } from './ParkCardView';

export function PlayerPanel({
  player,
  state,
  art,
  revealBonuses,
}: {
  player: Player;
  state: GameState;
  art: ArtMap;
  revealBonuses: boolean;
}) {
  const active = state.current === player.index && state.phase === 'playing';
  const vp = player.parks.reduce((sum, p) => sum + p.vp, 0);
  const canteens = canteensAvailable(player);

  return (
    <section className={`player${active ? ' player-active' : ''}`} style={{ borderColor: player.color }}>
      <header className="player-head">
        <span className="player-dot" style={{ background: player.color }} aria-hidden="true" />
        <h3>
          {player.name}
          {player.isHuman ? ' (you)' : ''}
        </h3>
        {state.firstPlayer === player.index && <span className="badge" title="First player">1st</span>}
        <span className="player-vp" title="Park points so far">
          {vp} VP
        </span>
      </header>

      <div className="player-res">
        {RESOURCES.map((r) => (
          <ResourceChip key={r} resource={r} count={player.resources[r] ?? 0} dim={(player.resources[r] ?? 0) === 0} />
        ))}
        <span className="chip" title={`${canteens} of ${player.canteens.total} canteens full (each is one wild resource)`}>
          <span aria-hidden="true">🧴</span>
          <b>
            {canteens}/{player.canteens.total}
          </b>
        </span>
        <span className="chip" title="Campfire tokens: spend one to share an occupied site">
          <span aria-hidden="true">🔥</span>
          <b>{player.campfires}</b>
        </span>
        <span className="chip" title="Photos taken">
          <span aria-hidden="true">📷</span>
          <b>{player.photos}</b>
        </span>
      </div>

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

      {player.gear.length > 0 && (
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

      {player.reserved.length > 0 && (
        <div className="player-row">
          <span className="player-label">Reserved</span>
          <span className="mini-parks">
            {player.reserved.map((p) => (
              <ParkCardView key={p.id} park={p} art={art} compact />
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
          {player.bonusCards.map((id) => {
            const card = bonusCardById(id);
            if (!revealBonuses && !player.isHuman) {
              return (
                <span key={id} className="bonus-hidden" title="Hidden until scoring">
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
    </section>
  );
}
