import { lazy, Suspense, useEffect, useState } from 'react';
import App from './App';
import { useMultiplayer } from './hooks/useMultiplayer';

// The table and hand surfaces only load when they are asked for, so single
// device play stays a small download.
const TableApp = lazy(() => import('./TableApp'));
const HandApp = lazy(() => import('./HandApp'));
const Concepts = lazy(() => import('./concepts/Concepts'));

export type Surface = 'solo' | 'table' | 'hand' | 'concepts';

/** Where an empty hash lands. The concepts artifact build opens on them. */
const START: Surface = import.meta.env.VITE_START_SURFACE === 'concepts' ? 'concepts' : 'solo';

/**
 * Hash routing on purpose: `#/table` and `#/hand` need no server rewrites, so a
 * QR code works from a static host, from a file, or from the bundled offline
 * copy.
 */
export function surfaceFromHash(hash: string): Surface {
  const path = hash.replace(/^#/, '').split('?')[0];
  if (path === '/table') return 'table';
  if (path === '/hand') return 'hand';
  if (path === '/concepts' || path.startsWith('/concepts/')) return 'concepts';
  return path === '' || path === '/' ? START : 'solo';
}

export default function Root() {
  const [surface, setSurface] = useState<Surface>(() => surfaceFromHash(window.location.hash));
  const multiplayer = useMultiplayer();

  useEffect(() => {
    const onHash = () => setSurface(surfaceFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (surface === 'solo') {
    // Multiplayer is only offered where it can actually work.
    return (
      <App
        onTableMode={
          multiplayer.state === 'on' ? () => (window.location.hash = '#/table') : undefined
        }
      />
    );
  }

  // The redesign concepts are single-device play in other clothes.
  if (surface === 'concepts') {
    return (
      <Suspense fallback={<p className="muted loading-surface">Loading…</p>}>
        <Concepts />
      </Suspense>
    );
  }

  if (multiplayer.state === 'off') {
    return (
      <div className="app">
        <section className="panel table-setup">
          <h2>Table mode is off here</h2>
          <p className="muted">{multiplayer.reason}</p>
          <button type="button" className="primary" onClick={() => (window.location.hash = '')}>
            Play on this device
          </button>
        </section>
      </div>
    );
  }

  return (
    <Suspense fallback={<p className="muted loading-surface">Loading…</p>}>
      {surface === 'table' ? <TableApp /> : <HandApp />}
    </Suspense>
  );
}
