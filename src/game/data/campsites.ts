import type { CampsiteDef } from '../types';

/**
 * Nightfall campsites. Three are in play each game; a hiker on a trail site
 * carrying a tent may skip that site's action to camp here instead. Campsites
 * trade at far better rates than the trail does.
 */
export const CAMPSITES: CampsiteDef[] = [
  {
    id: 'stargazing',
    name: 'Stargazing Point',
    icon: '✨',
    text: 'Gain a star: 1 wildcard.',
    effect: { kind: 'gain', gain: { wild: 1 } },
  },
  {
    id: 'nightfall-camp',
    name: 'Nightfall Camp',
    icon: '🌙',
    text: 'Trade any 1 resource for a wildcard.',
    effect: { kind: 'trade-any', gain: { wild: 1 } },
  },
  {
    id: 'forest-clearing',
    name: 'Forest Clearing',
    icon: '🌳',
    text: 'Take 2 bottle cards.',
    effect: { kind: 'bottle', count: 2 },
  },
  {
    id: 'alpine-bivouac',
    name: 'Alpine Bivouac',
    icon: '🏔️',
    text: 'Turn in 1 mountain for 5 sun.',
    effect: { kind: 'trade', give: { mountain: 1 }, gain: { sun: 5 } },
  },
  {
    id: 'riverside-camp',
    name: 'Riverside Camp',
    icon: '🏞️',
    text: 'Take a bottle card and 2 water.',
    effect: { kind: 'bottle', count: 1, gain: { water: 2 } },
  },
  {
    id: 'outfitter-camp',
    name: 'Outfitter Camp',
    icon: '🎪',
    text: 'Pay 2 sun to replace the gear row, then take one gear card free.',
    effect: { kind: 'outfitter', cost: { sun: 2 } },
  },
];

/** Tents that fit on one campsite: two at four or five players, one below that. */
export function campsiteCapacity(players: number): number {
  return players >= 4 ? 2 : 1;
}

/** Campsites in play each game. */
export const CAMPSITES_IN_PLAY = 3;
