import {
  type GameAction,
  type GameState,
  type GearCard,
  type ParkCard,
  type Player,
  type Resource,
  type ResourceBag,
  RESOURCES,
  type SiteKind,
} from './types';
import { SITES, TRAIL_TILE_POOL, trailLength } from './data/sites';
import { PARKS } from './data/parks';
import { GEAR } from './data/gear';
import { BONUS_CARDS } from './data/bonuses';
import { shuffle } from './rng';
import { scoreGame } from './scoring';

export const PARK_ROW_SIZE = 4;
export const GEAR_ROW_SIZE = 3;
export const SEASONS = 4;
export const STARTING_CANTEENS = 1;

const PLAYER_COLORS = ['#e07a5f', '#3d8361', '#3f6fa8', '#b07bac'];

export function bag(b: ResourceBag): Required<ResourceBag> {
  return {
    sun: b.sun ?? 0,
    water: b.water ?? 0,
    forest: b.forest ?? 0,
    mountain: b.mountain ?? 0,
    animal: b.animal ?? 0,
  };
}

export function bagTotal(b: ResourceBag): number {
  return RESOURCES.reduce((sum, r) => sum + (b[r] ?? 0), 0);
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

  const names = [options.humanName?.trim() || 'You', 'Ranger Ada', 'Scout Bo', 'Blazer Cy'];
  const personalities = [undefined, 'collector', 'photographer', 'blazer'] as const;

  const players: Player[] = names.map((name, index) => ({
    index,
    name,
    isHuman: index === 0,
    personality: personalities[index],
    color: PLAYER_COLORS[index],
    resources: { sun: 0, water: 0, forest: 0, mountain: 0, animal: 0 },
    canteens: { total: STARTING_CANTEENS, used: 0 },
    campfires: 0,
    photos: 0,
    hikers: [0, 1].map((h) => ({
      id: `p${index}h${h}`,
      owner: index,
      position: 0,
      finished: false,
      claimedThisSeason: false,
    })),
    parks: [],
    claimedInSeason: [],
    gear: [],
    bonusCards: bonusDeck.slice(index * 2, index * 2 + 2).map((b) => b.id),
    reserved: [],
    boughtGearThisTurn: false,
  }));

  const [trail, r4] = buildTrail(1, rng);
  rng = r4;

  const state: GameState = {
    rng,
    season: 1,
    trail,
    players,
    current: 0,
    firstPlayer: 0,
    parkRow: parkDeck.slice(0, PARK_ROW_SIZE),
    parkDeck: parkDeck.slice(PARK_ROW_SIZE),
    gearRow: gearDeck.slice(0, GEAR_ROW_SIZE),
    gearDeck: gearDeck.slice(GEAR_ROW_SIZE),
    pending: null,
    phase: 'playing',
    log: [{ season: 1, player: -1, text: 'Season 1 begins. The trail is short and the sites are crowded.' }],
  };
  return state;
}

function buildTrail(season: number, rng: number): [SiteKind[], number] {
  const [pool, next] = shuffle(TRAIL_TILE_POOL, rng);
  const middle = pool.slice(0, trailLength(season));

  // Every trail needs a campfire (the only way to share a site) and a
  // reservation desk. Seed one in if the draw missed it, without overwriting
  // the other guaranteed site.
  const ensure = (kind: SiteKind, preferred: number): void => {
    if (middle.includes(kind)) return;
    const order = [preferred, ...middle.map((_, i) => i)];
    for (const index of order) {
      const occupant = middle[index];
      if (occupant !== 'campfire' && occupant !== 'reservation') {
        middle[index] = kind;
        return;
      }
    }
    middle[preferred] = kind;
  };
  ensure('campfire', middle.length - 1);
  ensure('reservation', 0);

  return [['trailhead', ...middle, 'trail-end'], next];
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

export function canteensAvailable(player: Player): number {
  return Math.max(0, player.canteens.total - player.canteens.used);
}

/* ----------------------------------------------------------------- payment */

/** A park's cost after gear discounts. Discounts come off the resource the
 *  player is furthest from paying, which is always the useful choice. */
export function effectiveCost(player: Player, park: ParkCard): Required<ResourceBag> {
  const cost = bag(park.cost);
  let discount = parkDiscount(player);
  while (discount > 0) {
    const candidates = RESOURCES.filter((r) => cost[r] > 0);
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
  canteens: number;
}

export function planPayment(player: Player, cost: Required<ResourceBag>): PaymentPlan | null {
  const spend = bag({});
  let shortfall = 0;
  for (const r of RESOURCES) {
    const have = player.resources[r] ?? 0;
    const paid = Math.min(have, cost[r]);
    spend[r] = paid;
    shortfall += cost[r] - paid;
  }
  if (shortfall > canteensAvailable(player)) return null;
  return { resources: spend, canteens: shortfall };
}

export function canClaim(player: Player, park: ParkCard): boolean {
  return planPayment(player, effectiveCost(player, park)) !== null;
}

function applyPayment(player: Player, plan: PaymentPlan): void {
  for (const r of RESOURCES) {
    player.resources[r] = (player.resources[r] ?? 0) - plan.resources[r];
  }
  player.canteens.used += plan.canteens;
}

function gainResources(player: Player, gain: ResourceBag, log: string[]): void {
  for (const r of RESOURCES) {
    const base = gain[r] ?? 0;
    if (base === 0) continue;
    const total = base + bonusGainFor(player, r);
    player.resources[r] = (player.resources[r] ?? 0) + total;
    log.push(`${total} ${r}`);
  }
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
      if (!full) {
        options.push({ hikerId: hiker.id, to, useCampfire: false });
      } else if (freeShare) {
        options.push({ hikerId: hiker.id, to, useCampfire: false });
      } else if (player.campfires > 0) {
        options.push({ hikerId: hiker.id, to, useCampfire: true });
      }
    }
  }
  return options;
}

