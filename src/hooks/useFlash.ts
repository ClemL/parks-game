import { useEffect, useRef, useState } from 'react';

/** A count that just changed, and by how much. */
export interface Flash {
  dir: 'up' | 'down';
  by: number;
  /** Timestamp, used as a React key so a repeat gain replays the animation. */
  at: number;
}

/** How long a gain or a spend stays highlighted. */
export const FLASH_MS = 1000;

/**
 * Watches a record of counts and reports the ones that just moved, so the board
 * can show a resource arriving or being spent rather than the number simply
 * changing. Flashes clear themselves.
 */
export function useCountFlashes<K extends string>(
  counts: Record<K, number>,
  ms = FLASH_MS,
): Partial<Record<K, Flash>> {
  const previous = useRef(counts);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [flashes, setFlashes] = useState<Partial<Record<K, Flash>>>({});

  useEffect(() => {
    const changed: Partial<Record<K, Flash>> = {};
    let any = false;
    for (const key of Object.keys(counts) as K[]) {
      const before = previous.current[key] ?? 0;
      const after = counts[key] ?? 0;
      if (after === before) continue;
      changed[key] = { dir: after > before ? 'up' : 'down', by: Math.abs(after - before), at: Date.now() };
      any = true;
    }
    previous.current = counts;
    if (!any) return;

    setFlashes((current) => ({ ...current, ...changed }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlashes({}), ms);
  });

  useEffect(() => () => clearTimeout(timer.current), []);

  return flashes;
}
