import type { ParkCard } from '../game/types';

/** Deterministic hash so a park always draws the same fallback scene. */
function hash(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 0x100000000;
  };
}

/**
 * Vector scenery used when a park's photograph cannot be fetched (offline, or
 * the article has no lead image). The shapes follow the park's tags so a desert
 * park never looks like a rainforest.
 */
export function GeneratedParkArt({ park }: { park: ParkCard }) {
  const rand = hash(park.id);
  const [dark, mid, light] = park.palette;
  const tags = new Set(park.tags);
  const id = `art-${park.id}`;

  const ridge = (base: number, amplitude: number, steps: number): string => {
    const points: string[] = [`0,100`];
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * 100;
      const y = base - amplitude * (0.35 + rand() * 0.65);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    points.push('100,100');
    return points.join(' ');
  };

  const peaks = (base: number, count: number, height: number): string => {
    const points: string[] = ['0,100'];
    for (let i = 0; i < count; i++) {
      const left = (i / count) * 100;
      const width = 100 / count;
      points.push(`${left.toFixed(1)},${base.toFixed(1)}`);
      points.push(`${(left + width / 2).toFixed(1)},${(base - height * (0.6 + rand() * 0.6)).toFixed(1)}`);
    }
    points.push(`100,${base.toFixed(1)}`, '100,100');
    return points.join(' ');
  };

  const trees = Array.from({ length: tags.has('forest') ? 9 : 0 }, () => ({
    x: rand() * 100,
    h: 9 + rand() * 9,
  }));

  return (
    <svg
      className="park-art-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Stylized artwork of ${park.name}`}
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={light} />
          <stop offset="100%" stopColor={mid} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}-sky)`} />
      <circle cx={20 + rand() * 60} cy={16 + rand() * 10} r={7} fill="#ffe9a8" opacity="0.9" />

      {(tags.has('mountain') || tags.has('volcanic')) && (
        <polygon points={peaks(70, 3, 34)} fill={dark} opacity="0.85" />
      )}
      {tags.has('canyon') && (
        <>
          <polygon points={ridge(62, 10, 6)} fill={dark} opacity="0.7" />
          <polygon points={ridge(74, 8, 5)} fill={mid} opacity="0.85" />
        </>
      )}
      {tags.has('desert') && <polygon points={ridge(80, 6, 4)} fill={mid} opacity="0.9" />}
      <polygon points={ridge(tags.has('mountain') ? 82 : 76, 9, 7)} fill={dark} opacity="0.6" />

      {trees.map((tree, i) => (
        <polygon
          key={i}
          points={`${tree.x - 3},100 ${tree.x},${100 - tree.h} ${tree.x + 3},100`}
          fill={dark}
          opacity="0.75"
        />
      ))}

      {(tags.has('water') || tags.has('coastal')) && (
        <>
          <rect x="0" y="86" width="100" height="14" fill={dark} opacity="0.55" />
          <path d="M0 90 Q 12 87 25 90 T 50 90 T 75 90 T 100 90" stroke={light} strokeWidth="0.8" fill="none" opacity="0.7" />
          <path d="M0 95 Q 14 92 28 95 T 56 95 T 84 95 T 100 95" stroke={light} strokeWidth="0.6" fill="none" opacity="0.5" />
        </>
      )}
      {tags.has('wildlife') && (
        <g fill={dark} opacity="0.8">
          <ellipse cx="76" cy="92" rx="5" ry="3" />
          <rect x="72.5" y="92" width="1.2" height="4" />
          <rect x="79" y="92" width="1.2" height="4" />
          <circle cx="82" cy="88.5" r="2" />
        </g>
      )}
    </svg>
  );
}