export function affordableGear(state: GameState): GearCard[] {
  const player = state.players[state.current];
  if (state.pending || player.boughtGearThisTurn) return [];
  return state.gearRow.filter(
    (g) => (player.resources.sun ?? 0) >= g.cost && !player.gear.some((owned) => owned.id === g.id),
  );
}

/** Parks the current player may claim right now (row plus own reservations). */
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

/** Parks visible for reservation: the row, minus anything already reserved. */
export function reservableParks(state: GameState): ParkCard[] {
  const reserved = new Set(state.players.flatMap((p) => p.reserved.map((r) => r.id)));
  return state.parkRow.filter((p) => !reserved.has(p.id));
}

/* -------------------------------------------------------------- transitions */

export function applyAction(state: GameState, action: GameAction): GameState {
  const next = clone(state);
  switch (action.type) {
    case 'buy-gear':
      buyGear(next, action.gearId);
      break;
    case 'move':
      move(next, action.hikerId, action.to, action.useCampfire ?? false);
      break;
    case 'choose-resource':
      resolveVista(next, action.resource);
      break;
    case 'choose-reservation':
      resolveReservation(next, action.parkId);
      break;
    case 'choose-photo':
      resolvePhoto(next, action.take);
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

function buyGear(state: GameState, gearId: string): void {
  const player = state.players[state.current];
  const index = state.gearRow.findIndex((g) => g.id === gearId);
  if (index < 0) return;
  const card = state.gearRow[index];
  if ((player.resources.sun ?? 0) < card.cost || player.boughtGearThisTurn) return;

  player.resources.sun = (player.resources.sun ?? 0) - card.cost;
  player.gear.push(card);
  player.boughtGearThisTurn = true;
  if (card.effect.kind === 'extra-canteen') player.canteens.total += 1;

  const replacement = state.gearDeck.shift();
  if (replacement) state.gearRow[index] = replacement;
  else state.gearRow.splice(index, 1);

  log(state, player.index, `bought ${card.name} for ${card.cost} sun`);
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
  const kind = state.trail[to];
  const site = SITES[kind];

  if (to === state.trail.length - 1) {
    hiker.finished = true;
    state.pending = { player: player.index, hikerId, siteIndex: to, kind: 'trail-end' };
    log(state, player.index, 'reached the Trail End');
    return;
  }

  const gained: string[] = [];
  if (site.gain) gainResources(player, site.gain, gained);
  if (kind === 'campfire') {
    player.campfires += 1;
    gained.push('1 campfire token');
  }
  if (kind === 'canteen') {
    player.canteens.used = 0;
    gained.push('refilled canteens');
  }

  log(
    state,
    player.index,
    `moved to ${site.name}${gained.length ? ` and gained ${gained.join(', ')}` : ''}`,
  );

  if (site.choice === 'vista' || site.choice === 'photo' || site.choice === 'reservation') {
    state.pending = { player: player.index, hikerId, siteIndex: to, kind: site.choice };
    return;
  }
  endTurn(state);
}

function resolveVista(state: GameState, resource: Resource): void {
  if (!state.pending || state.pending.kind !== 'vista') return;
  const player = state.players[state.pending.player];
  const gained: string[] = [];
  gainResources(player, { [resource]: 1 }, gained);
  log(state, player.index, `took ${gained.join(', ')} at the Vista`);
  state.pending = null;
  endTurn(state);
}

function resolveReservation(state: GameState, parkId: string): void {
  if (!state.pending || state.pending.kind !== 'reservation') return;
  const player = state.players[state.pending.player];
  const index = state.parkRow.findIndex((p) => p.id === parkId);
  if (index >= 0 && reservableParks(state).some((p) => p.id === parkId)) {
    const park = state.parkRow[index];
    player.reserved.push(park);
    const replacement = state.parkDeck.shift();
    if (replacement) state.parkRow[index] = replacement;
    else state.parkRow.splice(index, 1);
    log(state, player.index, `reserved ${park.name}`);
  }
  state.pending = null;
  endTurn(state);
}

function resolvePhoto(state: GameState, take: boolean): void {
  if (!state.pending || state.pending.kind !== 'photo') return;
  const player = state.players[state.pending.player];
  const free = hasEffect(player, 'free-photos');
  if (take && (free || (player.resources.sun ?? 0) >= 1)) {
    if (!free) player.resources.sun = (player.resources.sun ?? 0) - 1;
    player.photos += 1;
    log(state, player.index, `took a photo${free ? ' (Camera: free)' : ' for 1 sun'}`);
  } else {
    player.resources.sun = (player.resources.sun ?? 0) + 1;
    log(state, player.index, 'skipped the photo and gained 1 sun');
  }
  state.pending = null;
  endTurn(state);
}

function resolveTrailEnd(state: GameState, action: Extract<GameAction, { type: 'trail-end' }>): void {
  if (!state.pending || state.pending.kind !== 'trail-end') return;
  const player = state.players[state.pending.player];
  const hiker = player.hikers.find((h) => h.id === state.pending!.hikerId);

  if (action.option === 'claim-park' && action.parkId) {
    const park = claimableParks(state, player.index).find((p) => p.id === action.parkId);
    if (park) {
      const plan = planPayment(player, effectiveCost(player, park));
      if (plan) {
        applyPayment(player, plan);
        player.parks.push(park);
        player.claimedInSeason.push(state.season);
        if (hiker) hiker.claimedThisSeason = true;

        const reservedIndex = player.reserved.findIndex((p) => p.id === park.id);
        if (reservedIndex >= 0) {
          player.reserved.splice(reservedIndex, 1);
        } else {
          const rowIndex = state.parkRow.findIndex((p) => p.id === park.id);
          if (rowIndex >= 0) {
            const replacement = state.parkDeck.shift();
            if (replacement) state.parkRow[rowIndex] = replacement;
            else state.parkRow.splice(rowIndex, 1);
          }
        }
        const wild = plan.canteens > 0 ? ` (${plan.canteens} canteen)` : '';
        log(state, player.index, `claimed ${park.name} for ${park.vp} VP${wild}`);
      }
    }
  } else if (action.option === 'photo') {
    const free = hasEffect(player, 'free-photos');
    if (free || (player.resources.sun ?? 0) >= 1) {
      if (!free) player.resources.sun = (player.resources.sun ?? 0) - 1;
      player.photos += 1;
      log(state, player.index, 'took a summit photo');
    }
  } else {
    player.resources.sun = (player.resources.sun ?? 0) + 1;
    log(state, player.index, 'rested at the Trail End and gained 1 sun');
  }

  state.pending = null;
  endTurn(state);
}

function playerDone(player: Player): boolean {
  return player.hikers.every((h) => h.finished);
}

function endTurn(state: GameState): void {
  state.players[state.current].boughtGearThisTurn = false;

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
  const [trail, rng] = buildTrail(state.season, state.rng);
  state.trail = trail;
  state.rng = rng;

  for (const player of state.players) {
    // Sun does not keep between seasons; the other resources do.
    player.resources.sun = 0;
    player.canteens.used = 0;
    player.boughtGearThisTurn = false;
    for (const hiker of player.hikers) {
      hiker.position = 0;
      hiker.finished = false;
      hiker.claimedThisSeason = false;
    }
    for (const gear of player.gear) {
      if (gear.effect.kind === 'season-income') {
        const gained: string[] = [];
        gainResources(player, gear.effect.gain, gained);
      } else if (gear.effect.kind === 'season-campfire') {
        player.campfires += 1;
      }
    }
  }

  state.firstPlayer = (state.firstPlayer + 1) % state.players.length;
  state.current = state.firstPlayer;
  state.phase = 'playing';
  log(state, -1, `Season ${state.season} begins with ${trailLength(state.season)} trail sites.`);
}

/* ------------------------------------------------------------------ helpers */

export function siteDef(kind: SiteKind) {
  return SITES[kind];
}

export function bonusCardById(id: string) {
  return BONUS_CARDS.find((b) => b.id === id)!;
}
