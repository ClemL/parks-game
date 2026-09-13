import type { BottleDef, BottleKind, SiteDef, SiteKind } from '../types';

export const SITES: Record<SiteKind, SiteDef> = {
  trailhead: {
    kind: 'trailhead',
    name: 'Trailhead',
    icon: '🥾',
    text: 'Hikers start here. Unlimited room.',
    capacity: Infinity,
  },
  'trail-end': {
    kind: 'trail-end',
    name: 'Trail End',
    icon: '🏕️',
    text: 'One action: visit a park, reserve a park, buy gear, take a photo, or rest for 1 sun.',
    choice: 'trail-end',
    capacity: Infinity,
  },
  sun: { kind: 'sun', name: 'Sunny Meadow', icon: '☀️', text: 'Gain 1 sun.', gain: { sun: 1 } },
  water: { kind: 'water', name: 'Stream', icon: '💧', text: 'Gain 1 water.', gain: { water: 1 } },
  forest: { kind: 'forest', name: 'Woodland', icon: '🌲', text: 'Gain 1 tree.', gain: { forest: 1 } },
  mountain: { kind: 'mountain', name: 'Ridge', icon: '⛰️', text: 'Gain 1 mountain.', gain: { mountain: 1 } },
  wild: {
    kind: 'wild',
    name: 'Wildlife Crossing',
    icon: '🐾',
    text: 'Gain 1 wildcard, which pays for any resource.',
    gain: { wild: 1 },
  },
  'double-sun': {
    kind: 'double-sun',
    name: 'Open Prairie',
    icon: '☀️☀️',
    text: 'Gain 2 sun.',
    gain: { sun: 2 },
  },
  'double-water': {
    kind: 'double-water',
    name: 'Waterfall',
    icon: '💧💧',
    text: 'Gain 2 water.',
    gain: { water: 2 },
  },
  'double-forest': {
    kind: 'double-forest',
    name: 'Old Growth',
    icon: '🌲🌲',
    text: 'Gain 2 trees.',
    gain: { forest: 2 },
  },
  'double-mountain': {
    kind: 'double-mountain',
    name: 'Summit Ridge',
    icon: '⛰️⛰️',
    text: 'Gain 2 mountain.',
    gain: { mountain: 2 },
  },
  'water-forest': {
    kind: 'water-forest',
    name: 'Riverbank Grove',
    icon: '💧🌲',
    text: 'Gain 1 water and 1 tree.',
    gain: { water: 1, forest: 1 },
  },
  'mountain-sun': {
    kind: 'mountain-sun',
    name: 'Alpine Slope',
    icon: '⛰️☀️',
    text: 'Gain 1 mountain and 1 sun.',
    gain: { mountain: 1, sun: 1 },
  },
  'forest-sun': {
    kind: 'forest-sun',
    name: 'Sunlit Clearing',
    icon: '🌲☀️',
    text: 'Gain 1 tree and 1 sun.',
    gain: { forest: 1, sun: 1 },
  },
  spring: {
    kind: 'spring',
    name: 'Spring',
    icon: '⛲',
    text: 'Gain 1 water and refill one used bottle.',
    gain: { water: 1 },
  },
  camera: {
    kind: 'camera',
    name: 'Camera Point',
    icon: '📷',
    text: 'Take the camera (and a photo for 1 sun if you like) or leave it and take a bottle.',
    choice: 'camera',
  },
};

/** Middle-of-trail tiles, drawn fresh each season. */
export const TRAIL_TILE_POOL: SiteKind[] = [
  'sun',
  'sun',
  'sun',
  'water',
  'water',
  'water',
  'forest',
  'forest',
  'forest',
  'mountain',
  'mountain',
  'mountain',
  'wild',
  'wild',
  'double-sun',
  'double-water',
  'double-forest',
  'double-mountain',
  'water-forest',
  'mountain-sun',
  'forest-sun',
  'spring',
  'spring',
  'camera',
  'camera',
];

export const BOTTLES: Record<BottleKind, BottleDef> = {
  'sun-flask': {
    kind: 'sun-flask',
    name: 'Sun Flask',
    icon: '🔆',
    cost: { water: 1 },
    gain: { sun: 2 },
  },
  'stone-flask': {
    kind: 'stone-flask',
    name: 'Stone Flask',
    icon: '🪨',
    cost: { water: 1 },
    gain: { mountain: 1 },
  },
  'pine-flask': {
    kind: 'pine-flask',
    name: 'Pine Flask',
    icon: '🌿',
    cost: { water: 1 },
    gain: { forest: 1 },
  },
};

export const BOTTLE_POOL: BottleKind[] = [
  'sun-flask',
  'stone-flask',
  'pine-flask',
  'sun-flask',
  'stone-flask',
  'pine-flask',
  'sun-flask',
  'stone-flask',
  'pine-flask',
  'sun-flask',
  'stone-flask',
  'pine-flask',
  'sun-flask',
  'stone-flask',
  'pine-flask',
  'sun-flask',
  'stone-flask',
  'pine-flask',
];

/** Number of middle sites for each season: the trail grows as the year goes on. */
export function trailLength(season: number): number {
  return 5 + season; // 6, 7, 8, 9 middle sites plus trailhead and trail end
}

/** Photos cost this much sun; the camera (or a Tripod) halves it. */
export const PHOTO_COST = 2;
export const PHOTO_COST_DISCOUNTED = 1;
/** The first player to buy gear in a season pays this much less sun. */
export const FIRST_GEAR_DISCOUNT = 1;
/** The first player token is worth this at the end of the game. */
export const FIRST_PLAYER_VP = 1;
/** Everyone starts each season with this many campfire tokens. */
export const CAMPFIRES_PER_SEASON = 1;
