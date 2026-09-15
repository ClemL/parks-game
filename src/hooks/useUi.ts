import { useCallback, useEffect, useState } from 'react';

/**
 * Layout preferences: which sections are collapsed, and which of the standing
 * notices have been dismissed. Kept in localStorage so the board opens the way
 * you left it.
 */

const KEY = 'parks-ui-v1';

export type PanelId =
  | 'trail'
  | 'parks'
  | 'campsites'
  | 'gear'
  | 'log'
  | `player-${number}`;

interface UiPrefs {
  /** Section ids the player has folded away. */
  collapsed: string[];
  /** True once the turn hint has been closed. */
  hintsHidden: boolean;
  /** The season whose card was closed; a new season shows its own card. */
  seasonCardClosed: number | null;
}

/** Phones open with the reference material folded away. */
function defaults(): UiPrefs {
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
  return {
    collapsed: narrow ? ['campsites', 'gear', 'log', 'player-1', 'player-2', 'player-3', 'player-4'] : [],
    hintsHidden: false,
    seasonCardClosed: null,
  };
}

function read(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    return {
      collapsed: Array.isArray(parsed.collapsed) ? parsed.collapsed : [],
      hintsHidden: parsed.hintsHidden === true,
      seasonCardClosed: typeof parsed.seasonCardClosed === 'number' ? parsed.seasonCardClosed : null,
    };
  } catch {
    return defaults();
  }
}

export function useUi() {
  const [prefs, setPrefs] = useState<UiPrefs>(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* private mode: the layout simply will not be remembered */
    }
  }, [prefs]);

  const isOpen = useCallback((id: PanelId) => !prefs.collapsed.includes(id), [prefs.collapsed]);

  const toggle = useCallback((id: PanelId) => {
    setPrefs((current) => ({
      ...current,
      collapsed: current.collapsed.includes(id)
        ? current.collapsed.filter((x) => x !== id)
        : [...current.collapsed, id],
    }));
  }, []);

  const setAll = useCallback((ids: PanelId[], open: boolean) => {
    setPrefs((current) => ({
      ...current,
      collapsed: open
        ? current.collapsed.filter((x) => !ids.includes(x as PanelId))
        : [...new Set([...current.collapsed, ...ids])],
    }));
  }, []);

  return {
    isOpen,
    toggle,
    setAll,
    hintsHidden: prefs.hintsHidden,
    hideHints: () => setPrefs((c) => ({ ...c, hintsHidden: true })),
    showHints: () => setPrefs((c) => ({ ...c, hintsHidden: false })),
    seasonCardClosed: prefs.seasonCardClosed,
    closeSeasonCard: (season: number) => setPrefs((c) => ({ ...c, seasonCardClosed: season })),
  };
}
