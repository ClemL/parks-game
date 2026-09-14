import {
  COST_RESOURCES,
  type BottleKind,
  type GameAction,
  type GameState,
  type GearCard,
  type ParkCard,
  type Player,
  type Resource,
  type ResourceBag,
  RESOURCES,
  type SiteKind,
  type SiteToken,
} from './types';
import {
  ADVANCED_SITES,
  BASIC_SITES,
  BOTTLE_POOL,
  BOTTLES,
  CAMPFIRES_PER_SEASON,
  FIRST_GEAR_DISCOUNT,
  PHOTO_COST,
  PHOTO_COST_DISCOUNTED,
  SITES,
  TOKEN_LIMIT,
  gearDiscountsForPlayers,
  trailLength,
} from './data/sites';
import { PARKS } from './data/parks';
import { GEAR } from './data/gear';
import { BONUS_CARDS } from './data/bonuses';
import { shuffle } from './rng';
import { scoreGame } from './scoring';

export const PARK_ROW_SIZE = 3;
export const GEAR_ROW_SIZE = 3;
export const SEASONS = 4;

const PLAYER_COLORS = ['#e07a5f', '#3d8361', '#3f6fa8', '#b07bac'];

export function bag(b: ResourceBag): Required<ResourceBag> {
  return {
    sun: b.sun ?? 0,
    water: b.water ?? 0,
    forest: b.forest ?? 0,
    mountain: b.mountain ?? 0,
    wild: b.wild ?? 0,
  };
}

export function bagTotal(b: ResourceBag): number {
  return RESOURCES.reduce((sum, r) => sum + (b[r] ?? 0), 0);
}

