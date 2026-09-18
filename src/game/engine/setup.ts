import {
  type AiPersonality,
  type ExpansionFlags,
  type GameState,
  type Player,
  type SeasonCardDef,
  type SiteKind,
  type SiteToken,
} from '../types';
import {
  ADVANCED_SITES,
  basicSitesFor,
  FIRST_ADVANCED_SITE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  WILDLIFE_SITES,
  BOTTLE_POOL,
  CAMPFIRES_PER_SEASON,
  gearDiscountsForPlayers,
  parkRowSizeFor,
} from '../data/sites';
import { CAMPSITES, CAMPSITES_IN_PLAY } from '../data/campsites';
import { SEASON_CARDS } from '../data/seasons';
import { parkDeckFor } from '../data/parks';
import { GEAR } from '../data/gear';
import { BONUS_CARDS } from '../data/bonuses';
import { shuffle } from '../rng';

export const GEAR_ROW_SIZE = 3;
export const SEASONS = 4;

/** Seat colours come from the active skin, so a theme can restyle the table
 *  (and the high-contrast skin can swap in a colour-blind-safe set). */
const PLAYER_COLORS = ['var(--p0)', 'var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'];

/**
 * The CPU roster, drawn on in order as the table grows. The pawns are drawn
 * with the first letter of the name, so no two share an initial.
 */
export const CPU_SEATS: { name: string; personality: AiPersonality }[] = [
  { name: 'Pikachu', personality: 'collector' },
  { name: 'Eevee', personality: 'photographer' },
  { name: 'Charizard', personality: 'blazer' },
  { name: 'Snorlax', personality: 'collector' },
];

/* ------------------------------------------------------------------ setup */

export interface NewGameOptions {
  seed?: number;
  humanName?: string;
  expansions?: Partial<ExpansionFlags>;
  /** Total seats, one human plus CPUs. Two to five. */
  players?: number;
}

export const DEFAULT_EXPANSIONS: ExpansionFlags = { nightfall: true, wildlife: true };

export function createGame(options: NewGameOptions = {}): GameState {
  const seed = options.seed ?? (Date.now() & 0x7fffffff);
  const expansions: ExpansionFlags = { ...DEFAULT_EXPANSIONS, ...options.expansions };
  let rng = seed >>> 0;

  const [parkDeck, r1] = shuffle(parkDeckFor(expansions), rng);
  rng = r1;
  const [gearDeck, r2] = shuffle(GEAR, rng);
  rng = r2;
  const [bonusDeck, r3] = shuffle(BONUS_CARDS, rng);
  rng = r3;
  const [bottleDeck, r4] = shuffle(BOTTLE_POOL, rng);
  rng = r4;
  // Season 1 always uses the park/gear advanced site; the rest of the pool is
  // shuffled and only the next three are used, so a game never shows them all
  // (the Wildlife expansion's site-selection rule).
  const pool = ADVANCED_SITES.filter((k) => k !== FIRST_ADVANCED_SITE).concat(
    expansions.wildlife ? WILDLIFE_SITES : [],
  );
  const [shuffledPool, r5] = shuffle(pool, rng);
  rng = r5;
  const advancedOrder: SiteKind[] = [FIRST_ADVANCED_SITE, ...shuffledPool.slice(0, SEASONS - 1)];

  // One season card per season, drawn from that season's own deck.
  const [seasonDeck, r5b] = pickSeasonCards(expansions, rng);
  rng = r5b;

  // Nightfall: three campsites are in play for the whole game.
  const [campsitePool, r5c] = shuffle(
    CAMPSITES.map((c) => c.id),
    rng,
  );
  rng = r5c;

  const seats = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, options.players ?? 4));
  const roster = [
    { name: options.humanName?.trim() || 'You', personality: undefined as AiPersonality | undefined },
    ...CPU_SEATS.slice(0, seats - 1),
  ];

  const players: Player[] = roster.map(({ name, personality }, index) => ({
    index,
    name,
    isHuman: index === 0,
    personality,
    color: PLAYER_COLORS[index],
    // Nightfall hands every hiker a wildlife token to start with.
    resources: { sun: 0, water: 0, forest: 0, mountain: 0, wild: expansions.nightfall ? 1 : 0 },
    waterThisTurn: 0,
    bottles: [{ id: `p${index}b0`, kind: bottleDeck[index] ?? 'sun-flask', used: false }],
    campfires: CAMPFIRES_PER_SEASON,
    campfireRelit: false,
    photos: 0,
    hikers: [0, 1].map((h) => ({
      id: `p${index}h${h}`,
      owner: index,
      position: 0,
      finished: false,
    })),
    parks: [],
    claimedInSeason: [],
    gear: [],
    bonusCards: bonusDeck.slice(index * 2, index * 2 + 2).map((b) => b.id),
    reserved: [],
  }));

  const [trail, r6] = buildTrail(1, advancedOrder, rng, seats);
  rng = r6;
  const [siteTokens, r7] = seedSiteTokens(trail, rng);
  rng = r7;

  return {
    rng,
    expansions,
    season: 1,
    seasonCard: seasonDeck.find((c) => c.season === 1) ?? null,
    seasonDeck,
    advancedOrder,
    trail,
    siteTokens,
    tentSites: expansions.nightfall ? tentSitesFor(trail) : [],
    campsites: expansions.nightfall
      ? campsitePool.slice(0, CAMPSITES_IN_PLAY).map((id) => ({ id, tents: [] }))
      : [],
    bison: expansions.wildlife ? 0 : null,
    players,
    current: 0,
    firstPlayer: 0,
    cameraHolder: null,
    gearDiscountsLeft: gearDiscountsForPlayers(players.length),
    firstPlayerTokenClaimed: false,
    parkRow: parkDeck.slice(0, parkRowSizeFor(expansions)),
    parkDeck: parkDeck.slice(parkRowSizeFor(expansions)),
    gearRow: gearDeck.slice(0, GEAR_ROW_SIZE),
    gearDeck: gearDeck.slice(GEAR_ROW_SIZE),
    bottleDeck: bottleDeck.slice(players.length),
    pending: null,
    phase: 'playing',
    log: [
      {
        season: 1,
        player: -1,
        text:
          'Season 1 begins. Every site past the first one out of the trailhead holds a sun or water token for ' +
          'whoever reaches it first.',
      },
    ],
  };
}

