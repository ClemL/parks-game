/** The five trail resources. Sun is spent on gear and photos and does not keep
 *  between seasons; the other four are stored indefinitely. */
export type Resource = 'sun' | 'water' | 'forest' | 'mountain' | 'animal';

export const RESOURCES: Resource[] = ['sun', 'water', 'forest', 'mountain', 'animal'];

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
  | 'animal'
  | 'double-water'
  | 'double-forest'
  | 'double-mountain'
  | 'double-sun'
  | 'water-forest'
  | 'mountain-sun'
  | 'animal-forest'
  | 'vista'
  | 'campfire'
  | 'photo'
  | 'canteen'
  | 'reservation';

export interface SiteDef {
  kind: SiteKind;
  name: string;
  icon: string;
  /** Short rules text shown on the tile. */
  text: string;
  /** Resources handed out on arrival. */
  gain?: ResourceBag;
  /** True when arrival opens a decision modal. */
  choice?: 'vista' | 'photo' | 'reservation' | 'trail-end';
  /** Number of hikers that may stand here at once (trail end is unlimited). */
  capacity?: number;
}

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
  /** Cost in sun. */
  cost: number;
  text: string;
  effect: GearEffect;
}

export type GearEffect =
  /** Extra copy of `resource` whenever a site pays out that resource. */
  | { kind: 'bonus-on-gain'; resource: Resource }
  /** Gain resources at the start of every season. */
  | { kind: 'season-income'; gain: ResourceBag }
  /** One extra campfire token at the start of every season. */
  | { kind: 'season-campfire' }
  /** Photos cost no sun. */
  | { kind: 'free-photos' }
  /** Each photo scores 2 VP instead of 1. */
  | { kind: 'photo-value'; vp: number }
  /** Hikers may share sites without spending a campfire. */
  | { kind: 'ignore-occupancy' }
  /** A second canteen each season. */
  | { kind: 'extra-canteen' }
  /** Park cards cost one fewer resource. */
  | { kind: 'park-discount'; amount: number };

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
  claimedInSeason: number[];
}

export interface Hiker {
  id: string;
  owner: number;
  /** Index into `GameState.trail`. */
  position: number;
  /** A hiker that has reached the trail end is done for the season. */
  finished: boolean;
  /** Each hiker may claim at most one park per season. */
  claimedThisSeason: boolean;
}

export interface Player {
  index: number;
  name: string;
  isHuman: boolean;
  /** AI weighting profile; undefined for the human player. */
  personality?: AiPersonality;
  color: string;
  resources: ResourceBag;
  /** Canteens act as one wild resource each; they refill at the start of a season. */
  canteens: { total: number; used: number };
  campfires: number;
  photos: number;
  hikers: Hiker[];
  parks: ParkCard[];
  claimedInSeason: number[];
  gear: GearCard[];
  /** Bonus card ids; the cards themselves hold score functions and stay out of state. */
  bonusCards: string[];
  /** Park reserved from a reservation site; only this player may claim it. */
  reserved: ParkCard[];
  boughtGearThisTurn: boolean;
}

export type AiPersonality = 'collector' | 'photographer' | 'blazer';

export interface PendingDecision {
  player: number;
  hikerId: string;
  siteIndex: number;
  kind: 'vista' | 'photo' | 'reservation' | 'trail-end';
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
  players: Player[];
  current: number;
  firstPlayer: number;
  parkRow: ParkCard[];
  parkDeck: ParkCard[];
  gearRow: GearCard[];
  gearDeck: GearCard[];
  pending: PendingDecision | null;
  phase: GamePhase;
  log: LogEntry[];
  /** Set once the final scores are computed. */
  finalScores?: FinalScore[];
}

export interface FinalScore {
  player: number;
  parkVp: number;
  photoVp: number;
  bonusVp: number;
  leftoverVp: number;
  total: number;
  bonusBreakdown: { name: string; vp: number }[];
}

export type GameAction =
  | { type: 'buy-gear'; gearId: string }
  | { type: 'move'; hikerId: string; to: number; useCampfire?: boolean }
  | { type: 'choose-resource'; resource: Resource }
  | { type: 'choose-reservation'; parkId: string }
  | { type: 'choose-photo'; take: boolean }
  | { type: 'trail-end'; option: 'claim-park' | 'photo' | 'sun'; parkId?: string }
  | { type: 'end-season' };
