import { useId } from 'react';
import type { ParkCard } from '../game/types';
import { GeneratedParkArt } from './generated';
import { H, W, type Kit } from './kit';
import { SCENES } from './scenes';

/**
 * A park's own illustration: a flat, poster-style drawing of the view the park
 * is best known for. Parks without one fall back to generated scenery.
 */
export function IllustratedParkArt({ park }: { park: ParkCard }) {
  // React's ids carry colons, which are awkward inside url(#…).
  const uid = `pa${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const scene = SCENES[park.id];
  if (!scene) return <GeneratedParkArt park={park} />;
  const k: Kit = { id: (name) => `${uid}-${name}`, url: (name) => `url(#${uid}-${name})` };
  return (
    <svg
      className="park-art-svg"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`Illustration of ${park.name}: ${scene.view}`}
    >
      {scene.draw(k)}
    </svg>
  );
}
