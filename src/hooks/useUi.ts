import { useCallback, useEffect, useState } from 'react';

/**
 * Layout preferences: which sections are collapsed, and which of the standing
 * notices have been dismissed. Kept in localStorage so the board opens the way
 * you left it.
 */

const KEY = 'parks-ui-v1';

/** The skins on offer. 'auto' follows the phone's own light/dark setting. */
export const THEMES = [
  { id: 'auto', name: 'Auto (match device)' },
  { id: 'trailside', name: 'Trailside (dark)' },
  { id: 'parchment', name: 'Parchment (light)' },
  { id: 'wpa', name: 'WPA Poster' },
  { id: 'nightfall', name: 'Nightfall' },
  { id: 'contrast', name: 'High contrast' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export type Density = 'comfortable' | 'compact';

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
  theme: ThemeId;
  density: Density;
  /** The board's highlight follows the season unless this is off. */
  seasonTint: boolean;
}

/** Phones open with the reference material folded away. */
function defaults(): UiPrefs {
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
  return {
    collapsed: narrow ? ['campsites', 'gear', 'log', 'player-1', 'player-2', 'player-3', 'player-4'] : [],
    hintsHidden: false,
    seasonCardClosed: null,
    theme: 'trailside',
    density: narrow ? 'compact' : 'comfortable',
    seasonTint: true,
  };
}

function read(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    const base = defaults();
    return {
      collapsed: Array.isArray(parsed.collapsed) ? parsed.collapsed : [],
      hintsHidden: parsed.hintsHidden === true,
      seasonCardClosed: typeof parsed.seasonCardClosed === 'number' ? parsed.seasonCardClosed : null,
      theme: THEMES.some((t) => t.id === parsed.theme) ? (parsed.theme as ThemeId) : base.theme,
      density: parsed.density === 'compact' || parsed.density === 'comfortable' ? parsed.density : base.density,
      seasonTint: parsed.seasonTint !== false,
    };
  } catch {
    return defaults();
  }
}

/** 'auto' resolves against the device's own preference. */
function resolveTheme(theme: ThemeId): Exclude<ThemeId, 'auto'> {
  if (theme !== 'auto') return theme;
  const light =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches;
  return light ? 'parchment' : 'trailside';
}

export function useUi(season?: number) {
  const [prefs, setPrefs] = useState<UiPrefs>(read);
  const [deviceLight, setDeviceLight] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches,
  );

  // Follow the device if the player picked Auto and then changes their phone.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (event: MediaQueryListEvent) => setDeviceLight(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Paint the chosen skin onto the document, where the tokens live.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme === 'auto' ? (deviceLight ? 'parchment' : 'trailside') : prefs.theme;
    root.dataset.density = prefs.density;
    if (prefs.seasonTint && season) root.dataset.season = String(season);
    else delete root.dataset.season;
  }, [prefs.theme, prefs.density, prefs.seasonTint, season, deviceLight]);

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
    closeSeasonCard: (which: number) => setPrefs((c) => ({ ...c, seasonCardClosed: which })),
    theme: prefs.theme,
    resolvedTheme: resolveTheme(prefs.theme),
    setTheme: (theme: ThemeId) => setPrefs((c) => ({ ...c, theme })),
    density: prefs.density,
    setDensity: (density: Density) => setPrefs((c) => ({ ...c, density })),
    seasonTint: prefs.seasonTint,
    setSeasonTint: (seasonTint: boolean) => setPrefs((c) => ({ ...c, seasonTint })),
  };
}
