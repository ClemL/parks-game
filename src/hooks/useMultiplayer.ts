import { useEffect, useState } from 'react';
import { api } from '../net/client';

export type Multiplayer =
  | { state: 'checking' }
  | { state: 'on' }
  | { state: 'off'; reason: string };

/** What a copy of the game with no table server behind it says for itself. */
const NO_SERVER =
  'Table mode needs the deployed app with a Redis store behind it. Single-device play works anywhere.';

/**
 * Asks once whether this copy of the game can host a table. A deployment with no
 * Redis store, a static host and the offline single-file build all answer no,
 * and the app simply does not offer multiplayer rather than failing at it.
 */
export function useMultiplayer(): Multiplayer {
  const [state, setState] = useState<Multiplayer>({ state: 'checking' });

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((health) => {
        if (!alive) return;
        setState(
          health.multiplayer
            ? { state: 'on' }
            : { state: 'off', reason: health.reason ?? NO_SERVER },
        );
      })
      .catch(() => alive && setState({ state: 'off', reason: NO_SERVER }));
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
