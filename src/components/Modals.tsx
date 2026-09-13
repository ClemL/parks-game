import type { ArtMap } from '../art/parkArt';
import { bonusCardById, canteensAvailable, claimableParks, effectiveCost, reservableParks, SEASONS, siteDef } from '../game/engine';
import type { GameAction, GameState, Resource } from '../game/types';
import { RESOURCES } from '../game/types';
import { RESOURCE_ICON, RESOURCE_LABEL, CostRow } from './Bits';
import { ParkCardView } from './ParkCardView';

export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  wide?: boolean;
}) {
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`modal${wide ? ' modal-wide' : ''}`}>
        <header className="modal-head">
          <h2>{title}</h2>
          {onClose && (
            <button type="button" className="ghost" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** The choice a human player faces after landing on a site. */
export function DecisionModal({
  state,
  art,
  dispatch,
}: {
  state: GameState;
  art: ArtMap;
  dispatch: (action: GameAction) => void;
}) {
  const pending = state.pending!;
  const player = state.players[pending.player];
  const site = siteDef(state.trail[pending.siteIndex]);

  if (pending.kind === 'vista') {
    return (
      <Modal title="Vista — take any one resource">
        <p className="modal-note">{site.text}</p>
        <div className="choice-grid">
          {RESOURCES.map((r: Resource) => (
            <button key={r} type="button" className="choice" onClick={() => dispatch({ type: 'choose-resource', resource: r })}>
              <span className="choice-icon" aria-hidden="true">
                {RESOURCE_ICON[r]}
              </span>
              {RESOURCE_LABEL[r]}
            </button>
          ))}
        </div>
      </Modal>
    );
  }

  if (pending.kind === 'photo') {
    const free = player.gear.some((g) => g.effect.kind === 'free-photos');
    const canPay = free || (player.resources.sun ?? 0) >= 1;
    return (
      <Modal title="Photo Point">
        <p className="modal-note">
          A photo scores 1 VP (2 VP with the Photo Album). {free ? 'Your Camera makes photos free.' : 'It costs 1 ☀️ sun.'}
        </p>
        <div className="choice-grid">
          <button type="button" className="choice" disabled={!canPay} onClick={() => dispatch({ type: 'choose-photo', take: true })}>
            <span className="choice-icon" aria-hidden="true">
              📷
            </span>
            Take the photo{free ? '' : ' (−1 ☀️)'}
          </button>
          <button type="button" className="choice" onClick={() => dispatch({ type: 'choose-photo', take: false })}>
            <span className="choice-icon" aria-hidden="true">
              ☀️
            </span>
            Skip it, gain 1 sun
          </button>
        </div>
      </Modal>
    );
  }

  if (pending.kind === 'reservation') {
    const options = reservableParks(state);
    return (
      <Modal title="Reservation Desk" wide>
        <p className="modal-note">Reserve one park. It leaves the row and only you may claim it later.</p>
        <div className="card-strip">
          {options.map((park) => (
            <ParkCardView key={park.id} park={park} art={art} onClick={() => dispatch({ type: 'choose-reservation', parkId: park.id })} />
          ))}
          {options.length === 0 && <p className="muted">Nothing left to reserve.</p>}
        </div>
      </Modal>
    );
  }

  // Trail End
  const claimable = claimableParks(state, player.index);
  const free = player.gear.some((g) => g.effect.kind === 'free-photos');
  const canPhoto = free || (player.resources.sun ?? 0) >= 1;
  return (
    <Modal title="Trail End — one action" wide>
      <p className="modal-note">
        Claim a park by paying its cost, take a photo, or rest for 1 sun. Canteens ({canteensAvailable(player)} full) cover
        any single missing resource.
      </p>
      {claimable.length > 0 ? (
        <div className="card-strip">
          {claimable.map((park) => {
            const cost = effectiveCost(player, park);
            const discounted = RESOURCES.some((r) => (cost[r] ?? 0) !== (park.cost[r] ?? 0));
            return (
              <div key={park.id} className="claim-option">
                <ParkCardView park={park} art={art} affordable onClick={() => dispatch({ type: 'trail-end', option: 'claim-park', parkId: park.id })} />
                {discounted && (
                  <div className="claim-discount">
                    pay <CostRow cost={cost} /> with your pass
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted">No park is within reach of your current resources.</p>
      )}
      <div className="choice-grid">
        <button type="button" className="choice" disabled={!canPhoto} onClick={() => dispatch({ type: 'trail-end', option: 'photo' })}>
          <span className="choice-icon" aria-hidden="true">
            📷
          </span>
          Summit photo{free ? '' : ' (−1 ☀️)'}
        </button>
        <button type="button" className="choice" onClick={() => dispatch({ type: 'trail-end', option: 'sun' })}>
          <span className="choice-icon" aria-hidden="true">
            ☀️
          </span>
          Rest — gain 1 sun
        </button>
      </div>
    </Modal>
  );
}

export function SeasonEndModal({ state, onContinue }: { state: GameState; onContinue: () => void }) {
  return (
    <Modal title={`End of season ${state.season}`}>
      <ul className="season-summary">
        {state.players.map((p) => (
          <li key={p.index}>
            <span className="player-dot" style={{ background: p.color }} aria-hidden="true" />
            <b>{p.name}</b>: {p.parks.length} park{p.parks.length === 1 ? '' : 's'} ({p.parks.reduce((s, x) => s + x.vp, 0)} VP),{' '}
            {p.photos} photo{p.photos === 1 ? '' : 's'}
          </li>
        ))}
      </ul>
      <p className="modal-note">
        Sun is not kept between seasons. Canteens refill, hikers return to the trailhead, and the next trail is one site
        longer. First player passes to {state.players[(state.firstPlayer + 1) % state.players.length].name}.
      </p>
      <button type="button" className="primary" onClick={onContinue}>
        Begin season {state.season + 1} of {SEASONS}
      </button>
    </Modal>
  );
}

export function ScoreboardModal({ state, onNewGame }: { state: GameState; onNewGame: () => void }) {
  const scores = state.finalScores ?? [];
  return (
    <Modal title="Final scores" wide>
      <table className="scores">
        <thead>
          <tr>
            <th>Player</th>
            <th>Parks</th>
            <th>Photos</th>
            <th>Bonus</th>
            <th>Leftover</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((score, rank) => {
            const player = state.players[score.player];
            return (
              <tr key={score.player} className={rank === 0 ? 'winner' : ''}>
                <td>
                  <span className="player-dot" style={{ background: player.color }} aria-hidden="true" />
                  {rank === 0 ? '🏆 ' : ''}
                  {player.name}
                </td>
                <td>
                  {score.parkVp} <span className="muted">({player.parks.length})</span>
                </td>
                <td>{score.photoVp}</td>
                <td>
                  {score.bonusVp}
                  <div className="bonus-detail">
                    {score.bonusBreakdown.map((b) => (
                      <span key={b.name}>
                        {b.name}: {b.vp}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{score.leftoverVp}</td>
                <td>
                  <b>{score.total}</b>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="reveal">
        {state.players.map((p) => (
          <div key={p.index} className="reveal-row">
            <b style={{ color: p.color }}>{p.name}</b>
            {p.bonusCards.map((id) => {
              const card = bonusCardById(id);
              return (
                <span key={id} className="bonus">
                  {card.name} — {card.text}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <button type="button" className="primary" onClick={onNewGame}>
        New game
      </button>
    </Modal>
  );
}
