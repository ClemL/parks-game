import type { SeasonCardDef } from '../types';

/**
 * Season cards, a base-game element: four decks, one card revealed at the start
 * of each season, its effect running for that whole season. The Wildlife
 * expansion adds more of them, marked below.
 */
export const SEASON_CARDS: SeasonCardDef[] = [
  /* --------------------------------------------------------------- spring */
  {
    id: 'spring-thaw',
    name: 'Season of Thaw',
    season: 1,
    text: 'Gaining water at a site also pays 1 sun.',
    effect: { kind: 'weather', when: 'water', gain: { sun: 1 } },
  },
  {
    id: 'spring-bloom',
    name: 'Season of Bloom',
    season: 1,
    text: 'Gaining trees at a site also pays 1 water.',
    effect: { kind: 'weather', when: 'forest', gain: { water: 1 } },
  },
  {
    id: 'spring-light',
    name: 'Season of Long Light',
    season: 1,
    text: 'Photos cost 1 less this season.',
    effect: { kind: 'cheap-photos', amount: 1 },
  },
  {
    id: 'spring-chance',
    name: 'Season of Chance',
    season: 1,
    text: 'A park action may claim the unseen top card of the park deck.',
    expansion: 'wildlife',
    effect: { kind: 'chance' },
  },

  /* --------------------------------------------------------------- summer */
  {
    id: 'summer-heat',
    name: 'Season of Heat',
    season: 2,
    text: 'Gaining sun at a site also pays 1 mountain.',
    effect: { kind: 'weather', when: 'sun', gain: { mountain: 1 } },
  },
  {
    id: 'summer-storms',
    name: 'Season of Storms',
    season: 2,
    text: 'Gaining mountain at a site also pays 1 water.',
    effect: { kind: 'weather', when: 'mountain', gain: { water: 1 } },
  },
  {
    id: 'summer-outfitters',
    name: 'Season of Outfitters',
    season: 2,
    text: 'Gear costs 1 less this season.',
    effect: { kind: 'cheap-gear', amount: 1 },
  },
  {
    id: 'summer-chance',
    name: 'Season of Chance',
    season: 2,
    text: 'A park action may claim the unseen top card of the park deck.',
    expansion: 'wildlife',
    effect: { kind: 'chance' },
  },

  /* --------------------------------------------------------------- autumn */
  {
    id: 'autumn-colour',
    name: 'Season of Colour',
    season: 3,
    text: 'Gaining trees at a site also pays 1 sun.',
    effect: { kind: 'weather', when: 'forest', gain: { sun: 1 } },
  },
  {
    id: 'autumn-harvest',
    name: 'Season of Harvest',
    season: 3,
    text: 'Park cards cost 1 less this season.',
    effect: { kind: 'park-discount', amount: 1 },
  },
  {
    id: 'autumn-mist',
    name: 'Season of Mist',
    season: 3,
    text: 'Gaining water at a site also pays 1 tree.',
    effect: { kind: 'weather', when: 'water', gain: { forest: 1 } },
  },
  {
    id: 'autumn-migration',
    name: 'Season of Migration',
    season: 3,
    text: 'Gaining a wildcard at a site also pays 1 sun.',
    expansion: 'wildlife',
    effect: { kind: 'weather', when: 'wild', gain: { sun: 1 } },
  },

  /* --------------------------------------------------------------- winter */
  {
    id: 'winter-snow',
    name: 'Season of Snow',
    season: 4,
    text: 'Gaining mountain at a site also pays 1 water.',
    effect: { kind: 'weather', when: 'mountain', gain: { water: 1 } },
  },
  {
    id: 'winter-clear',
    name: 'Season of Clear Skies',
    season: 4,
    text: 'Gaining sun at a site also pays 1 sun.',
    effect: { kind: 'weather', when: 'sun', gain: { sun: 1 } },
  },
  {
    id: 'winter-shelter',
    name: 'Season of Shelter',
    season: 4,
    text: 'Photos cost 1 less and park cards cost 1 less this season.',
    effect: { kind: 'park-discount', amount: 1 },
  },
  {
    id: 'winter-chance',
    name: 'Season of Chance',
    season: 4,
    text: 'A park action may claim the unseen top card of the park deck.',
    expansion: 'wildlife',
    effect: { kind: 'chance' },
  },
];