export function tokenCount(player: Player): number {
  return bagTotal(player.resources);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/* ------------------------------------------------------------------ setup */

export interface NewGameOptions {
  seed?: number;
  humanName?: string;
}

export function createGame(options: NewGameOptions = {}): GameState {
  const seed = options.seed ?? (Date.now() & 0x7fffffff);
  let rng = seed >>> 0;

  const [parkDeck, r1] = shuffle(PARKS, rng);
  rng = r1;
  const [gearDeck, r2] = shuffle(GEAR, rng);
  rng = r2;
  const [bonusDeck, r3] = shuffle(BONUS_CARDS, rng);
  rng = r3;
  const [bottleDeck, r4] = shuffle(BOTTLE_POOL, rng);
  rng = r4;
  // The advanced sites enter the trail one per season, in a random order.
  const [advancedOrder, r5] = shuffle(ADVANCED_SITES, rng);
  rng = r5;

  const names = [options.humanName?.trim() || 'You', 'Ranger Ada', 'Scout Bo', 'Blazer Cy'];
  const personalities = [undefined, 'collector', 'photographer', 'blazer'] as const;

  const players: Player[] = names.map((name, index) => ({
    index,
    name,
    isHuman: index === 0,
    personality: personalities[index],
    color: PLAYER_COLORS[index],
    resources: { sun: 0, water: 0, forest: 0, mountain: 0, wild: 0 },
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

  const [trail, r6] = buildTrail(1, advancedOrder, rng);
  rng = r6;
  const [siteTokens, r7] = seedSiteTokens(trail, rng);
  rng = r7;

  return {
    rng,
    season: 1,
    advancedOrder,
    trail,
    siteTokens,
    players,
    current: 0,
    firstPlayer: 0,
    cameraHolder: null,
    gearDiscountsLeft: gearDiscountsForPlayers(players.length),
    firstPlayerTokenClaimed: false,
    parkRow: parkDeck.slice(0, PARK_ROW_SIZE),
    parkDeck: parkDeck.slice(PARK_ROW_SIZE),
    gearRow: gearDeck.slice(0, GEAR_ROW_SIZE),
    gearDeck: gearDeck.slice(GEAR_ROW_SIZE),
    bottleDeck: bottleDeck.slice(players.length),
    pending: null,
    phase: 'playing',
    log: [
      {
        season: 1,
        player: -1,
        text: 'Season 1 begins. Every site but the trailhead holds a sun or water token for whoever reaches it first.',
      },
    ],
  };
}

/** One of every basic site, plus one advanced site per season, shuffled. */
function buildTrail(season: number, advancedOrder: SiteKind[], rng: number): [SiteKind[], number] {
  const middle = [...BASIC_SITES, ...advancedOrder.slice(0, season)];
  const [shuffled, next] = shuffle(middle, rng);
  return [['trailhead', ...shuffled, 'trail-end'], next];
}

/** One sun or water token per site, everywhere but the trailhead and the end. */
function seedSiteTokens(trail: SiteKind[], rng: number): [SiteToken[], number] {
  const tokens: SiteToken[] = [];
  let state = rng;
  for (let i = 0; i < trail.length; i++) {
    if (i === 0 || i === trail.length - 1) {
      tokens.push(null);
      continue;
    }
    const [roll, next] = shuffle(['sun', 'water'] as const, state);
    state = next;
    tokens.push(roll[0]);
  }
  return [tokens, state];
}

/* ------------------------------------------------------- gear/effect lookup */

function hasEffect(player: Player, kind: GearCard['effect']['kind']): boolean {
  return player.gear.some((g) => g.effect.kind === kind);
}

function bonusGainFor(player: Player, resource: Resource): number {
  return player.gear.filter(
    (g) => g.effect.kind === 'bonus-on-gain' && g.effect.resource === resource,
  ).length;
}

function parkDiscount(player: Player): number {
  return player.gear.reduce(
    (sum, g) => sum + (g.effect.kind === 'park-discount' ? g.effect.amount : 0),
    0,
  );
}

export function photoValue(player: Player): number {
  const card = player.gear.find((g) => g.effect.kind === 'photo-value');
  return card && card.effect.kind === 'photo-value' ? card.effect.vp : 1;
}

/** Campfires a player has alight at the start of a season, gear included. */
export function campfireAllowance(player: Player): number {
  return CAMPFIRES_PER_SEASON + player.gear.filter((g) => g.effect.kind === 'season-campfire').length;
}

/** Photos cost less while you hold the camera, or if you own a Tripod. */
export function photoCost(state: GameState, playerIndex: number): number {
  const player = state.players[playerIndex];
  return state.cameraHolder === playerIndex || hasEffect(player, 'cheap-photos')
    ? PHOTO_COST_DISCOUNTED
    : PHOTO_COST;
}

/** Photos are paid in sun, and wildcards may cover the rest. */
export function canAffordPhoto(state: GameState, playerIndex: number): boolean {
  const player = state.players[playerIndex];
  const cost = photoCost(state, playerIndex);
  return (player.resources.sun ?? 0) + (player.resources.wild ?? 0) >= cost;
}

export function gearCost(state: GameState, card: GearCard): number {
  return Math.max(0, card.cost - (state.gearDiscountsLeft > 0 ? FIRST_GEAR_DISCOUNT : 0));
}

export function usableBottles(player: Player) {
  return player.bottles.filter(
    (b) => !b.used && (player.resources.water ?? 0) >= (BOTTLES[b.kind].cost.water ?? 0),
  );
}

/* ----------------------------------------------------------------- payment */

/** A park's cost after gear discounts. Discounts come off the resource the
 *  player is furthest from paying, which is always the useful choice. */
export function effectiveCost(player: Player, park: ParkCard): Required<ResourceBag> {
  const cost = bag(park.cost);
  let discount = parkDiscount(player);
  while (discount > 0) {
    const candidates = COST_RESOURCES.filter((r) => cost[r] > 0);
    if (candidates.length === 0) break;
    candidates.sort((a, b) => {
      const shortfallA = cost[a] - (player.resources[a] ?? 0);
      const shortfallB = cost[b] - (player.resources[b] ?? 0);
      if (shortfallA !== shortfallB) return shortfallB - shortfallA;
      return cost[b] - cost[a];
    });
    cost[candidates[0]] -= 1;
    discount -= 1;
  }
  return cost;
}

export interface PaymentPlan {
  resources: Required<ResourceBag>;
  wild: number;
}

/** Pay with matching resources first, then cover the rest with wildcards. */
export function planPayment(player: Player, cost: Required<ResourceBag>): PaymentPlan | null {
  const spend = bag({});
  let shortfall = 0;
  for (const r of COST_RESOURCES) {
    const have = player.resources[r] ?? 0;
    const paid = Math.min(have, cost[r]);
    spend[r] = paid;
    shortfall += cost[r] - paid;
  }
  if (shortfall > (player.resources.wild ?? 0)) return null;
  spend.wild = shortfall;
  return { resources: spend, wild: shortfall };
}

export function canClaim(player: Player, park: ParkCard): boolean {
  return planPayment(player, effectiveCost(player, park)) !== null;
}

function applyPayment(player: Player, plan: PaymentPlan): void {
  for (const r of RESOURCES) {
    player.resources[r] = (player.resources[r] ?? 0) - plan.resources[r];
  }
}

function gainResources(player: Player, gain: ResourceBag, log: string[]): void {
  for (const r of RESOURCES) {
    const base = gain[r] ?? 0;
    if (base === 0) continue;
    const total = base + bonusGainFor(player, r);
    player.resources[r] = (player.resources[r] ?? 0) + total;
    log.push(`${total} ${label(r)}`);
  }
}

function label(r: Resource): string {
  return r === 'forest' ? 'tree' : r === 'wild' ? 'wildcard' : r;
}

function spend(player: Player, resource: Resource, count = 1): boolean {
  if ((player.resources[resource] ?? 0) < count) return false;
  player.resources[resource] = (player.resources[resource] ?? 0) - count;
  return true;
}

/* ------------------------------------------------------------ legal actions */

export interface MoveOption {
  hikerId: string;
  to: number;
  useCampfire: boolean;
}

export function occupants(state: GameState, index: number): string[] {
  return state.players.flatMap((p) =>
    p.hikers.filter((h) => !h.finished && h.position === index).map((h) => h.id),
  );
}

function capacityOf(state: GameState, index: number): number {
  return SITES[state.trail[index]].capacity ?? 1;
}

/** Every move the current player could legally make. */
export function legalMoves(state: GameState): MoveOption[] {
  if (state.pending || state.phase !== 'playing') return [];
  const player = state.players[state.current];
  const options: MoveOption[] = [];
  const end = state.trail.length - 1;
  const freeShare = hasEffect(player, 'ignore-occupancy');

  for (const hiker of player.hikers) {
    if (hiker.finished) continue;
    for (let to = hiker.position + 1; to <= end; to++) {
      const full = occupants(state, to).length >= capacityOf(state, to);
      if (!full || freeShare) {
        options.push({ hikerId: hiker.id, to, useCampfire: false });
      } else if (player.campfires > 0) {
        options.push({ hikerId: hiker.id, to, useCampfire: true });
      }
    }
  }
  return options;
}

/** Gear the player could pay for right now. */
export function affordableGear(state: GameState, playerIndex: number): GearCard[] {
  const player = state.players[playerIndex];
  return state.gearRow.filter(
    (g) => (player.resources.sun ?? 0) >= gearCost(state, g) && !player.gear.some((o) => o.id === g.id),
  );
}

/** Parks the player may claim right now (row plus their own reservations). */
export function claimableParks(state: GameState, playerIndex: number): ParkCard[] {
  const player = state.players[playerIndex];
  const reservedElsewhere = new Set(
    state.players.flatMap((p) => (p.index === playerIndex ? [] : p.reserved.map((r) => r.id))),
  );
  const pool = [...player.reserved, ...state.parkRow.filter((p) => !reservedElsewhere.has(p.id))];
  const seen = new Set<string>();
  return pool.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return canClaim(player, p);
  });
}

/** Parks still free to reserve from the row. */
export function reservableParks(state: GameState): ParkCard[] {
  const reserved = new Set(state.players.flatMap((p) => p.reserved.map((r) => r.id)));
  return state.parkRow.filter((p) => !reserved.has(p.id));
}

/** Sites an Overlook could copy: any basic or advanced site holding a hiker. */
export function copyableSites(state: GameState, playerIndex: number): number[] {
  const player = state.players[playerIndex];
  if ((player.resources.water ?? 0) < 1) return [];
  const out: number[] = [];
  for (let i = 1; i < state.trail.length - 1; i++) {
    if (state.trail[i] === 'adv-copy') continue;
    if (occupants(state, i).length > 0) out.push(i);
  }
  return out;
}

/* -------------------------------------------------------------- transitions */

export function applyAction(state: GameState, action: GameAction): GameState {
  const next = clone(state);
  switch (action.type) {
    case 'move':
      move(next, action.hikerId, action.to, action.useCampfire ?? false);
      break;
    case 'use-bottle':
      useBottle(next, action.bottleId);
      break;
    case 'camera':
      resolveCamera(next, action.option);
      break;
    case 'camera-photo':
      resolveCameraPhoto(next, action.take);
      break;
    case 'swap-give':
      resolveSwapGive(next, action.resource);
      break;
    case 'swap-get':
      resolveSwapGet(next, action.resource);
      break;
    case 'swap-done':
      finishDecision(next);
      break;
    case 'copy-site':
      resolveCopySite(next, action.siteIndex);
      break;
    case 'copy-skip':
      finishDecision(next);
      break;
    case 'park-or-gear':
      resolveParkOrGear(next, action);
      break;
    case 'trail-end':
      resolveTrailEnd(next, action);
      break;
    case 'end-season':
      startNextSeason(next);
      break;
  }
  return next;
}

function log(state: GameState, player: number, text: string): void {
  state.log.push({ season: state.season, player, text });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}

/** Bottles are a free action on your own turn, before or after moving. */
function useBottle(state: GameState, bottleId: string): void {
  const player = state.players[state.current];
  const bottle = player.bottles.find((b) => b.id === bottleId);
  if (!bottle || bottle.used) return;
  const def = BOTTLES[bottle.kind];
  if (!spend(player, 'water', def.cost.water ?? 0)) return;

  const gained: string[] = [];
  gainResources(player, def.gain, gained);
  bottle.used = true;
  log(state, player.index, `emptied a ${def.name}: 1 water became ${gained.join(', ')}`);
  enforceTokenLimit(state, player);
}

function move(state: GameState, hikerId: string, to: number, useCampfire: boolean): void {
  const legal = legalMoves(state).find(
    (m) => m.hikerId === hikerId && m.to === to && m.useCampfire === useCampfire,
  );
  if (!legal) return;

  const player = state.players[state.current];
  const hiker = player.hikers.find((h) => h.id === hikerId);
  if (!hiker) return;

  if (useCampfire) {
    player.campfires -= 1;
    log(state, player.index, 'spent a campfire to share a site');
  }

  hiker.position = to;

  if (to === state.trail.length - 1) {
    hiker.finished = true;
    // A player's first hiker home re-lights their campfire for the rest of the season.
    if (!player.campfireRelit) {
      player.campfireRelit = true;
      if (player.campfires < campfireAllowance(player)) {
        player.campfires = campfireAllowance(player);
        log(state, player.index, 'reached the Trail End and re-lit their campfire');
      }
    }
    state.pending = { player: player.index, hikerId, siteIndex: to, kind: 'trail-end' };
    log(state, player.index, 'reached the Trail End');
    return;
  }

  resolveSite(state, player, to, hikerId, false);
}

/** Resolve arriving at (or copying) a site. */
function resolveSite(
  state: GameState,
  player: Player,
  index: number,
  hikerId: string,
  copied: boolean,
): void {
  const kind = state.trail[index];
  const site = SITES[kind];
  const gained: string[] = [];
  if (site.gain) gainResources(player, site.gain, gained);

  // The season token waiting on this site goes to whoever arrives first. A
  // copied action does not reach for it.
  if (!copied) {
    const token = state.siteTokens[index];
    if (token) {
      gainResources(player, { [token]: 1 }, gained);
      state.siteTokens[index] = null;
      gained.push('(season token)');
    }
  }

  log(
    state,
    player.index,
    `${copied ? 'copied' : 'moved to'} ${site.name}${gained.length ? ` and gained ${gained.join(', ')}` : ''}`,
  );

  if (site.choice) {
    state.pending = {
      player: player.index,
      hikerId,
      siteIndex: index,
      kind: site.choice,
      ...(site.choice === 'token-swap' ? { swapsLeft: 2, stage: 'give' as const } : {}),
      ...(site.choice === 'wild-swap' ? { stage: 'give' as const } : {}),
      ...(copied ? { copied: true } : {}),
    };
    // Nothing to decide? Then the stop is simply spent.
    if (!decisionHasOptions(state)) {
      state.pending = null;
      endTurn(state);
    }
    return;
  }

  enforceTokenLimit(state, player);
  endTurn(state);
}

/** False when a pending decision offers the player nothing at all. */
function decisionHasOptions(state: GameState): boolean {
  const pending = state.pending;
  if (!pending) return false;
  const player = state.players[pending.player];
  switch (pending.kind) {
    case 'wild-swap':
    case 'token-swap':
      return COST_RESOURCES.some((r) => (player.resources[r] ?? 0) > 0);
    case 'copy-site':
      return copyableSites(state, player.index).length > 0;
    case 'park-or-gear':
      return (
        claimableParks(state, player.index).length > 0 ||
        reservableParks(state).length > 0 ||
        affordableGear(state, player.index).length > 0
      );
    default:
      return true;
  }
}

function finishDecision(state: GameState): void {
  if (!state.pending) return;
  const player = state.players[state.pending.player];
  state.pending = null;
  enforceTokenLimit(state, player);
  endTurn(state);
}

function resolveCamera(state: GameState, option: 'take-camera' | 'take-bottle'): void {
  if (!state.pending || state.pending.kind !== 'camera' || state.pending.stage) return;
  const player = state.players[state.pending.player];

  if (option === 'take-camera') {
    const previous = state.cameraHolder;
    state.cameraHolder = player.index;
    log(
      state,
      player.index,
      previous !== null && previous !== player.index
        ? `took the camera from ${state.players[previous].name}`
        : 'picked up the camera',
    );
    if (canAffordPhoto(state, player.index)) {
      state.pending = { ...state.pending, stage: 'take-photo' };
      return;
    }
    finishDecision(state);
    return;
  }

  const kind: BottleKind = state.bottleDeck.shift() ?? 'sun-flask';
  player.bottles.push({
    id: `p${player.index}b${player.bottles.length}s${state.season}`,
    kind,
    used: false,
  });
  log(state, player.index, `left the camera and took a ${BOTTLES[kind].name}`);
  finishDecision(state);
}

function resolveCameraPhoto(state: GameState, take: boolean): void {
  if (!state.pending || state.pending.stage !== 'take-photo') return;
  const player = state.players[state.pending.player];
  if (take) takePhoto(state, player);
  finishDecision(state);
}

function takePhoto(state: GameState, player: Player): boolean {
  const cost = photoCost(state, player.index);
  const sun = Math.min(player.resources.sun ?? 0, cost);
  const wild = cost - sun;
  if ((player.resources.wild ?? 0) < wild) return false;
  player.resources.sun = (player.resources.sun ?? 0) - sun;
  player.resources.wild = (player.resources.wild ?? 0) - wild;
  player.photos += 1;
  log(
    state,
    player.index,
    `took a photo for ${sun} sun${wild > 0 ? ` and ${wild} wildcard` : ''}`,
  );
  return true;
}

/* ------------------------------------------------------------ advanced sites */

function resolveSwapGive(state: GameState, resource: Resource): void {
  const pending = state.pending;
  if (!pending || (pending.kind !== 'wild-swap' && pending.kind !== 'token-swap')) return;
  const player = state.players[pending.player];
  if (!COST_RESOURCES.includes(resource) || (player.resources[resource] ?? 0) < 1) return;

  if (pending.kind === 'wild-swap') {
    spend(player, resource);
    const gained: string[] = [];
    gainResources(player, { wild: 1 }, gained);
    log(state, player.index, `traded 1 ${label(resource)} for ${gained.join(', ')}`);
    finishDecision(state);
    return;
  }

  spend(player, resource);
  state.pending = { ...pending, give: resource, stage: 'get' };
}

function resolveSwapGet(state: GameState, resource: Resource): void {
  const pending = state.pending;
  if (!pending || pending.kind !== 'token-swap' || pending.stage !== 'get' || !pending.give) return;
  if (!COST_RESOURCES.includes(resource) || resource === pending.give) return;
  const player = state.players[pending.player];

  gainResources(player, { [resource]: 1 }, []);
  log(state, player.index, `traded 1 ${label(pending.give)} for 1 ${label(resource)}`);

  const swapsLeft = (pending.swapsLeft ?? 1) - 1;
  if (swapsLeft > 0 && COST_RESOURCES.some((r) => (player.resources[r] ?? 0) > 0)) {
    state.pending = { ...pending, swapsLeft, stage: 'give', give: undefined };
    return;
  }
  finishDecision(state);
}

function resolveCopySite(state: GameState, siteIndex: number): void {
  const pending = state.pending;
  if (!pending || pending.kind !== 'copy-site') return;
  const player = state.players[pending.player];
  if (!copyableSites(state, player.index).includes(siteIndex)) return;
  if (!spend(player, 'water')) return;

  log(state, player.index, `paid 1 water at the Overlook to copy ${SITES[state.trail[siteIndex]].name}`);
  state.pending = null;
  resolveSite(state, player, siteIndex, pending.hikerId, true);
}

function resolveParkOrGear(
  state: GameState,
  action: Extract<GameAction, { type: 'park-or-gear' }>,
): void {
  const pending = state.pending;
  if (!pending || pending.kind !== 'park-or-gear') return;
  const player = state.players[pending.player];

  switch (action.option) {
    case 'claim-park':
      claimPark(state, player, action.parkId);
      break;
    case 'reserve-park':
      reservePark(state, player, action.parkId);
      break;
    case 'buy-gear':
      buyGear(state, player, action.gearId);
      break;
    default:
      log(state, player.index, 'passed at the Ranger Station');
      break;
  }
  finishDecision(state);
}

/* --------------------------------------------------------------- trail end */

function claimPark(state: GameState, player: Player, parkId?: string): boolean {
  const park = claimableParks(state, player.index).find((p) => p.id === parkId);
  if (!park) return false;
  const plan = planPayment(player, effectiveCost(player, park));
  if (!plan) return false;

  applyPayment(player, plan);
  player.parks.push(park);
  player.claimedInSeason.push(state.season);

  const reservedIndex = player.reserved.findIndex((p) => p.id === park.id);
  if (reservedIndex >= 0) player.reserved.splice(reservedIndex, 1);
  else removeFromRow(state, park.id);

  const wild = plan.wild > 0 ? ` (${plan.wild} wildcard)` : '';
  log(state, player.index, `visited ${park.name} for ${park.vp} VP${wild}`);
  return true;
}

function reservePark(state: GameState, player: Player, parkId?: string): boolean {
  const park = reservableParks(state).find((p) => p.id === parkId);
  if (!park) return false;
  player.reserved.push(park);
  removeFromRow(state, park.id);

  let note = '';
  // The first reservation of the season also takes the first player token.
  if (!state.firstPlayerTokenClaimed) {
    state.firstPlayerTokenClaimed = true;
    state.firstPlayer = player.index;
    note = ' and took the first player token';
  }
  log(state, player.index, `reserved ${park.name}${note}`);
  return true;
}

function buyGear(state: GameState, player: Player, gearId?: string): boolean {
  const card = state.gearRow.find((g) => g.id === gearId);
  if (!card || !affordableGear(state, player.index).some((g) => g.id === card.id)) return false;

  const cost = gearCost(state, card);
  const discounted = state.gearDiscountsLeft > 0;
  spend(player, 'sun', cost);
  player.gear.push(card);
  if (card.effect.kind === 'extra-bottle') {
    player.bottles.push({
      id: `p${player.index}g${player.bottles.length}`,
      kind: card.effect.bottle,
      used: false,
    });
  }
  if (card.effect.kind === 'season-campfire') player.campfires += 1;
  if (discounted) state.gearDiscountsLeft -= 1;

  const index = state.gearRow.findIndex((g) => g.id === card.id);
  const replacement = state.gearDeck.shift();
  if (replacement) state.gearRow[index] = replacement;
  else state.gearRow.splice(index, 1);

  log(
    state,
    player.index,
    `bought ${card.name} for ${cost} sun${discounted ? ' (early buyer discount)' : ''}`,
  );
  return true;
}

function resolveTrailEnd(state: GameState, action: Extract<GameAction, { type: 'trail-end' }>): void {
  if (!state.pending || state.pending.kind !== 'trail-end') return;
  const player = state.players[state.pending.player];

  switch (action.option) {
    case 'claim-park':
      claimPark(state, player, action.parkId);
      break;
    case 'reserve-park':
      reservePark(state, player, action.parkId);
      break;
    case 'buy-gear':
      buyGear(state, player, action.gearId);
      break;
    case 'photo':
      takePhoto(state, player);
      break;
    default:
      gainResources(player, { sun: 1 }, []);
      log(state, player.index, 'rested at the Trail End and gained 1 sun');
      break;
  }

  finishDecision(state);
}

function removeFromRow(state: GameState, parkId: string): void {
  const index = state.parkRow.findIndex((p) => p.id === parkId);
  if (index < 0) return;
  const replacement = state.parkDeck.shift();
  if (replacement) state.parkRow[index] = replacement;
  else state.parkRow.splice(index, 1);
}

/** Nobody may end a turn holding more than twelve tokens. */
function enforceTokenLimit(state: GameState, player: Player): void {
  const discarded: Resource[] = [];
  while (tokenCount(player) > TOKEN_LIMIT) {
    // Shed sun first, then whichever plain resource is most plentiful, and
    // never a wildcard while anything else is on hand.
    const order = [...COST_RESOURCES]
      .filter((r) => (player.resources[r] ?? 0) > 0)
      .sort((a, b) => {
        if (a === 'sun') return -1;
        if (b === 'sun') return 1;
        return (player.resources[b] ?? 0) - (player.resources[a] ?? 0);
      });
    const pick = order[0] ?? 'wild';
    player.resources[pick] = (player.resources[pick] ?? 0) - 1;
    discarded.push(pick);
  }
  if (discarded.length > 0) {
    log(
      state,
      player.index,
      `was over the ${TOKEN_LIMIT}-token limit and returned ${discarded.map(label).join(', ')}`,
    );
  }
}

function playerDone(player: Player): boolean {
  return player.hikers.every((h) => h.finished);
}

function endTurn(state: GameState): void {
  if (state.players.every(playerDone)) {
    state.phase = 'season-end';
    log(state, -1, `Season ${state.season} is over.`);
    if (state.season >= SEASONS) {
      state.phase = 'game-over';
      state.finalScores = scoreGame(state);
    }
    return;
  }

  for (let step = 1; step <= state.players.length; step++) {
    const candidate = (state.current + step) % state.players.length;
    if (!playerDone(state.players[candidate])) {
      state.current = candidate;
      return;
    }
  }
}

function startNextSeason(state: GameState): void {
  if (state.phase !== 'season-end') return;
  state.season += 1;

  const [trail, rng] = buildTrail(state.season, state.advancedOrder, state.rng);
  const [tokens, rng2] = seedSiteTokens(trail, rng);
  state.trail = trail;
  state.siteTokens = tokens;
  state.rng = rng2;
  state.gearDiscountsLeft = gearDiscountsForPlayers(state.players.length);
  state.firstPlayerTokenClaimed = false;

  for (const player of state.players) {
    // Resources carry over between seasons, subject to the token limit.
    player.campfires = campfireAllowance(player);
    player.campfireRelit = false;
    for (const bottle of player.bottles) bottle.used = false;
    for (const hiker of player.hikers) {
      hiker.position = 0;
      hiker.finished = false;
    }
    for (const gear of player.gear) {
      if (gear.effect.kind === 'season-income') gainResources(player, gear.effect.gain, []);
    }
    enforceTokenLimit(state, player);
  }

  state.current = state.firstPlayer;
  state.phase = 'playing';
  log(
    state,
    -1,
    `Season ${state.season} begins: ${trailLength(state.season)} sites, now with ${state.season} advanced site${
      state.season === 1 ? '' : 's'
    }. ${state.players[state.firstPlayer].name} leads.`,
  );
}

/* ------------------------------------------------------------------ helpers */

export function siteDef(kind: SiteKind) {
  return SITES[kind];
}

export function bottleDef(kind: BottleKind) {
  return BOTTLES[kind];
}

export function bonusCardById(id: string) {
  return BONUS_CARDS.find((b) => b.id === id)!;
}
