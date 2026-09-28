import { useMemo, useState } from 'react';
import { useGame } from './hooks/useGame';
import { TrailView } from './components/TrailView';
import { PlayerPanel } from './components/PlayerPanel';
import { ParkCardView } from './components/ParkCardView';
import { CampsiteBoard, DecisionModal, GearShelf, ScoreboardModal, SeasonEndModal } from './components/Modals';
import { Notice, Panel } from './components/Panel';
import { SeasonCardLine } from './components/Bits';
import { InfoSheet } from './components/InfoSheet';
import { KitBar } from './components/KitBar';
import { GameMenu } from './components/GameMenu';
import { Film } from './film/Film';
import { useUi } from './hooks/useUi';
import { CreditsModal, RulesModal } from './components/RulesModal';
import { bisonPark, campsiteDef, canClaim, gearCost, pendingLabel, SEASONS } from './game/engine';
import { parkDeckLeft } from './game/view';
import { PARKS } from './game/data/parks';
import { useParkArt } from './art/useParkArt';
import { SITE_PHOTO_TITLES, SiteArtContext, useSiteArt } from './art/siteArt';
import { CAMPSITES } from './game/data/campsites';
import { SITES } from './game/data/sites';

/** A trail site's or campsite's display name, by id. */
const siteName = (id: string) =>
  (SITES as Record<string, { name: string }>)[id]?.name ?? CAMPSITES.find((c) => c.id === id)?.name ?? id;

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

/**
 * Whose turn it is. On your own turn it doubles as the hiker switch: clicking
 * it steps to your next hiker that still has somewhere to go.
 */
