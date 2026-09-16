import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../net/client';
import { POLL_MS } from '../net/protocol';
import type { Lobby } from '../net/protocol';
import type { GameView } from '../game/view';
import { legalMoves } from '../game/engine';
import type { GameAction } from '../game/types';

export interface TableSession {
  code: string;
  /** The seat this device plays, or null for the table itself. */
  seat: number | null;
  /** This seat's secret, or the host's on the table. */
  token: string;
}

/**
 * Keeps one device in step with the table.
 *
 * There is no socket: the device asks for the version it already holds and the
 * server answers with a single number when nothing has changed, which is one
 * Redis read. The poll speeds up while the table is waiting on this device and
 * stops altogether while the screen is hidden, so a phone in a pocket costs
 * nothing.
 */
export function useTable(session: TableSession | null) {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedHiker, setSelectedHiker] = useState<string | null>(null);

  const version = useRef(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Bumped to make the poll loop fetch again straight away. */
  const [nudge, setNudge] = useState(0);

  /** The latest view, for the poll loop, which must not restart on every change. */
  const held = useRef<GameView | null>(null);

  const absorb = useCallback((next: { version: number; lobby?: Lobby; view?: GameView }) => {
    version.current = next.version;
    if (next.lobby) setLobby(next.lobby);
    if (next.view) {
      held.current = next.view;
      setView(next.view);
    }
  }, []);

  // The poll loop. One timer, rescheduled after every answer.
  useEffect(() => {
    if (!session) return;
    let alive = true;

    const wait = (): number => {
      const current = held.current;
      if (!current) return POLL_MS.active;
      const mine = session.seat;
      const waitingOnMe =
        mine !== null &&
        ((current.pending && current.pending.player === mine) ||
          (!current.pending && current.phase === 'playing' && current.current === mine));
      // The table is always "on the clock": everyone is looking at it.
      return waitingOnMe || mine === null ? POLL_MS.active : POLL_MS.idle;
    };

    const tick = async () => {
      if (!alive) return;
      if (typeof document !== 'undefined' && document.hidden) {
        timer.current = setTimeout(tick, POLL_MS.idle);
        return;
      }
      try {
        const next = await api.state({
          code: session.code,
          seat: session.seat,
          token: session.token,
          since: version.current < 0 ? undefined : version.current,
        });
        if (!alive) return;
        absorb(next);
        setError(null);
      } catch (cause) {
        if (!alive) return;
        setError(cause instanceof Error ? cause.message : 'lost the table');
      }
      if (alive) timer.current = setTimeout(tick, wait());
    };

    void tick();
    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer.current);
        void tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session, absorb, nudge]);

  /**
   * Sends an action for a seat. The table may play any seat, which is what keeps
   * a game going when a phone runs out of battery.
   */
  const act = useCallback(
    async (action: GameAction, forSeat?: number) => {
      if (!session) return;
      const seat = forSeat ?? session.seat ?? view?.current ?? 0;
      setBusy(true);
      try {
        const next = await api.act({ code: session.code, seat, token: session.token, action });
        absorb(next);
        setSelectedHiker(null);
        setError(null);
      } catch (cause) {
        // A rejected action means this device is behind: take the table's word
        // for it rather than arguing.
        if (cause instanceof ApiError && cause.status === 409) version.current = -1;
        setError(cause instanceof Error ? cause.message : 'that did not work');
        setNudge((n) => n + 1);
      } finally {
        setBusy(false);
      }
    },
    [session, view?.current, absorb],
  );

  const refresh = useCallback(() => {
    version.current = -1;
    setNudge((n) => n + 1);
  }, []);

  /** Whose turn it is, from this device's point of view. */
  const turnSeat = view?.pending?.player ?? (view?.phase === 'playing' ? view.current : null);
  const myTurn = session?.seat !== null && session?.seat !== undefined && turnSeat === session.seat;
  const moves = view && view.phase === 'playing' && !view.pending ? legalMoves(view) : [];

  // Hand the highlight to a hiker that can still move.
  useEffect(() => {
    if (moves.length === 0) return;
    setSelectedHiker((current) =>
      current && moves.some((m) => m.hikerId === current) ? current : moves[0].hikerId,
    );
  }, [view]);

  const cycleHiker = useCallback(() => {
    const ids = [...new Set(moves.map((m) => m.hikerId))];
    if (ids.length === 0) return;
    setSelectedHiker((current) => {
      const at = current === null ? -1 : ids.indexOf(current);
      return ids[(at + 1) % ids.length];
    });
  }, [view]);

  return {
    lobby,
    view,
    error,
    busy,
    moves,
    turnSeat,
    myTurn,
    selectedHiker,
    setSelectedHiker,
    cycleHiker,
    act,
    refresh,
    dismissError: () => setError(null),
  };
}
