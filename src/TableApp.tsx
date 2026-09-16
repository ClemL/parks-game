import { useEffect, useMemo, useState } from 'react';
import { TrailView } from './components/TrailView';
import { PlayerPanel } from './components/PlayerPanel';
import { ParkCardView } from './components/ParkCardView';
import { CampsiteBoard, DecisionModal, GearShelf, ScoreboardModal, SeasonEndModal } from './components/Modals';
import { Panel } from './components/Panel';
import { SeatQr, handUrl } from './components/SeatQr';
import { useTable } from './hooks/useTable';
import { useUi } from './hooks/useUi';
import { api, ApiError } from './net/client';
import type { CreatedTable } from './net/protocol';
import { canClaim, siteDef, SEASONS } from './game/engine';
import { parkDeckLeft } from './game/view';
import { MAX_PLAYERS, MIN_PLAYERS } from './game/data/sites';
import { PARKS } from './game/data/parks';
import { loadParkArt, type ArtMap } from './art/parkArt';
import type { ExpansionFlags } from './game/types';

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
const HOST_KEY = 'parks-table-host-v1';

/** What the tablet keeps so a refresh does not lose the table. */
interface HostSession {
  code: string;
  hostToken: string;
  seatTokens: { seat: number; token: string }[];
}

function loadHost(): HostSession | null {
  try {
    const raw = localStorage.getItem(HOST_KEY);
    return raw ? (JSON.parse(raw) as HostSession) : null;
  } catch {
    return null;
  }
}

/**
 * The shared screen. It deals the table, hands out one QR code per seat, and
 * then shows the board everyone plays on: the trail, the park row, the gear
 * shop and the campsites. Hikers are dragged from card to card here, while the
 * decisions each move opens are answered on the phone of whoever is playing.
 */