function TurnPill({
  name,
  color,
  isYou,
  hiker,
  hikers,
  onSwitch,
}: {
  name: string;
  color: string;
  isYou: boolean;
  /** 1-based index of the selected hiker, when one is selected. */
  hiker: number | null;
  /** How many of your hikers can still move. */
  hikers: number;
  onSwitch?: () => void;
}) {
  const body = (
    <>
      <span className="player-dot" style={{ background: color }} aria-hidden="true" />
      {isYou ? 'Your turn' : name}
      {isYou && hiker !== null && (
        <span className="turn-hiker">
          <span aria-hidden="true">🚶</span>
          {hiker}
          {hikers > 1 && <span className="turn-swap" aria-hidden="true">⇄</span>}
        </span>
      )}
    </>
  );
  const className = `turn-pill${isYou ? ' turn-you' : ''}${onSwitch ? ' turn-switch' : ''}`;

  if (!onSwitch) {
    return (
      <span className={className} style={{ borderColor: color }}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={className}
      style={{ borderColor: color }}
      onClick={onSwitch}
      title="Switch to your other hiker"
      aria-label={`Your turn, hiker ${hiker}. Click to switch hiker.`}
    >
      {body}
    </button>
  );
}

export default function App({ onTableMode }: { onTableMode?: () => void }) {
  const game = useGame();
  const { state, moves, isHumanTurn, selectedHiker, dispatch } = game;
  const [showRules, setShowRules] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const ui = useUi(state.season);

  const { art, artState } = useParkArt(ui.parkArt);
  const sitePhotos = useSiteArt(ui.siteArt);
  const siteArtValue = { style: ui.siteArt, photos: sitePhotos };

  const credits = useMemo(
    () =>
      PARKS.filter((p) => art[p.wikiTitle])
        .map((p) => ({
          park: p.name,
          artist: art[p.wikiTitle].artist,
          license: art[p.wikiTitle].license,
          filePage: art[p.wikiTitle].filePage,
        }))
        .concat(
          // Site photographs, when those are showing, carry their credits too.
          Object.entries(SITE_PHOTO_TITLES)
            .filter(([, title]) => sitePhotos[title])
            .map(([id, title]) => ({
              park: `${siteName(id)} (site)`,
              artist: sitePhotos[title].artist,
              license: sitePhotos[title].license,
              filePage: sitePhotos[title].filePage,
            })),
        )
        .sort((a, b) => a.park.localeCompare(b.park)),
    [art, sitePhotos],
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

  // Which of your hikers is holding the highlight, and whether there is another
  // to hand it to.
  const movableHikers = new Set(moves.map((m) => m.hikerId)).size;
  const selectedIndex = (() => {
    if (selectedHiker === null) return null;
    const at = human.hikers.findIndex((h) => h.id === selectedHiker);
    return at < 0 ? null : at + 1;
  })();
  const canSwitchHiker = isHumanTurn && !state.pending && movableHikers > 1;

  const hint = (() => {
    if (state.phase === 'game-over') return 'The year is over — see the final scores.';
    if (state.phase === 'season-end') return `Season ${state.season} is complete.`;
    if (!isHumanTurn) return `${activePlayer.name} is choosing a move…`;
    if (state.pending) return `Resolve ${pendingLabel(state)}.`;
    if (moves.length === 0) return 'Both of your hikers are home for the season.';
    const fireOnly = moves.every((m) => m.useCampfire);
    if (fireOnly) return 'Every open site is taken — spend your campfire to share one, or walk to the Trail End.';
    return movableHikers > 1
      ? 'Click a hiker or the turn label to switch, then click a highlighted site. Every site holds a season token for whoever gets there first.'
      : 'Click a highlighted site to move. Every site holds a season token for whoever gets there first.';
  })();

  return (
    <SiteArtContext.Provider value={siteArtValue}>
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

          <div className="topbar-actions">
            <button
              type="button"
              className="ghost topbar-undo"
              onClick={game.undo}
              disabled={!game.canUndo}
              title="Step back to before your last move"
            >
              Undo
            </button>
            <button
              type="button"
              className="ghost menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="game-menu"
              aria-label="Menu"
              title="How it plays, options and new game"
              onClick={() => setMenuOpen(true)}
            >
              <span className="menu-bars" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          </div>
        </header>

        <KitBar
          state={state}
          canAct={isHumanTurn && !state.pending}
          onUseBottle={(bottleId: string) => dispatch({ type: 'use-bottle', bottleId })}
        />

        <main className="layout">
          <div className="board">
            <Panel
              title="The trail"
              open={ui.isOpen('trail')}
              onToggle={() => ui.toggle('trail')}
              summary={`${state.trail.length - 2} sites · ${
                state.players[0].hikers.filter((h) => !h.finished).length
              } of your hikers still walking`}
              badge={
                <span className="season-badge" aria-label={`${SEASON_NAMES[state.season - 1]}, season ${state.season} of ${SEASONS}`}>
                  {SEASON_NAMES[state.season - 1]}
                  <span className="season-count" aria-hidden="true">
                    {state.season}/{SEASONS}
                  </span>
                </span>
              }
              note={state.seasonCard ? <SeasonCardLine card={state.seasonCard} /> : undefined}
              meta={
                <TurnPill
                  name={activePlayer.name}
                  color={activePlayer.color}
                  isYou={isHumanTurn}
                  hiker={selectedIndex}
                  hikers={movableHikers}
                  onSwitch={canSwitchHiker ? game.cycleHiker : undefined}
                />
              }
            >
              {game.resumed && (
                <Notice className="resumed" onClose={game.dismissResumed} closeLabel="Dismiss">
                  Picked up where you left off — season {state.season}.
                </Notice>
              )}
              {!ui.hintsHidden && (
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
                  {parkDeckLeft(state)} in the deck
                  {artState === 'loading'
                    ? ' · loading photos…'
                    : artState === 'offline'
                      ? ' · photos unavailable, showing drawings'
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
                  Bought at the Trail End
                  {state.gearDiscountsLeft > 0 ? ` · ${state.gearDiscountsLeft} discount left` : ''}
                </span>
              }
            >
              <GearShelf state={state} />
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
                kitShownAbove={player.isHuman}
                onUseBottle={player.isHuman ? (bottleId) => dispatch({ type: 'use-bottle', bottleId }) : undefined}
              />
            ))}
          </aside>
        </main>

          <section className="log-strip">
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
        </section>

        {/* Last on the page: what the game is, for anyone who wants it explained
            rather than played. */}
        <section className="film-strip">
          <Panel
            title="How it plays"
            open={ui.isOpen('film')}
            onToggle={() => ui.toggle('film')}
            summary="A three and a half minute walk through the whole game — no sound, subtitled."
            meta={<span className="muted">3:32 · silent</span>}
          >
            <Film />
          </Panel>
        </section>

        <div className="action-bar">
          <TurnPill
            name={activePlayer.name}
            color={activePlayer.color}
            isYou={isHumanTurn}
            hiker={selectedIndex}
            hikers={movableHikers}
            onSwitch={canSwitchHiker ? game.cycleHiker : undefined}
          />
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
            {ui.parkArt === 'photos'
              ? 'Park photographs from Wikipedia / Wikimedia Commons — see '
              : 'Park illustrations drawn for this game — see '}
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
        {menuOpen && (
          <GameMenu
            game={game}
            ui={ui}
            onClose={() => setMenuOpen(false)}
            onRules={() => setShowRules(true)}
            onCredits={() => setShowCredits(true)}
            onTableMode={onTableMode}
            onWatchFilm={() => {
              ui.setAll(['film'], true);
              requestAnimationFrame(() =>
                document.querySelector('.film-strip')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
              );
            }}
          />
        )}
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        {showCredits && <CreditsModal onClose={() => setShowCredits(false)} credits={credits} />}
        <InfoSheet />
      </div>
    </SiteArtContext.Provider>
  );
}
