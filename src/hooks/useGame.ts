import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyAction, createGame, DEFAULT_EXPANSIONS, legalMoves } from '../game/engine';
import { aiAction } from '../game/ai';
import type { ExpansionFlags, GameAction, GameState } from '../game/types';

export type Speed = 'slow' | 'normal' | 'fast';

const DELAY: Record<Speed, number> = { slow: 1100, normal: 550, fast: 120 };

export function useGame(initialSeed?: number) {
  const [seed, setSeed] = useState(() => initialSeed ?? (Date.now() & 0x7fffffff));
  // Expansion choices take effect on the next new game, as at the table.
  const [expansions, setExpansions] = useState<ExpansionFlags>(DEFAULT_EXPANSIONS);
  const [state, setState] = useState<GameState>(() => createGame({ seed, expansions: DEFAULT_EXPANSIONS }));
  const [selectedHiker, setSelectedHiker] = useState<string | null>(null);
  const [speed, setSpeed] = useState<Speed>('normal');

  const dispatch = useCallback((action: GameAction) => {
    setState((current) => applyAction(current, action));
    setSelectedHiker(null);
  }, []);

  const newGame = useCallback(
    (nextSeed?: number) => {
      const value = nextSeed ?? (Date.now() & 0x7fffffff);
      setSeed(value);
      setState(createGame({ seed: value, expansions }));
      setSelectedHiker(null);
    },
    [expansions],
  );

  const human = state.players[0];
  const isHumanTurn = state.phase === 'playing' && state.players[state.current].isHuman;
  const moves = useMemo(() => (isHumanTurn ? legalMoves(state) : []), [state, isHumanTurn]);

  // Drive the CPU seats. One action per tick so the human can follow along.
  useEffect(() => {
    if (state.phase !== 'playing') return;
    if (state.players[state.current].isHuman) return;
    const action = aiAction(state);
    if (!action) return;
    const timer = setTimeout(() => setState((current) => applyAction(current, action)), DELAY[speed]);
    return () => clearTimeout(timer);
  }, [state, speed]);

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
    dispatch,
    newGame,
  };
}
