import { useId } from 'react';
import type { ParkCard } from '../game/types';
import { GeneratedParkArt } from './generated';
import { H, W, type Kit } from './kit';
import { SCENES, type ParkScene } from './scenes';

/** Draws any scene with ids of its own, so two copies on a page never collide. */
export function SceneSvg({ scene, label, className = 'park-art-svg' }: { scene: ParkScene; label: string; className?: string }) {
  // React's ids carry colons, which are awkward inside url(#…).
  const uid = `pa${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const k: Kit = { id: (name) => `${uid}-${name}`, url: (name) => `url(#${uid}-${name})` };
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
      {scene.draw(k)}
    </svg>
  );
}

/**
 * A park's own illustration: a flat, poster-style drawing of the view the park
 * is best known for. Parks without one fall back to generated scenery.
 */
export function IllustratedParkArt({ park }: { park: ParkCard }) {
  const scene = SCENES[park.id];
  if (!scene) return <GeneratedParkArt park={park} />;
  return <SceneSvg scene={scene} label={`Illustration of ${park.name}: ${scene.view}`} />;
}
