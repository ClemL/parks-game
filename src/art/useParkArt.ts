import { useEffect, useState } from 'react';
import { PARKS } from '../game/data/parks';
import { loadParkArt, type ArtMap } from './parkArt';

export type ParkArtStyle = 'illustrated' | 'photos';

export type ArtState = 'illustrated' | 'loading' | 'ready' | 'local' | 'offline';

const NONE: ArtMap = {};

/**
 * The photographs behind the park cards, fetched only when the player has
 * asked for photographs. With illustrations chosen nothing is fetched at all,
 * and an empty map sends every card to its drawing.
 */
export function useParkArt(style: ParkArtStyle): { art: ArtMap; artState: ArtState } {
  const [art, setArt] = useState<ArtMap>(NONE);
  const [artState, setArtState] = useState<ArtState>(style === 'photos' ? 'loading' : 'illustrated');

  useEffect(() => {
    if (style === 'illustrated') {
      setArt(NONE);
      setArtState('illustrated');
      return;
    }
    let alive = true;
    setArtState('loading');
    loadParkArt(PARKS.map((p) => ({ id: p.id, wikiTitle: p.wikiTitle })))
      .then((result) => {
        if (!alive) return;
        setArt(result);
        const entries = Object.values(result);
        setArtState(entries.length === 0 ? 'offline' : entries.some((e) => e.local) ? 'local' : 'ready');
      })
      .catch(() => alive && setArtState('offline'));
    return () => {
      alive = false;
    };
  }, [style]);

  return { art, artState };
}