/** One card per season, honouring which expansions are switched on. */
export function pickSeasonCards(expansions: ExpansionFlags, rng: number): [SeasonCardDef[], number] {
  const chosen: SeasonCardDef[] = [];
  let state = rng;
  for (const season of [1, 2, 3, 4] as const) {
    const deck = SEASON_CARDS.filter(
      (c) => c.season === season && (!c.expansion || expansions[c.expansion]),
    );
    const [shuffled, next] = shuffle(deck, state);
    state = next;
    if (shuffled[0]) chosen.push(shuffled[0]);
  }
  return [chosen, state];
}

/**
 * Nightfall tents sit on the site just before the Trail End and then every
 * other site walking back toward the trailhead.
 */
export function tentSitesFor(trail: SiteKind[]): number[] {
  const out: number[] = [];
  for (let i = trail.length - 2; i >= 1; i -= 2) out.push(i);
  return out.reverse();
}

/** One of every basic site, plus one advanced site per season, shuffled. */
export function buildTrail(
  season: number,
  advancedOrder: SiteKind[],
  rng: number,
  players: number,
): [SiteKind[], number] {
  const middle = [...basicSitesFor(players), ...advancedOrder.slice(0, season)];
  const [shuffled, next] = shuffle(middle, rng);
  return [['trailhead', ...shuffled, 'trail-end'], next];
}

/** One sun or water token per site, everywhere but the trailhead and the end. */
/**
 * Fills in fields added to the state after a game was saved, so a game stored
 * by an older build still runs rather than turning its counters into NaN.
 */
export function hydrate(state: GameState): GameState {
  for (const player of state.players) player.waterThisTurn ??= 0;
  return state;
}

export function seedSiteTokens(trail: SiteKind[], rng: number): [SiteToken[], number] {
  const tokens: SiteToken[] = [];
  let state = rng;
  for (let i = 0; i < trail.length; i++) {
    // The trailhead, the first space out of it and the Trail End stay bare.
    if (i <= 1 || i === trail.length - 1) {
      tokens.push(null);
      continue;
    }
    const [roll, next] = shuffle(['sun', 'water'] as const, state);
    state = next;
    tokens.push(roll[0]);
  }
  return [tokens, state];
}
