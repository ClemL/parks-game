import { useEffect, useRef } from 'react';
import { Film } from '../film/Film';
import { THEMES, type useUi } from '../hooks/useUi';
import type { useGame } from '../hooks/useGame';

/**
 * Everything that is not the game itself, behind one button: how it plays,
 * the options, and the settings for the next deal.
 *
 * It slides in from the side rather than dropping down, so the film has the
 * width it needs and the board stays where it was underneath.
 */
export function GameMenu({
  game,
  ui,
  onClose,
  onRules,
  onCredits,
  onTableMode,
}: {
  game: ReturnType<typeof useGame>;
  ui: ReturnType<typeof useUi>;
  onClose: () => void;
  onRules: () => void;
  onCredits: () => void;
  onTableMode?: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);

  // Focus moves into the menu, and back to the button when it closes.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('.menu-close')?.focus();
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /** Closes the menu first, so a dialog it opens is the only thing on top. */
  const then = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <div className="menu-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="menu" id="game-menu" role="dialog" aria-modal="true" aria-label="Menu" ref={panel}>
        <header className="menu-head">
          <h2>Menu</h2>
          <button type="button" className="ghost menu-close" onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        </header>

        <section className="menu-section" aria-labelledby="menu-how">
          <h3 id="menu-how">How it plays</h3>
          <p className="muted menu-note">A three and a half minute walk through the whole game — no sound, subtitled.</p>
          <Film />
          <div className="menu-row">
            <button type="button" className="ghost" onClick={then(onRules)}>
              Rules
            </button>
          </div>
        </section>

        <section className="menu-section" aria-labelledby="menu-options">
          <h3 id="menu-options">Options</h3>
          <div className="menu-fields">
            <label className="menu-field">
              CPU speed
              <select value={game.speed} onChange={(e) => game.setSpeed(e.target.value as typeof game.speed)}>
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </label>
            <label className="menu-field" title="Board skin">
              Skin
              <select value={ui.theme} onChange={(e) => ui.setTheme(e.target.value as typeof ui.theme)}>
                {THEMES.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="menu-field" title="Tighter spacing and smaller cards">
              Density
              <select value={ui.density} onChange={(e) => ui.setDensity(e.target.value as typeof ui.density)}>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label className="menu-check" title="Show the one-line prompt above the trail">
              <input
                type="checkbox"
                checked={!ui.hintsHidden}
                onChange={(e) => (e.target.checked ? ui.showHints() : ui.hideHints())}
              />
              Turn hints
            </label>
            <label className="menu-check" title="Tint the board's highlight colour with the season">
              <input type="checkbox" checked={ui.seasonTint} onChange={(e) => ui.setSeasonTint(e.target.checked)} />
              Season tint
            </label>
          </div>
        </section>

        <section className="menu-section" aria-labelledby="menu-new">
          <h3 id="menu-new">New game</h3>
          <p className="muted menu-note">These apply when you deal a new game.</p>
          <div className="menu-fields">
            <label className="menu-field" title="Seats at the table: you plus CPU hikers">
              Players
              <select value={game.seats} onChange={(e) => game.setSeats(Number(e.target.value))}>
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="expansions" role="group" aria-label="Expansions">
              <label
                className="menu-check"
                title="Nightfall: tents and campsites, a starting wildcard, and wildcards that cover two resources"
              >
                <input
                  type="checkbox"
                  checked={game.expansions.nightfall}
                  onChange={(e) => game.setExpansions({ ...game.expansions, nightfall: e.target.checked })}
                />
                Nightfall
              </label>
              <label
                className="menu-check"
                title="Wildlife: four more advanced sites, the wandering bison, and extra season cards"
              >
                <input
                  type="checkbox"
                  checked={game.expansions.wildlife}
                  onChange={(e) => game.setExpansions({ ...game.expansions, wildlife: e.target.checked })}
                />
                Wildlife
              </label>
            </div>
          </div>
          <div className="menu-row">
            <button type="button" className="primary" onClick={then(() => game.newGame())}>
              New game
            </button>
          </div>
        </section>

        <section className="menu-section menu-more" aria-label="More">
          {onTableMode && (
            <button
              type="button"
              className="ghost"
              onClick={then(onTableMode)}
              title="Play round a tablet, with everyone's hand on their own phone"
            >
              Table mode
            </button>
          )}
          <button type="button" className="ghost" onClick={then(onCredits)}>
            Credits
          </button>
        </section>
      </div>
    </div>
  );
}
