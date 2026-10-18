import { useEffect, useState } from 'react';
import type { Game } from '../hooks/useGame';
import { DecisionModal, ScoreboardModal, SeasonEndModal } from '../components/Modals';
import { InfoSheet, useInfo } from '../components/InfoSheet';
import { RulesModal } from '../components/RulesModal';
import { RESOURCE_LABEL } from '../components/Bits';
import { hasTent, occupants, siteDef } from '../game/engine';
import type { GameState } from '../game/types';

/**
 * The parts every concept keeps from the current board: the decision, season
 * and score dialogs, the rules, and the tap-to-explain sheet. The redesigns
 * change the board around them, not the rules text.
 */
export function GameOverlays({ game, rulesOpen, onCloseRules }: { game: Game; rulesOpen: boolean; onCloseRules: () => void }) {
  const { state, dispatch } = game;
  return (
    <>
      {state.pending && state.pending.player === 0 && (
        <DecisionModal state={state} art={{}} dispatch={dispatch} onBack={game.canUndo ? game.undo : undefined} />
      )}
      {state.phase === 'season-end' && <SeasonEndModal state={state} onContinue={() => dispatch({ type: 'end-season' })} />}
      {state.phase === 'game-over' && <ScoreboardModal state={state} onNewGame={() => game.newGame()} />}
      {rulesOpen && <RulesModal onClose={onCloseRules} />}
      <InfoSheet />
    </>
  );
}

/**
 * Paints the skin the shared dialogs should wear under this concept. The
 * current board repaints the player's own choice when it comes back.
 */
export function usePageSkin(skin: 'trailside' | 'parchment' | 'nightfall' | 'auto', season: number) {
  const [deviceLight, setDeviceLight] = useState(() => window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!query) return;
    const onChange = (event: MediaQueryListEvent) => setDeviceLight(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = skin === 'auto' ? (deviceLight ? 'parchment' : 'trailside') : skin;
    root.dataset.season = String(season);
    root.dataset.density = 'comfortable';
  }, [skin, season, deviceLight]);
}

/** Starting over takes two presses, since the frame cannot show a confirm(). */
export function NewGameButton({ game, className }: { game: Game; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <button
      type="button"
      className={`${className ?? ''}${armed ? ' armed' : ''}`}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        game.newGame();
      }}
    >
      {armed ? 'Start over?' : 'New game'}
    </button>
  );
}

/** Tapping a site you cannot walk to explains it instead, as the current board does. */
export function useExplainSite(state: GameState) {
  const info = useInfo();
  return (index: number) => {
    const def = siteDef(state.trail[index]);
    const token = state.siteTokens[index];
    const here = occupants(state, index).map((id) => state.players[Number(id[1])].name);
    info.show({
      title: def.name,
      icon: def.icon,
      lines: [
        def.text,
        ...(token ? [{ label: 'Season token', value: `1 ${RESOURCE_LABEL[token]} to the first hiker here` }] : []),
        ...(hasTent(state, index) ? ['Tent site: camp here instead of taking the action, if a campsite is open.'] : []),
        ...(here.length > 0 ? [{ label: 'Occupied by', value: here.join(', ') }] : []),
        ...(def.capacity === Infinity ? ['Unlimited room.'] : ['One hiker at a time, unless a campfire is spent.']),
      ],
    });
  };
}

export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
