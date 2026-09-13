import type { ArtMap } from '../art/parkArt';
import {
  affordableGear,
  bonusCardById,
  canAffordPhoto,
  claimableParks,
  effectiveCost,
  gearCost,
  photoCost,
  reservableParks,
  SEASONS,
} from '../game/engine';
import type { GameAction, GameState } from '../game/types';
import { COST_RESOURCES } from '../game/types';
import { CostRow } from './Bits';
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
  const cost = photoCost(state, player.index);

  if (pending.stage === 'take-photo') {
    return (
      <Modal title="Camera in hand">
        <p className="modal-note">
          You are holding the camera, so a photo costs {cost} sun and scores 1 VP (2 VP with the Photo Album). You can
          take another at the Trail End.
        </p>
        <div className="choice-grid">
          <button type="button" className="choice" onClick={() => dispatch({ type: 'camera-photo', take: true })}>
            <span className="choice-icon" aria-hidden="true">
              📸
            </span>
            Take the photo (−{cost} ☀️)
          </button>
          <button type="button" className="choice" onClick={() => dispatch({ type: 'camera-photo', take: false })}>
            <span className="choice-icon" aria-hidden="true">
              🚶
            </span>
            Keep walking
          </button>
        </div>
      </Modal>
    );
  }

  if (pending.kind === 'camera') {
    const holder = state.cameraHolder;
    return (
      <Modal title="Camera Point">
        <p className="modal-note">
          {holder === null
            ? 'The camera is sitting here.'
            : holder === player.index
              ? 'You already hold the camera.'
              : `${state.players[holder].name} is carrying the camera — take it.`}{' '}
          The camera makes every photo cost 1 sun instead of 2, and the next hiker here takes it from you.
        </p>
        <div className="choice-grid">
          <button type="button" className="choice" onClick={() => dispatch({ type: 'camera', option: 'take-camera' })}>
            <span className="choice-icon" aria-hidden="true">
              📷
            </span>
            Take the camera
            <span className="choice-sub">{canAffordPhoto(state, player.index) ? 'then shoot for 1 sun if you like' : 'no sun for a photo yet'}</span>
          </button>
          <button type="button" className="choice" onClick={() => dispatch({ type: 'camera', option: 'take-bottle' })}>
            <span className="choice-icon" aria-hidden="true">
              🧴
            </span>
            Leave it, take a bottle
            <span className="choice-sub">one extra water conversion each season</span>
          </button>
        </div>
      </Modal>
    );
  }

  // Trail End: exactly one action.
  const claimable = claimableParks(state, player.index);
  const reservable = reservableParks(state);
  const gear = affordableGear(state, player.index);
  return (
    <Modal title="Trail End — one action" wide>
      <p className="modal-note">
        Visit a park, reserve one for later, buy a piece of gear, take a photo, or rest. Wildcards 🐾 pay for any
        resource.
        {state.gearDiscountAvailable && ' Nobody has bought gear yet this season — the first buyer saves 1 sun.'}
        {!state.firstPlayerTokenClaimed && ' The first reservation this season also takes the first player token.'}
      </p>

      <h3>Visit a park</h3>
      {claimable.length > 0 ? (
        <div className="card-strip">
          {claimable.map((park) => {
            const paid = effectiveCost(player, park);
            const discounted = COST_RESOURCES.some((r) => (paid[r] ?? 0) !== (park.cost[r] ?? 0));
            return (
              <div key={park.id} className="claim-option">
                <ParkCardView
                  park={park}
                  art={art}
                  affordable
                  onClick={() => dispatch({ type: 'trail-end', option: 'claim-park', parkId: park.id })}
                />
                {discounted && (
                  <div className="claim-discount">
                    pay <CostRow cost={paid} /> with your pass
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted">No park is within reach of your current resources.</p>
      )}

      <h3>Reserve a park{!state.firstPlayerTokenClaimed ? ' (takes the first player token)' : ''}</h3>
      {reservable.length > 0 ? (
        <div className="card-strip">
          {reservable.map((park) => (
            <ParkCardView
              key={park.id}
              park={park}
              art={art}
              onClick={() => dispatch({ type: 'trail-end', option: 'reserve-park', parkId: park.id })}
            />
          ))}
        </div>
      ) : (
        <p className="muted">Nothing left to reserve.</p>
      )}

      <h3>Buy gear{state.gearDiscountAvailable ? ' (first buyer saves 1 ☀️)' : ''}</h3>
      {gear.length > 0 ? (
        <div className="card-strip gear-strip">
          {gear.map((card) => (
            <button
              key={card.id}
              type="button"
              className="gear-card affordable clickable"
              onClick={() => dispatch({ type: 'trail-end', option: 'buy-gear', gearId: card.id })}
            >
              <span className="gear-icon" aria-hidden="true">
                {card.icon}
              </span>
              <span className="gear-name">{card.name}</span>
              <span className="gear-cost">
                {gearCost(state, card)} ☀️
                {gearCost(state, card) !== card.cost && <s> {card.cost}</s>}
              </span>
              <span className="gear-text">{card.text}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">No gear in the shop is within your sun.</p>
      )}

      <div className="choice-grid">
        <button
          type="button"
          className="choice"
          disabled={!canAffordPhoto(state, player.index)}
          onClick={() => dispatch({ type: 'trail-end', option: 'photo' })}
        >
          <span className="choice-icon" aria-hidden="true">
            📸
          </span>
          Take a photo (−{cost} ☀️)
        </button>
        <button type="button" className="choice" onClick={() => dispatch({ type: 'trail-end', option: 'rest' })}>
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
  const first = state.players[state.firstPlayer];
  return (
    <Modal title={`End of season ${state.season}`}>
      <ul className="season-summary">
        {state.players.map((p) => (
          <li key={p.index}>
            <span className="player-dot" style={{ background: p.color }} aria-hidden="true" />
            <b>{p.name}</b>: {p.parks.length} park{p.parks.length === 1 ? '' : 's'} ({p.parks.reduce((s, x) => s + x.vp, 0)} VP),{' '}
            {p.photos} photo{p.photos === 1 ? '' : 's'}
            {p.reserved.length > 0 ? `, ${p.reserved.length} reserved` : ''}
          </li>
        ))}
      </ul>
      <p className="modal-note">
        Sun is not kept between seasons. Bottles refill, everyone gets a fresh campfire token, hikers return to the
        trailhead, and a new set of sun and water tokens goes out on a longer trail. {first.name} holds the first player
        token and leads season {state.season + 1}.
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
            <th>1st</th>
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
                <td>
                  {score.photoVp} <span className="muted">({player.photos})</span>
                </td>
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
                <td>{score.firstPlayerVp}</td>
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
            <b style={{ color: p.color }}>
              {p.name}
              {state.cameraHolder === p.index ? ' 📷' : ''}
              {p.bottles.length > 1 ? ` · ${p.bottles.length} bottles` : ''}
            </b>
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

/** Small read-only strip: gear is bought at the Trail End, not from here. */
export function GearShelf({ state }: { state: GameState }) {
  return (
    <div className="card-strip gear-strip">
      {state.gearRow.map((gear) => (
        <div key={gear.id} className="gear-card" title={gear.text}>
          <span className="gear-icon" aria-hidden="true">
            {gear.icon}
          </span>
          <span className="gear-name">{gear.name}</span>
          <span className="gear-cost">
            {gearCost(state, gear)} ☀️
            {gearCost(state, gear) !== gear.cost && <s> {gear.cost}</s>}
          </span>
          <span className="gear-text">{gear.text}</span>
        </div>
      ))}
      {state.gearRow.length === 0 && <p className="muted">The gear shop is sold out.</p>}
    </div>
  );
}
