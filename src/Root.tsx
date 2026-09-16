import { lazy, Suspense, useEffect, useState } from 'react';
import App from './App';

// The table and hand surfaces only load when they are asked for, so single
// device play stays a small download.
const TableApp = lazy(() => import('./TableApp'));
const HandApp = lazy(() => import('./HandApp'));

export type Surface = 'solo' | 'table' | 'hand';

/**
 * Hash routing on purpose: `#/table` and `#/hand` need no server rewrites, so a
 * QR code works from a static host, from a file, or from the bundled offline
 * copy.
 */
export function surfaceFromHash(hash: string): Surface {
  const path = hash.replace(/^#/, '').split('?')[0];
  if (path === '/table') return 'table';
  if (path === '/hand') return 'hand';
  return 'solo';
}

export default function Root() {
  const [surface, setSurface] = useState<Surface>(() => surfaceFromHash(window.location.hash));

  useEffect(() => {
    const onHash = () => setSurface(surfaceFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (surface === 'solo') return <App onTableMode={() => (window.location.hash = '#/table')} />;
  return (
    <Suspense fallback={<p className="muted loading-surface">Loading…</p>}>
      {surface === 'table' ? <TableApp /> : <HandApp />}
    </Suspense>
  );
}
