/** Trail resources. Wild stands in for any other resource when paying a cost.
 *  Sun is spent on gear and photos and is discarded between seasons. */
export type Resource = 'sun' | 'water' | 'forest' | 'mountain' | 'wild';

export const RESOURCES: Resource[] = ['sun', 'water', 'forest', 'mountain', 'wild'];

/** The four resources a park card can actually ask for. */
export const COST_RESOURCES: Resource[] = ['sun', 'water', 'forest', 'mountain'];

/** A bag of resources. Missing keys count as zero. */
export type ResourceBag = Partial<Record<Resource, number>>;

/** Every kind of trail site a season can contain. */
export type SiteKind =
  | 'trailhead'
  | 'trail-end'
  | 'sun'
  | 'water'
  | 'forest'
  | 'mountain'
  | 'wild'
  | 'double-sun'
  | 'double-water'
  | 'double-forest'
  | 'double-mountain'
  | 'water-forest'
  | 'mountain-sun'
  | 'forest-sun'
  | 'spring'
  | 'camera';

export interface SiteDef {
  kind: SiteKind;
  name: string;
  icon: string;
  /** Short rules text shown on the tile. */
  text: string;
  /** Resources handed out on arrival. */
  gain?: ResourceBag;
  /** True when arrival opens a decision. */
  choice?: 'camera' | 'trail-end';
  /** Number of hikers that may stand here at once (trailhead and end are open). */
  capacity?: number;
}

/** The season token that sits on a trail site until the first hiker takes it. */
export type SiteToken = 'sun' | 'water' | null;

export type ParkTag =
  | 'mountain'
  | 'forest'
  | 'water'
  | 'desert'
  | 'canyon'
  | 'wildlife'
  | 'volcanic'
  | 'coastal';

export interface ParkCard {
  id: string;
  name: string;
  state: string;
  /** Region used by the "Coast to Coast" bonus card. */
  region: 'West' | 'Southwest' | 'Rockies' | 'Midwest' | 'East' | 'Pacific' | 'Alaska';
  cost: ResourceBag;
  vp: number;
  tags: ParkTag[];
  /** English Wikipedia article title, used to resolve public-domain/CC art at runtime. */
  wikiTitle: string;
  /** Palette seed for the generated fallback artwork. */
  palette: [string, string, string];
}

export interface GearCard {
  id: string;
  name: string;
  icon: string;
  /** Cost in sun, before the season's first-buyer discount. */
  cost: number;
  text: string;
  effect: GearEffect;
}

export type GearEffect =
  /** Extra copy of `resource` whenever a site pays out that resource. */
  | { kind: 'bonus-on-gain'; resource: Resource }
  /** Gain resources at the start of every season. */
  | { kind: 'season-income'; gain: ResourceBag }
  /** An extra campfire token at the start of every season. */
  | { kind: 'season-campfire' }
  /** Photos always cost the discounted price, camera or not. */
  | { kind: 'cheap-photos' }
  /** Each photo scores this many VP instead of 1. */
  | { kind: 'photo-value'; vp: number }
  /** Hikers may share sites without spending a campfire. */
  | { kind: 'ignore-occupancy' }
  /** An extra bottle card at the start of every season. */
  | { kind: 'extra-bottle'; bottle: BottleKind }
  /** Park cards cost this many fewer resources. */
  | { kind: 'park-discount'; amount: number };

/** A bottle converts one water into something else, once per season. */
export type BottleKind = 'sun-flask' | 'stone-flask' | 'pine-flask';

export interface BottleDef {
  kind: BottleKind;
  name: string;
  icon: string;
  /** Always one water in these rules, kept explicit for the UI. */
  cost: ResourceBag;
  gain: ResourceBag;
}

export interface Bottle {
  id: string;
  kind: BottleKind;
  used: boolean;
}

export interface BonusCard {
  id: string;
  name: string;
  text: string;
  score: (p: PlayerScoringView) => number;
}

/** Everything a bonus card is allowed to look at. */
export interface PlayerScoringView {
  parks: ParkCard[];
  photos: number;
  gear: GearCard[];
  resources: ResourceBag;
  campfires: number;
  bottles: Bottle[];
  reserved: ParkCard[];
  hasCamera: boolean;
  claimedInSeason: number[];
}

export interface Hiker {
  id: string;
  owner: number;
  /** Index into `GameState.trail`. */
  position: number;
  /** A hiker that has reached the trail end is done for the season. */
  finished: boolean;
}

export interface Player {
  index: number;
  name: string;
  isHuman: boolean;
  /** AI weighting profile; undefined for the human player. */
  personality?: AiPersonality;
  color: string;
  resources: ResourceBag;
  bottles: Bottle[];
  campfires: number;
  photos: number;
  hikers: Hiker[];
  parks: ParkCard[];
  claimedInSeason: number[];
  gear: GearCard[];
  bonusCards: string[];
  /** Parks reserved from the row; only this player may claim them. */
  reserved: ParkCard[];
}

export type AiPersonality = 'collector' | 'photographer' | 'blazer';

export interface PendingDecision {
  player: number;
  hikerId: string;
  siteIndex: number;
  kind: 'camera' | 'trail-end';
  /** Set once a camera stop resolves into an optional photo. */
  stage?: 'take-photo';
}

export interface LogEntry {
  season: number;
  player: number;
  text: string;
}

export type GamePhase = 'playing' | 'season-end' | 'game-over';

export interface GameState {
  rng: number;
  season: number;
  trail: SiteKind[];
  /** Season bonus token still sitting on each trail site, by index. */
  siteTokens: SiteToken[];
  players: Player[];
  current: number;
  /** Holder of the first player token: sets turn order and scores 1 VP. */
  firstPlayer: number;
  /** The camera token's holder, or null while it is on the trail. */
  cameraHolder: number | null;
  /** Cleared each season: the gear discount and the first player token are prizes. */
  gearDiscountAvailable: boolean;
  firstPlayerTokenClaimed: boolean;
  parkRow: ParkCard[];
  parkDeck: ParkCard[];
  gearRow: GearCard[];
  gearDeck: GearCard[];
  bottleDeck: BottleKind[];
  pending: PendingDecision | null;
  phase: GamePhase;
  log: LogEntry[];
  finalScores?: FinalScore[];
}

export interface FinalScore {
  player: number;
  parkVp: number;
  photoVp: number;
  bonusVp: number;
  firstPlayerVp: number;
  leftoverVp: number;
  total: number;
  bonusBreakdown: { name: string; vp: number }[];
}

export type GameAction =
  | { type: 'move'; hikerId: string; to: number; useCampfire?: boolean }
  | { type: 'use-bottle'; bottleId: string }
  /** Camera site: take the camera, or decline it for a bottle card. */
  | { type: 'camera'; option: 'take-camera' | 'take-bottle' }
  | { type: 'camera-photo'; take: boolean }
  | {
      type: 'trail-end';
      option: 'claim-park' | 'reserve-park' | 'buy-gear' | 'photo' | 'rest';
      parkId?: string;
      gearId?: string;
    }
  | { type: 'end-season' };