export default function TableApp() {
  const [session, setSession] = useState<HostSession | null>(loadHost);
  const [seatsWanted, setSeatsWanted] = useState(4);
  const [expansions, setExpansions] = useState<ExpansionFlags>({ nightfall: true, wildlife: true });
  const [opening, setOpening] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [shown, setShown] = useState<number[]>([]);
  const [answerHere, setAnswerHere] = useState(false);
  const [art, setArt] = useState<ArtMap>({});

  const table = useTable(
    session ? { code: session.code, seat: null, token: session.hostToken } : null,
  );
  const { view, lobby } = table;
  const ui = useUi(view?.season ?? 1);

  useEffect(() => {
    loadParkArt(PARKS.map((p) => ({ id: p.id, wikiTitle: p.wikiTitle })))
      .then(setArt)
      .catch(() => setArt({}));
  }, []);

  const open = async () => {
    setOpening(true);
    setSetupError(null);
    try {
      const created: CreatedTable = await api.createTable({ seats: seatsWanted, expansions });
      const next: HostSession = {
        code: created.lobby.code,
        hostToken: created.hostToken,
        seatTokens: created.seatTokens,
      };
      localStorage.setItem(HOST_KEY, JSON.stringify(next));
      setSession(next);
      setShown(created.seatTokens.map((s) => s.seat));
    } catch (error) {
      // The offline single-file build has no routes behind it, and neither does
      // a static host: say so rather than showing a bare 404.
      const missing = error instanceof ApiError && (error.status === 404 || error.status === 405);
      setSetupError(
        missing
          ? 'Table mode needs the deployed app — this copy has no server behind it. Single-device play works anywhere.'
          : error instanceof Error
            ? error.message
            : 'could not open a table',
      );
    } finally {
      setOpening(false);
    }
  };

  const start = async () => {
    if (!session) return;
    try {
      await api.start({ code: session.code, hostToken: session.hostToken });
      table.refresh();
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'could not start');
    }
  };

  const close = () => {
    localStorage.removeItem(HOST_KEY);
    setSession(null);
  };

  /* ------------------------------------------------------------ the lobby */

  if (!session) {
    return (
      <div className="app table-app">
        <TableHeader />
        <section className="panel table-setup">
          <h2>Open a table</h2>
          <p className="muted">
            Every seat gets a QR code. Whoever scans it plays from their own phone; the seats nobody
            takes are played by the game.
          </p>
          <label className="speed">
            Seats
            <select value={seatsWanted} onChange={(e) => setSeatsWanted(Number(e.target.value))}>
              {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span className="expansions">
            <label>
              <input
                type="checkbox"
                checked={expansions.nightfall}
                onChange={(e) => setExpansions({ ...expansions, nightfall: e.target.checked })}
              />
              Nightfall
            </label>
            <label>
              <input
                type="checkbox"
                checked={expansions.wildlife}
                onChange={(e) => setExpansions({ ...expansions, wildlife: e.target.checked })}
              />
              Wildlife
            </label>
          </span>
          <button type="button" className="primary" onClick={open} disabled={opening}>
            {opening ? 'Opening…' : 'Open the table'}
          </button>
          {setupError && <p className="table-error">{setupError}</p>}
        </section>
      </div>
    );
  }

  if (!lobby?.started) {
    return (
      <div className="app table-app">
        <TableHeader code={session.code} onClose={close} />
        <section className="panel">
          <div className="panel-head">
            <h2>Take a seat</h2>
            <span className="panel-meta muted">
              {lobby ? lobby.seats.filter((s) => s.kind === 'human').length : 0} of{' '}
              {lobby?.seats.length ?? seatsWanted} seats taken
            </span>
          </div>
          <div className="seat-grid">
            {(lobby?.seats ?? []).map((seat) => {
              const token = session.seatTokens.find((t) => t.seat === seat.seat)?.token ?? '';
              return (
                <SeatQr
                  key={seat.seat}
                  seat={seat}
                  url={handUrl(session.code, seat.seat, token)}
                  hidden={!shown.includes(seat.seat)}
                  onToggle={() =>
                    setShown((current) =>
                      current.includes(seat.seat)
                        ? current.filter((s) => s !== seat.seat)
                        : [...current, seat.seat],
                    )
                  }
                />
              );
            })}
          </div>
          <div className="table-actions">
            <button type="button" className="primary" onClick={start}>
              Start the game
            </button>
            <span className="muted">Empty seats play themselves.</span>
          </div>
          {(setupError || table.error) && <p className="table-error">{setupError ?? table.error}</p>}
        </section>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="app table-app">
        <TableHeader code={session.code} onClose={close} />
        <p className="muted">Dealing the board…</p>
      </div>
    );
  }

  /* ------------------------------------------------------------- the board */

  const active = table.turnSeat === null ? null : view.players[table.turnSeat];
  const pending = view.pending;
  const pendingSeat = pending ? view.players[pending.player] : null;
  const seatKind = (seat: number) => lobby.seats[seat]?.kind ?? 'cpu';

  return (
    <div className="app table-app">
      <TableHeader code={session.code} onClose={close} season={view.season} />

      <TurnBanner
        name={active?.name ?? '—'}
        color={active?.color ?? 'var(--line)'}
        detail={
          pending
            ? `${pendingSeat!.name} is deciding: ${siteDef(view.trail[pending.siteIndex]).name}`
            : view.phase === 'season-end'
              ? 'Season complete'
              : view.phase === 'game-over'
                ? 'The year is over'
                : seatKind(table.turnSeat ?? 0) === 'cpu'
                  ? 'thinking…'
                  : 'to move — drag a hiker to a site'
        }
        onAnswerHere={pending && seatKind(pending.player) !== 'cpu' ? () => setAnswerHere(true) : undefined}
      />

      <main className="layout">
        <div className="board">
          <Panel
            title="The trail"
            badge={
              <span className="season-badge">
                {SEASON_NAMES[view.season - 1]}
                <span className="season-count" aria-hidden="true">
                  {view.season}/{SEASONS}
                </span>
              </span>
            }
            open={ui.isOpen('trail')}
            onToggle={() => ui.toggle('trail')}
          >
            {view.seasonCard && (
              <div className="notice season-card">
                <div className="notice-text">
                  <b>{view.seasonCard.name}</b> — {view.seasonCard.text}
                </div>
              </div>
            )}
            <TrailView
              state={view}
              moves={table.moves}
              selectedHiker={table.selectedHiker}
              onSelectHiker={table.setSelectedHiker}
              onMove={(option) =>
                void table.act(
                  { type: 'move', hikerId: option.hikerId, to: option.to, useCampfire: option.useCampfire },
                  table.turnSeat ?? undefined,
                )
              }
              interactive={view.phase === 'playing' && !pending && seatKind(table.turnSeat ?? 0) !== 'cpu'}
              seat={table.turnSeat}
              draggable
            />
          </Panel>

          <Panel
            title="Park row"
            open={ui.isOpen('parks')}
            onToggle={() => ui.toggle('parks')}
            meta={<span className="muted">{parkDeckLeft(view)} in the deck</span>}
          >
            <div className="card-strip">
              {view.parkRow.map((park) => (
                <ParkCardView
                  key={park.id}
                  park={park}
                  art={art}
                  affordable={active ? canClaim(view, active, park) : false}
                  bison={view.bison !== null && view.parkRow[view.bison]?.id === park.id}
                />
              ))}
            </div>
          </Panel>

          {view.campsites.length > 0 && (
            <Panel title="Campsites" open={ui.isOpen('campsites')} onToggle={() => ui.toggle('campsites')}>
              <CampsiteBoard state={view} />
            </Panel>
          )}

          <Panel title="Gear shop" open={ui.isOpen('gear')} onToggle={() => ui.toggle('gear')}>
            <GearShelf state={view} />
          </Panel>
        </div>

        <aside className="players">
          {view.players.map((player) => (
            <PlayerPanel
              key={player.index}
              player={player}
              state={view}
              art={art}
              revealBonuses={view.phase === 'game-over'}
              open={ui.isOpen(`player-${player.index}`)}
              onToggle={() => ui.toggle(`player-${player.index}`)}
              mine={false}
            />
          ))}
        </aside>
      </main>

      <section className="log-strip">
        <Panel
          title="Trail log"
          open={ui.isOpen('log')}
          onToggle={() => ui.toggle('log')}
          summary={view.log[view.log.length - 1]?.text ?? 'nothing yet'}
        >
          <ol className="log">
            {view.log
              .slice(-14)
              .reverse()
              .map((entry, i) => (
                <li key={`${view.log.length - i}`}>
                  <span className="log-season">S{entry.season}</span>
                  {entry.player >= 0 ? (
                    <>
                      <span
                        className="player-dot"
                        style={{ background: view.players[entry.player].color }}
                        aria-hidden="true"
                      />
                      <b>{view.players[entry.player].name}</b> {entry.text}
                    </>
                  ) : (
                    <i>{entry.text}</i>
                  )}
                </li>
              ))}
          </ol>
        </Panel>
      </section>

      {table.error && (
        <p className="table-error" role="status">
          {table.error} <button type="button" className="link" onClick={table.refresh}>retry</button>
        </p>
      )}

      {/* Decisions belong on the phones. The table can take one over when a
          phone has gone flat, or when its seat never had one. */}
      {pending && answerHere && (
        <DecisionModal
          state={view}
          art={art}
          dispatch={(action) => {
            setAnswerHere(false);
            void table.act(action, pending.player);
          }}
        />
      )}
      {view.phase === 'season-end' && (
        <SeasonEndModal state={view} onContinue={() => void table.act({ type: 'end-season' }, 0)} />
      )}
      {view.phase === 'game-over' && <ScoreboardModal state={view} onNewGame={close} />}
    </div>
  );
}

function TableHeader({ code, season, onClose }: { code?: string; season?: number; onClose?: () => void }) {
  return (
    <header className="topbar table-bar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          🏞️
        </span>
        <div>
          <h1>Trailside Seasons</h1>
          <p className="tagline">
            Table mode{code ? ` · table ${code}` : ''}
            {season ? ` · season ${season} of ${SEASONS}` : ''}
          </p>
        </div>
      </div>
      {onClose && (
        <button type="button" className="ghost" onClick={onClose} title="Forget this table on this device">
          Close table
        </button>
      )}
    </header>
  );
}

function TurnBanner({
  name,
  color,
  detail,
  onAnswerHere,
}: {
  name: string;
  color: string;
  detail: string;
  onAnswerHere?: () => void;
}) {
  const style = useMemo(() => ({ borderColor: color }), [color]);
  return (
    <section className="table-turn" style={style} role="status">
      <span className="player-dot" style={{ background: color }} aria-hidden="true" />
      <b>{name}</b>
      <span className="table-turn-detail">{detail}</span>
      {onAnswerHere && (
        <button type="button" className="ghost" onClick={onAnswerHere}>
          Answer on the table
        </button>
      )}
    </section>
  );
}
