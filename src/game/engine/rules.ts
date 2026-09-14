import {
  COST_RESOURCES,
  type GameState,
  type GearCard,
  type ParkCard,
  type Player,
  type Resource,
  type ResourceBag,
  RESOURCES,
} from '../types';
import {
  CAMPFIRES_PER_SEASON,
  FIRST_GEAR_DISCOUNT,
  PHOTO_COST,
  PHOTO_COST_DISCOUNTED,
  WILD_COVERS_BASE,
  WILD_COVERS_NIGHTFALL,
} from '../data/sites';
import { BOTTLES } from '../data/sites';
import { bag, label } from './primitives';

/* ------------------------------------------------------- gear/effect lookup */

export function hasEffect(player: Player, kind: GearCard['effect']['kind']): boolean {
  return player.gear.some((g) => g.effect.kind === kind);
}

export function bonusGainFor(player: Player, resource: Resource): number {
  return player.gear.filter(
    (g) => g.effect.kind === 'bonus-on-gain' && g.effect.resource === resource,
  ).length;
}

export function parkDiscount(player: Player): number {
  return player.gear.reduce(
    (sum, g) => sum + (g.effect.kind === 'park-discount' ? g.effect.amount : 0),
    0,
  );
}

export function photoValue(player: Player): number {
  const card = player.gear.find((g) => g.effect.kind === 'photo-value');
  return card && card.effect.kind === 'photo-value' ? card.effect.vp : 1;
}

/** One wildcard covers two resources once Nightfall is in play. */
export function wildCoverage(state: GameState): number {
  return state.expansions.nightfall ? WILD_COVERS_NIGHTFALL : WILD_COVERS_BASE;
}

/** The season card's discount on park costs, if any. */
export function seasonParkDiscount(state: GameState): number {
  const effect = state.seasonCard?.effect;
  return effect?.kind === 'park-discount' ? effect.amount : 0;
}

/** True when this season lets a park action take the top of the deck unseen. */
export function chanceSeason(state: GameState): boolean {
  return state.seasonCard?.effect.kind === 'chance';
}

/** Campfires a player has alight at the start of a season, gear included. */
export function campfireAllowance(player: Player): number {
  return CAMPFIRES_PER_SEASON + player.gear.filter((g) => g.effect.kind === 'season-campfire').length;
}

/** Photos cost less while you hold the camera, or if you own a Tripod. */
export function photoCost(state: GameState, playerIndex: number): number {
  const player = state.players[playerIndex];
  const base =
    state.cameraHolder === playerIndex || hasEffect(player, 'cheap-photos')
      ? PHOTO_COST_DISCOUNTED
      : PHOTO_COST;
  const effect = state.seasonCard?.effect;
  const seasonal = effect?.kind === 'cheap-photos' ? effect.amount : 0;
  return Math.max(1, base - seasonal);
}

/** Photos are paid in sun, and wildcards may cover the rest. */
export function canAffordPhoto(state: GameState, playerIndex: number): boolean {
  const player = state.players[playerIndex];
  const cost = photoCost(state, playerIndex);
  const sun = Math.min(player.resources.sun ?? 0, cost);
  const missing = cost - sun;
  return Math.ceil(missing / wildCoverage(state)) <= (player.resources.wild ?? 0);
}

export function gearCost(state: GameState, card: GearCard): number {
  const effect = state.seasonCard?.effect;
  const seasonal = effect?.kind === 'cheap-gear' ? effect.amount : 0;
  return Math.max(
    0,
    card.cost - (state.gearDiscountsLeft > 0 ? FIRST_GEAR_DISCOUNT : 0) - seasonal,
  );
}

export function usableBottles(player: Player) {
  return player.bottles.filter(
    (b) => !b.used && (player.resources.water ?? 0) >= (BOTTLES[b.kind].cost.water ?? 0),
  );
}

/* ----------------------------------------------------------------- payment */

/** A park's cost after gear discounts. Discounts come off the resource the
 *  player is furthest from paying, which is always the useful choice. */
export function effectiveCost(
  player: Player,
  park: ParkCard,
  state?: GameState,
): Required<ResourceBag> {
  const cost = bag(park.cost);
  let discount = parkDiscount(player) + (state ? seasonParkDiscount(state) : 0);
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

/**
 * Pay with matching resources first, then cover the rest with wildcards. With
 * Nightfall in play each wildcard covers two missing resources.
 */
export function planPayment(
  player: Player,
  cost: Required<ResourceBag>,
  coverage = WILD_COVERS_BASE,
): PaymentPlan | null {
  const spend = bag({});
  let shortfall = 0;
  for (const r of COST_RESOURCES) {
    const have = player.resources[r] ?? 0;
    const paid = Math.min(have, cost[r]);
    spend[r] = paid;
    shortfall += cost[r] - paid;
  }
  const wild = Math.ceil(shortfall / coverage);
  if (wild > (player.resources.wild ?? 0)) return null;
  spend.wild = wild;
  return { resources: spend, wild };
}

export function canClaim(state: GameState, player: Player, park: ParkCard): boolean {
  return planPayment(player, effectiveCost(player, park, state), wildCoverage(state)) !== null;
}

export function applyPayment(player: Player, plan: PaymentPlan): void {
  for (const r of RESOURCES) {
    player.resources[r] = (player.resources[r] ?? 0) - plan.resources[r];
  }
}

export function gainResources(player: Player, gain: ResourceBag, log: string[]): void {
  for (const r of RESOURCES) {
    const base = gain[r] ?? 0;
    if (base === 0) continue;
    const total = base + bonusGainFor(player, r);
    player.resources[r] = (player.resources[r] ?? 0) + total;
    log.push(`${total} ${label(r)}`);
  }
}

/**
 * Site payouts also trigger the season card's weather: gaining the named
 * resource at a site pays a little extra for the whole season.
 */
export function gainAtSite(state: GameState, player: Player, gain: ResourceBag, log: string[]): void {
  gainResources(player, gain, log);
  const effect = state.seasonCard?.effect;
  if (effect?.kind !== 'weather') return;
  if ((gain[effect.when] ?? 0) === 0) return;
  const weather: string[] = [];
  gainResources(player, effect.gain, weather);
  if (weather.length > 0) log.push(`${weather.join(', ')} (${state.seasonCard!.name})`);
}
