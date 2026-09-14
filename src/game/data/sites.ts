import type { BottleDef, BottleKind, SiteDef, SiteKind } from '../types';

/**
 * Trail sites follow the published structure: one of each basic site is on the
 * trail every season, and the advanced sites are added one per season so all
 * four are in play by winter.
 */
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

  /* ---------------------------------------------------------- basic sites */
  forest: { kind: 'forest', name: 'Woodland', icon: '🌲', text: 'Gain 1 tree.', gain: { forest: 1 }, tier: 'basic' },
  mountain: {
    kind: 'mountain',
    name: 'Ridge',
    icon: '⛰️',
    text: 'Gain 1 mountain.',
    gain: { mountain: 1 },
    tier: 'basic',
  },
  valley: { kind: 'valley', name: 'Valley', icon: '💧💧', text: 'Gain 2 water.', gain: { water: 2 }, tier: 'basic' },
  basin: { kind: 'basin', name: 'Sunlit Basin', icon: '☀️☀️', text: 'Gain 2 sun.', gain: { sun: 2 }, tier: 'basic' },
  waterfall: {
    kind: 'waterfall',
    name: 'Waterfall',
    icon: '💧☀️',
    text: 'Gain 1 water and 1 sun.',
    gain: { water: 1, sun: 1 },
    tier: 'basic',
  },
  camera: {
    kind: 'camera',
    name: 'Camera Point',
    icon: '📷',
    text: 'Take the camera (and a photo for 1 sun if you like) or leave it and take a bottle.',
    choice: 'camera',
    tier: 'basic',
  },

  /* ------------------------------------------------------- advanced sites */
  'adv-wildcard': {
    kind: 'adv-wildcard',
    name: 'Wildlife Hide',
    icon: '🐾',
    text: 'Trade 1 resource for a wildcard.',
    choice: 'wild-swap',
    tier: 'advanced',
  },
  'adv-swap': {
    kind: 'adv-swap',
    name: 'Trading Post',
    icon: '🔄',
    text: 'Trade a resource for a different one, up to twice.',
    choice: 'token-swap',
    tier: 'advanced',
  },
  'adv-park': {
    kind: 'adv-park',
    name: 'Ranger Station',
    icon: '🏛️',
    text: 'Visit a park, reserve a park, or buy gear — without walking to the end.',
    choice: 'park-or-gear',
    tier: 'advanced',
  },
  'adv-copy': {
    kind: 'adv-copy',
    name: 'Overlook',
    icon: '🔭',
    text: 'Pay 1 water to copy the action of any site holding another hiker.',
    choice: 'copy-site',
    tier: 'advanced',
  },
};

/** One of each is on the trail every season. */
export const BASIC_SITES: SiteKind[] = ['forest', 'mountain', 'valley', 'basin', 'waterfall', 'camera'];

/** Shuffled once per game; season N uses the first N of them. */
export const ADVANCED_SITES: SiteKind[] = ['adv-wildcard', 'adv-swap', 'adv-park', 'adv-copy'];

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

export const BOTTLE_POOL: BottleKind[] = Array.from({ length: 18 }, (_, i) =>
  (['sun-flask', 'stone-flask', 'pine-flask'] as BottleKind[])[i % 3],
);

/** Middle sites for a season: every basic site plus one advanced site per season. */
export function trailLength(season: number): number {
  return BASIC_SITES.length + season;
}

/** Photos cost this much; the camera (or a Tripod) discounts it. */
export const PHOTO_COST = 2;
export const PHOTO_COST_DISCOUNTED = 1;
/** The first player to buy gear in a season pays this much less sun. */
export const FIRST_GEAR_DISCOUNT = 1;
/** How many players get that discount (two at 4-5 players, one otherwise). */
export function gearDiscountsForPlayers(players: number): number {
  return players >= 4 ? 2 : 1;
}
/** The first player token is worth this at the end of the game. */
export const FIRST_PLAYER_VP = 1;
/** Campfire tokens each player has alight at the start of a season. */
export const CAMPFIRES_PER_SEASON = 1;
/** Nobody may hold more than this many resource tokens at the end of a turn. */
export const TOKEN_LIMIT = 12;
