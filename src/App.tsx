import { useEffect, useMemo, useState } from 'react';
import { useGame } from './hooks/useGame';
import { TrailView } from './components/TrailView';
import { PlayerPanel } from './components/PlayerPanel';
import { ParkCardView } from './components/ParkCardView';
import { CampsiteBoard, DecisionModal, GearShelf, ScoreboardModal, SeasonEndModal } from './components/Modals';
import { Notice, Panel } from './components/Panel';
import { InfoSheet } from './components/InfoSheet';
import { THEMES, useUi } from './hooks/useUi';
import { CreditsModal, RulesModal } from './components/RulesModal';
import { bisonPark, campsiteDef, canClaim, gearCost, SEASONS, siteDef } from './game/engine';
import { PARKS } from './game/data/parks';
import { loadParkArt, type ArtMap } from './art/parkArt';

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

export default function App() {
  const game = useGame();
  const { state, moves, isHumanTurn, selectedHiker, dispatch } = game;
  const [art, setArt] = useState<ArtMap>({});
  const [artState, setArtState] = useState<'loading' | 'ready' | 'local' | 'offline'>('loading');
  const [showRules, setShowRules] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const ui = useUi(state.season);

  useEffect(() => {
    let alive = true;
    loadParkArt(PARKS.map((p) => ({ id: p.id, wikiTitle: p.wikiTitle })))
      .then((result) => {
        if (!alive) return;
        setArt(result);
        const entries = Object.values(result);
        setArtState(
          entries.length === 0 ? 'offline' : entries.some((e) => e.local) ? 'local' : 'ready',
        );
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

  const affordableNow = state.parkRow.filter(
    (park) => canClaim(state, human, park) && !reservedBy.has(park.id),
  ).length;

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

        <button
          type="button"
          className="ghost setup-toggle"
          aria-expanded={setupOpen}
          onClick={() => setSetupOpen((open) => !open)}
        >
          ⚙ Setup
        </button>

        <div className={`topbar-actions${setupOpen ? ' topbar-actions-open' : ''}`}>
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
          <label className="speed" title="Board skin">
            Skin
            <select value={ui.theme} onChange={(e) => ui.setTheme(e.target.value as typeof ui.theme)}>
              {THEMES.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
          </label>
          <label className="speed" title="Tighter spacing and smaller cards">
            Density
            <select value={ui.density} onChange={(e) => ui.setDensity(e.target.value as typeof ui.density)}>
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <label className="expansions" title="Tint the board's highlight colour with the season">
            <input type="checkbox" checked={ui.seasonTint} onChange={(e) => ui.setSeasonTint(e.target.checked)} />
            Season tint
          </label>
          <label className="speed" title="Seats at the table: you plus CPU hikers. Applied on a new game.">
            Players
            <select value={game.seats} onChange={(e) => game.setSeats(Number(e.target.value))}>
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span className="expansions" role="group" aria-label="Expansions, applied on a new game">
            <label title="Nightfall: tents and campsites, a starting wildcard, and wildcards that cover two resources">
              <input
                type="checkbox"
                checked={game.expansions.nightfall}
                onChange={(e) => game.setExpansions({ ...game.expansions, nightfall: e.target.checked })}
              />
              Nightfall
            </label>
            <label title="Wildlife: four more advanced sites, the wandering bison, and extra season cards">
              <input
                type="checkbox"
                checked={game.expansions.wildlife}
                onChange={(e) => game.setExpansions({ ...game.expansions, wildlife: e.target.checked })}
              />
              Wildlife
            </label>
          </span>
          <button
            type="button"
            className="ghost"
            onClick={game.undo}
            disabled={!game.canUndo}
            title="Step back to before your last move"
          >
            Undo
          </button>
          <button type="button" className="primary" onClick={() => game.newGame()}>
            New game
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="board">
          <Panel
            title="The trail"
            open={ui.isOpen('trail')}
            onToggle={() => ui.toggle('trail')}
            summary={`${state.trail.length - 2} sites · ${
              state.players[0].hikers.filter((h) => !h.finished).length
            } of your hikers still walking`}
            meta={
              <span className={`turn-pill${isHumanTurn ? ' turn-you' : ''}`} style={{ borderColor: activePlayer.color }}>
                <span className="player-dot" style={{ background: activePlayer.color }} aria-hidden="true" />
                {isHumanTurn ? 'Your turn' : activePlayer.name}
              </span>
            }
          >
            {state.seasonCard && ui.seasonCardClosed !== state.season && (
              <Notice
                className="season-card"
                onClose={() => ui.closeSeasonCard(state.season)}
                closeLabel="Hide this season's card"
              >
                <span className="season-card-icon" aria-hidden="true">
                  🍃
                </span>
                <b>{state.seasonCard.name}</b> — {state.seasonCard.text}
              </Notice>
            )}
            {game.resumed && (
              <Notice className="resumed" onClose={game.dismissResumed} closeLabel="Dismiss">
                Picked up where you left off — season {state.season}.
              </Notice>
            )}
            {ui.hintsHidden ? (
              <p className="hint-hidden">
                <button type="button" className="link" onClick={ui.showHints}>
                  Show turn hints
                </button>
              </p>
            ) : (
              <Notice className="hint" onClose={ui.hideHints} closeLabel="Hide turn hints" role="status">
                {hint}
              </Notice>
            )}
            <TrailView
              state={state}
              moves={moves}
              selectedHiker={selectedHiker}
              onSelectHiker={game.setSelectedHiker}
              onMove={(option) =>
                dispatch({ type: 'move', hikerId: option.hikerId, to: option.to, useCampfire: option.useCampfire })
              }
              interactive={isHumanTurn && !state.pending}
              lastCpuMove={game.lastCpuMove}
            />
          </Panel>

          <Panel
            title="Park row"
            open={ui.isOpen('parks')}
            onToggle={() => ui.toggle('parks')}
            summary={`${state.parkRow.length} on offer · ${affordableNow} within your resources`}
            meta={
              <span className="muted">
                {state.parkDeck.length} in the deck
                {artState === 'loading'
                  ? ' · loading photos…'
                  : artState === 'offline'
                    ? ' · generated artwork'
                    : artState === 'local'
                      ? ' · bundled photos'
                      : ''}
              </span>
            }
          >
            <div className="card-strip">
              {state.parkRow.map((park) => (
                <ParkCardView
                  key={park.id}
                  park={park}
                  art={art}
                  affordable={canClaim(state, human, park) && !reservedBy.has(park.id)}
                  reservedBy={reservedBy.get(park.id)}
                  bison={bisonPark(state)?.id === park.id}
                />
              ))}
              {state.parkRow.length === 0 && <p className="muted">Every park has been claimed.</p>}
            </div>
          </Panel>

          {state.campsites.length > 0 && (
            <Panel
              title="Campsites"
              open={ui.isOpen('campsites')}
              onToggle={() => ui.toggle('campsites')}
              summary={state.campsites.map((c) => campsiteDef(c.id).name).join(' · ')}
              meta={
                <span className="muted">
                  From any tent site ⛺ · {state.players.length >= 4 ? '2 tents each' : '1 tent each'}
                </span>
              }
            >
              <CampsiteBoard state={state} />
            </Panel>
          )}

          <Panel
            title="Gear shop"
            open={ui.isOpen('gear')}
            onToggle={() => ui.toggle('gear')}
            summary={state.gearRow.map((g) => `${g.name} (${gearCost(state, g)}☀️)`).join(' · ')}
            meta={
              <span className="muted">
                Trail End / Ranger Station
                {state.gearDiscountsLeft > 0 ? ` · ${state.gearDiscountsLeft} discount left` : ''}
              </span>
            }
          >
            <GearShelf state={state} />
          </Panel>

          <Panel
            title="Trail log"
            open={ui.isOpen('log')}
            onToggle={() => ui.toggle('log')}
            summary={state.log[state.log.length - 1]?.text ?? 'nothing yet'}
            meta={
              <span className="muted">
                {state.bison !== null && bisonPark(state) && `🦬 ${bisonPark(state)!.name} · `}
                {state.cameraHolder === null
                  ? 'The camera is still on the trail'
                  : state.players[state.cameraHolder].isHuman
                    ? 'You hold the camera 📷'
                    : `${state.players[state.cameraHolder].name} holds the camera 📷`}
              </span>
            }
          >
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
          </Panel>
        </div>

        <aside className="players">
          {state.players.map((player) => (
            <PlayerPanel
              key={player.index}
              player={player}
              state={state}
              art={art}
              revealBonuses={state.phase === 'game-over'}
              open={ui.isOpen(`player-${player.index}`)}
              onToggle={() => ui.toggle(`player-${player.index}`)}
              onUseBottle={player.isHuman ? (bottleId) => dispatch({ type: 'use-bottle', bottleId }) : undefined}
            />
          ))}
        </aside>
      </main>

      <div className="action-bar">
        <span className={`turn-pill${isHumanTurn ? ' turn-you' : ''}`} style={{ borderColor: activePlayer.color }}>
          <span className="player-dot" style={{ background: activePlayer.color }} aria-hidden="true" />
          {isHumanTurn ? 'Your turn' : activePlayer.name}
        </span>
        <button
          type="button"
          className="ghost"
          onClick={() => document.querySelector('.trail')?.scrollIntoView({ block: 'center' })}
        >
          Trail
        </button>
        <button type="button" className="ghost" onClick={game.undo} disabled={!game.canUndo}>
          ↩ Undo
        </button>
      </div>

      <footer className="footer">
        <span>Seed {game.seed}</span>
        <span className="footer-note">
          Park photographs from Wikipedia / Wikimedia Commons — see{' '}
          <button type="button" className="link" onClick={() => setShowCredits(true)}>
            credits
          </button>
          . Not affiliated with Keymaster Games.
        </span>
        <button type="button" className="link footer-credits" onClick={() => setShowCredits(true)}>
          Art credits
        </button>
      </footer>

      {state.pending && state.pending.player === 0 && (
        <DecisionModal
          state={state}
          art={art}
          dispatch={dispatch}
          onBack={game.canUndo ? game.undo : undefined}
        />
      )}
      {state.phase === 'season-end' && <SeasonEndModal state={state} onContinue={() => dispatch({ type: 'end-season' })} />}
      {state.phase === 'game-over' && <ScoreboardModal state={state} onNewGame={() => game.newGame()} />}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showCredits && <CreditsModal onClose={() => setShowCredits(false)} credits={credits} />}
      <InfoSheet />
    </div>
  );
}
