import { useEffect, useState } from 'react';
import { KitBar } from './components/KitBar';
import { PlayerPanel } from './components/PlayerPanel';
import { TrailView } from './components/TrailView';
import { DecisionModal, ScoreboardModal } from './components/Modals';
import { Panel } from './components/Panel';
import { useTable, type TableSession } from './hooks/useTable';
import { useUi } from './hooks/useUi';
import { api } from './net/client';
import { siteDef, SEASONS } from './game/engine';
import { PARKS } from './game/data/parks';
import { loadParkArt, type ArtMap } from './art/parkArt';

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
const HAND_KEY = 'parks-hand-v1';

interface HandSession extends TableSession {
  seat: number;
  name: string;
}

/** Seat details come from the QR code, then stick around for a reload. */
function readSession(): HandSession | null {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const code = params.get('t');
  const seat = params.get('s');
  const token = params.get('k');
  if (code && seat !== null && token) {
    return { code, seat: Number(seat), token, name: '' };
  }
  try {
    const raw = localStorage.getItem(HAND_KEY);
    return raw ? (JSON.parse(raw) as HandSession) : null;
  } catch {
    return null;
  }
}

/**
 * The phone. It carries what only you should see — your resources, your
 * reserved parks and your bonus cards — tells you when the table is waiting on
 * you, and puts the decisions your move opens under your thumb.
 */
export default function HandApp() {
  const [session, setSession] = useState<HandSession | null>(readSession);
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  /** Your own hand leads the screen, so it does not start folded. */
  const [handOpen, setHandOpen] = useState(true);
  const [tableOpen, setTableOpen] = useState(false);
  const [art, setArt] = useState<ArtMap>({});

  const table = useTable(joined && session ? session : null);
  const { view } = table;
  const ui = useUi(view?.season ?? 1);

  useEffect(() => {
    loadParkArt(PARKS.map((p) => ({ id: p.id, wikiTitle: p.wikiTitle })))
      .then(setArt)
      .catch(() => setArt({}));
  }, []);

  // A seat that has been claimed before rejoins without asking again.
  useEffect(() => {
    if (session?.name && !joined) void join(session.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const join = async (playerName: string) => {
    if (!session) return;
    setJoinError(null);
    try {
      await api.join({ code: session.code, seat: session.seat, token: session.token, name: playerName });
      const next = { ...session, name: playerName };
      localStorage.setItem(HAND_KEY, JSON.stringify(next));
      setSession(next);
      setJoined(true);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'could not take that seat');
    }
  };

  if (!session) {
    return (
      <div className="app hand-app">
        <p className="hand-empty">
          Scan the QR code on the table to take a seat. This screen is your hand — nobody else sees
          it.
        </p>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="app hand-app">
        <section className="panel hand-join">
          <h2>Seat {session.seat + 1}</h2>
          <p className="muted">Table {session.code}</p>
          <label className="hand-name">
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              placeholder={`Seat ${session.seat + 1}`}
              autoFocus
            />
          </label>
          <button type="button" className="primary" onClick={() => void join(name.trim() || `Seat ${session.seat + 1}`)}>
            Take this seat
          </button>
          {joinError && <p className="table-error">{joinError}</p>}
        </section>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="app hand-app">
        <section className="panel hand-wait">
          <h2>You are in</h2>
          <p className="muted">
            Seat {session.seat + 1} at table {session.code}. Waiting for the table to start the
            game…
          </p>
          {table.error && <p className="table-error">{table.error}</p>}
        </section>
      </div>
    );
  }

  const me = view.players[session.seat];
  const pending = view.pending;
  const mine = table.myTurn;
  const waitingOn = table.turnSeat === null ? null : view.players[table.turnSeat];

  return (
    <div className="app hand-app">
      <header className="hand-bar" style={{ borderColor: me.color }}>
        <span className="player-dot" style={{ background: me.color }} aria-hidden="true" />
        <b>{me.name}</b>
        <span className="hand-season">
          {SEASON_NAMES[view.season - 1]} {view.season}/{SEASONS}
        </span>
      </header>

      <section className={`hand-turn${mine ? ' hand-turn-mine' : ''}`} role="status">
        {view.phase === 'game-over'
          ? 'The year is over — see the table for the scores.'
          : view.phase === 'season-end'
            ? 'Season over. The table is tallying up.'
            : mine
              ? pending
                ? `Your decision: ${siteDef(view.trail[pending.siteIndex]).name}`
                : 'Your turn — move a hiker'
              : `Waiting on ${waitingOn?.name ?? 'the table'}`}
      </section>

      <KitBar
        state={view}
        seat={session.seat}
        canAct={mine && !pending}
        onUseBottle={(bottleId) => void table.act({ type: 'use-bottle', bottleId })}
      />

      {mine && !pending && view.phase === 'playing' && (
        <Panel title="Where to?" open={ui.isOpen('trail')} onToggle={() => ui.toggle('trail')}>
          <p className="muted hand-hint">
            Pick a hiker, then a site — or move it on the table. Either way it is the same board.
          </p>
          <TrailView
            state={view}
            moves={table.moves}
            selectedHiker={table.selectedHiker}
            onSelectHiker={table.setSelectedHiker}
            onMove={(option) =>
              void table.act({
                type: 'move',
                hikerId: option.hikerId,
                to: option.to,
                useCampfire: option.useCampfire,
              })
            }
            interactive={!table.busy}
            seat={session.seat}
          />
        </Panel>
      )}

      <PlayerPanel
        player={me}
        state={view}
        art={art}
        revealBonuses
        open={handOpen}
        onToggle={() => setHandOpen((open) => !open)}
        kitShownAbove
        mine
      />

      <Panel
        title="The table"
        open={tableOpen}
        onToggle={() => setTableOpen((open) => !open)}
        summary={view.players
          .filter((p) => p.index !== session.seat)
          .map((p) => `${p.name} ${p.parks.length}🏞`)
          .join(' · ')}
      >
        <div className="hand-others">
          {view.players
            .filter((p) => p.index !== session.seat)
            .map((player) => (
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
        </div>
      </Panel>

      {table.error && (
        <p className="table-error" role="status">
          {table.error}{' '}
          <button type="button" className="link" onClick={table.refresh}>
            retry
          </button>
        </p>
      )}

      {pending && pending.player === session.seat && (
        <DecisionModal state={view} art={art} dispatch={(action) => void table.act(action)} />
      )}
      {view.phase === 'game-over' && <ScoreboardModal state={view} onNewGame={() => window.location.reload()} />}
    </div>
  );
}
