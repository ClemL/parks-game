import { useEffect, useMemo, useState } from 'react';
import { useGame } from './hooks/useGame';
import { TrailView } from './components/TrailView';
import { PlayerPanel } from './components/PlayerPanel';
import { ParkCardView } from './components/ParkCardView';
import { DecisionModal, GearShelf, ScoreboardModal, SeasonEndModal } from './components/Modals';
import { CreditsModal, RulesModal } from './components/RulesModal';
import { canClaim, SEASONS, siteDef } from './game/engine';
import { PARKS } from './game/data/parks';
import { loadParkArt, type ArtMap } from './art/parkArt';

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

export default function App() {
  const game = useGame();
  const { state, moves, isHumanTurn, selectedHiker, dispatch } = game;
  const [art, setArt] = useState<ArtMap>({});
  const [artState, setArtState] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [showRules, setShowRules] = useState(false);
  const [showCredits, setShowCredits] = useState(false);

  useEffect(() => {
    let alive = true;
    loadParkArt(PARKS.map((p) => p.wikiTitle))
      .then((result) => {
        if (!alive) return;
        setArt(result);
        setArtState(Object.keys(result).length > 0 ? 'ready' : 'offline');
      })
      .catch(() => alive && setArtState('offline'));
    return () => {
      alive = false;
    };
  }, []);

  const credits = useMemo(
    () =>
      PARKS.filter((p) => art[p.wikiTitle])
        .map((p) => ({
          park: p.name,
          artist: art[p.wikiTitle].artist,
          license: art[p.wikiTitle].license,
          filePage: art[p.wikiTitle].filePage,
        }))
        .sort((a, b) => a.park.localeCompare(b.park)),
    [art],
  );

  const human = state.players[0];
  const activePlayer = state.players[state.current];
  const reservedBy = useMemo(() => {
    const map = new Map<string, string>();
    for (const player of state.players) {
      for (const park of player.reserved) map.set(park.id, player.name);
    }
    return map;
  }, [state.players]);

  const hint = (() => {
    if (state.phase === 'game-over') return 'The year is over — see the final scores.';
    if (state.phase === 'season-end') return `Season ${state.season} is complete.`;
    if (!isHumanTurn) return `${activePlayer.name} is choosing a move…`;
    if (state.pending) return `Resolve ${siteDef(state.trail[state.pending.siteIndex]).name}.`;
    if (moves.length === 0) return 'Both of your hikers are home for the season.';
    const fireOnly = moves.every((m) => m.useCampfire);
    return fireOnly
      ? 'Every open site is taken — spend your campfire to share one, or walk to the Trail End.'
      : 'Pick a hiker, then click a highlighted site. Every site holds a season token for whoever gets there first.';
  })();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            🏞️
          </span>
          <div>
            <h1>Trailside Seasons</h1>
            <p className="tagline">A four-season hike through the national parks</p>
          </div>
        </div>

        <div className="seasons" aria-label={`Season ${state.season} of ${SEASONS}`}>
          {SEASON_NAMES.map((name, i) => (
            <span
              key={name}
              className={`season-pip${i + 1 === state.season ? ' season-now' : ''}${i + 1 < state.season ? ' season-past' : ''}`}
            >
              {name}
            </span>
          ))}
        </div>

        <div className="topbar-actions">
          <label className="speed">
            CPU speed
            <select value={game.speed} onChange={(e) => game.setSpeed(e.target.value as typeof game.speed)}>
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </label>
          <button type="button" className="ghost" onClick={() => setShowRules(true)}>
            Rules
          </button>
          <button type="button" className="ghost" onClick={() => setShowCredits(true)}>
            Credits
          </button>
          <button type="button" className="primary" onClick={() => game.newGame()}>
            New game
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="board">
          <section className="panel">
            <div className="panel-head">
              <h2>The trail</h2>
              <span className={`turn-pill${isHumanTurn ? ' turn-you' : ''}`} style={{ borderColor: activePlayer.color }}>
                <span className="player-dot" style={{ background: activePlayer.color }} aria-hidden="true" />
                {isHumanTurn ? 'Your turn' : activePlayer.name}
              </span>
            </div>
            <p className="hint" role="status">
              {hint}
            </p>
            <TrailView
              state={state}
              moves={moves}
              selectedHiker={selectedHiker}
              onSelectHiker={game.setSelectedHiker}
              onMove={(option) =>
                dispatch({ type: 'move', hikerId: option.hikerId, to: option.to, useCampfire: option.useCampfire })
              }
              interactive={isHumanTurn && !state.pending}
            />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Park row</h2>
              <span className="muted">
                {state.parkDeck.length} in the deck
                {artState === 'loading' ? ' · loading photos…' : artState === 'offline' ? ' · generated artwork' : ''}
              </span>
            </div>
            <div className="card-strip">
              {state.parkRow.map((park) => (
                <ParkCardView
                  key={park.id}
                  park={park}
                  art={art}
                  affordable={canClaim(human, park) && !reservedBy.has(park.id)}
                  reservedBy={reservedBy.get(park.id)}
                />
              ))}
              {state.parkRow.length === 0 && <p className="muted">Every park has been claimed.</p>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Gear shop</h2>
              <span className="muted">
                Bought at the Trail End or a Ranger Station
                {state.gearDiscountsLeft > 0
                  ? ` · ${state.gearDiscountsLeft} early-buyer discount${state.gearDiscountsLeft === 1 ? '' : 's'} left`
                  : ''}
              </span>
            </div>
            <GearShelf state={state} />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Trail log</h2>
              <span className="muted">
                {state.cameraHolder === null
                  ? 'The camera is still on the trail'
                  : state.players[state.cameraHolder].isHuman
                    ? 'You hold the camera 📷'
                    : `${state.players[state.cameraHolder].name} holds the camera 📷`}
              </span>
            </div>
            <ol className="log">
              {state.log
                .slice(-14)
                .reverse()
                .map((entry, i) => (
                  <li key={`${state.log.length - i}`}>
                    <span className="log-season">S{entry.season}</span>
                    {entry.player >= 0 ? (
                      <>
                        <span className="player-dot" style={{ background: state.players[entry.player].color }} aria-hidden="true" />
                        <b>{state.players[entry.player].name}</b> {entry.text}
                      </>
                    ) : (
                      <i>{entry.text}</i>
                    )}
                  </li>
                ))}
            </ol>
          </section>
        </div>

        <aside className="players">
          {state.players.map((player) => (
            <PlayerPanel
              key={player.index}
              player={player}
              state={state}
              art={art}
              revealBonuses={state.phase === 'game-over'}
              onUseBottle={player.isHuman ? (bottleId) => dispatch({ type: 'use-bottle', bottleId }) : undefined}
            />
          ))}
        </aside>
      </main>

      <footer className="footer">
        <span>Seed {game.seed}</span>
        <span>
          Park photographs from Wikipedia / Wikimedia Commons — see{' '}
          <button type="button" className="link" onClick={() => setShowCredits(true)}>
            credits
          </button>
          . Not affiliated with Keymaster Games.
        </span>
      </footer>

      {state.pending && state.pending.player === 0 && <DecisionModal state={state} art={art} dispatch={dispatch} />}
      {state.phase === 'season-end' && <SeasonEndModal state={state} onContinue={() => dispatch({ type: 'end-season' })} />}
      {state.phase === 'game-over' && <ScoreboardModal state={state} onNewGame={() => game.newGame()} />}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showCredits && <CreditsModal onClose={() => setShowCredits(false)} credits={credits} />}
    </div>
  );
}
