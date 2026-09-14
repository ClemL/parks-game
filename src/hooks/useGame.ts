import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyAction, createGame, DEFAULT_EXPANSIONS, legalMoves } from '../game/engine';
import { MAX_PLAYERS, MIN_PLAYERS } from '../game/data/sites';
import { aiAction } from '../game/ai';
import type { ExpansionFlags, GameAction, GameState } from '../game/types';

export type Speed = 'slow' | 'normal' | 'fast';

const DELAY: Record<Speed, number> = { slow: 1100, normal: 550, fast: 120 };

const SAVE_KEY = 'parks-save-v1';
/** How many states to keep for undo. One human turn can span several actions. */
const HISTORY_LIMIT = 40;

interface SavePayload {
  version: 1;
  seed: number;
  players: number;
  expansions: ExpansionFlags;
  state: GameState;
}

function loadSave(): SavePayload | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavePayload;
    if (parsed.version !== 1 || !parsed.state?.players?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSave(payload: SavePayload): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode or a full quota: the game just will not resume */
  }
}

function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* nothing to do */
  }
}

export function useGame(initialSeed?: number) {
  const saved = useMemo(() => (initialSeed === undefined ? loadSave() : null), [initialSeed]);

  const [seed, setSeed] = useState(() => saved?.seed ?? initialSeed ?? (Date.now() & 0x7fffffff));
  const [expansions, setExpansions] = useState<ExpansionFlags>(saved?.expansions ?? DEFAULT_EXPANSIONS);
  const [seats, setSeats] = useState(saved?.players ?? 4);
  const [state, setState] = useState<GameState>(
    () => saved?.state ?? createGame({ seed, expansions: DEFAULT_EXPANSIONS, players: 4 }),
  );
  const [selectedHiker, setSelectedHiker] = useState<string | null>(null);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [resumed, setResumed] = useState(saved !== null);

  /** States to step back through. Cleared on a new game. */
  const history = useRef<GameState[]>([]);
  /** Trail index a CPU just moved to, for a brief highlight. */
  const [lastCpuMove, setLastCpuMove] = useState<{ index: number; player: number } | null>(null);

  const push = useCallback((current: GameState) => {
    history.current = [...history.current.slice(-(HISTORY_LIMIT - 1)), current];
  }, []);

  const dispatch = useCallback(
    (action: GameAction) => {
      setState((current) => {
        push(current);
        return applyAction(current, action);
      });
      setSelectedHiker(null);
    },
    [push],
  );

  /** Step back to before the human's last action, CPU replies included. */
  const undo = useCallback(() => {
    setState((current) => {
      const stack = history.current;
      // Walk back to the most recent state where it was the human's turn.
      for (let i = stack.length - 1; i >= 0; i--) {
        const candidate = stack[i];
        const humanTurn =
          candidate.phase === 'playing' && candidate.players[candidate.current]?.isHuman;
        if (humanTurn) {
          history.current = stack.slice(0, i);
          return candidate;
        }
      }
      if (stack.length === 0) return current;
      history.current = [];
      return stack[0];
    });
    setSelectedHiker(null);
  }, []);

  const canUndo = history.current.length > 0 && state.phase !== 'game-over';

  const newGame = useCallback(
    (nextSeed?: number) => {
      const value = nextSeed ?? (Date.now() & 0x7fffffff);
      history.current = [];
      setSeed(value);
      setResumed(false);
      setLastCpuMove(null);
      setState(createGame({ seed: value, expansions, players: seats }));
      setSelectedHiker(null);
    },
    [expansions, seats],
  );

  const human = state.players[0];
  const isHumanTurn = state.phase === 'playing' && state.players[state.current].isHuman;
  const moves = useMemo(() => (isHumanTurn ? legalMoves(state) : []), [state, isHumanTurn]);

  // Save after every change so a refresh resumes the game.
  useEffect(() => {
    writeSave({ version: 1, seed, players: state.players.length, expansions, state });
  }, [state, seed, expansions]);

  useEffect(() => {
    if (state.phase === 'game-over') clearSave();
  }, [state.phase]);

  // Drive the CPU seats. One action per tick so the human can follow along.
  useEffect(() => {
    if (state.phase !== 'playing') return;
    if (state.players[state.current].isHuman) return;
    const action = aiAction(state);
    if (!action) return;
    const actor = state.current;
    const timer = setTimeout(() => {
      setState((current) => {
        push(current);
        return applyAction(current, action);
      });
      if (action.type === 'move') setLastCpuMove({ index: action.to, player: actor });
    }, DELAY[speed]);
    return () => clearTimeout(timer);
  }, [state, speed, push]);

  // Fade the CPU move highlight out on its own.
  useEffect(() => {
    if (!lastCpuMove) return;
    const timer = setTimeout(() => setLastCpuMove(null), 1600);
    return () => clearTimeout(timer);
  }, [lastCpuMove]);

  // Default-select a hiker that still has somewhere to go.
  useEffect(() => {
    if (!isHumanTurn || state.pending) return;
    setSelectedHiker((current) => {
      if (current && moves.some((m) => m.hikerId === current)) return current;
      return moves[0]?.hikerId ?? null;
    });
  }, [isHumanTurn, moves, state.pending]);

  return {
    state,
    seed,
    human,
    moves,
    isHumanTurn,
    selectedHiker,
    setSelectedHiker,
    speed,
    setSpeed,
    expansions,
    setExpansions,
    seats,
    setSeats: (n: number) => setSeats(Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, n))),
    dispatch,
    undo,
    canUndo,
    resumed,
    dismissResumed: () => setResumed(false),
    lastCpuMove,
    newGame,
  };
}
