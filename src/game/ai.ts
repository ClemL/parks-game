import {
  affordableGear,
  bag,
  bagTotal,
  bottleDef,
  canAffordPhoto,
  claimableParks,
  effectiveCost,
  gearCost,
  legalMoves,
  occupants,
  photoCost,
  photoValue,
  reservableParks,
  siteDef,
  usableBottles,
} from './engine';
import { BONUS_CARDS } from './data/bonuses';
import { FIRST_PLAYER_VP } from './data/sites';
import { scoringView } from './scoring';
import type {
  AiPersonality,
  GameAction,
  GameState,
  GearCard,
  ParkCard,
  Player,
  Resource,
  ResourceBag,
} from './types';
import { COST_RESOURCES, RESOURCES } from './types';

interface Weights {
  parkClaim: number;
  reserve: number;
  photo: number;
  camera: number;
  bottle: number;
  campfireCost: number;
  block: number;
  finishPenalty: number;
  skipPenalty: number;
  gearAppetite: number;
  sunBias: number;
}

const PROFILES: Record<AiPersonality, Weights> = {
  // Ranger Ada: hoards resources and cashes them in for the biggest parks.
  collector: {
    parkClaim: 2.8,
    reserve: 2.3,
    photo: 1.2,
    camera: 0.8,
    bottle: 1.0,
    campfireCost: 1.1,
    block: 0.15,
    finishPenalty: 0.7,
    skipPenalty: 1.0,
    gearAppetite: 1.0,
    sunBias: 0.9,
  },
  // Scout Bo: chases the camera, photos and gear, then picks off cheap parks.
  photographer: {
    parkClaim: 2.1,
    reserve: 1.5,
    photo: 2.1,
    camera: 2.2,
    bottle: 1.1,
    campfireCost: 1.0,
    block: 0.2,
    finishPenalty: 0.6,
    skipPenalty: 1.0,
    gearAppetite: 1.6,
    sunBias: 1.45,
  },
  // Blazer Cy: tempo and denial - takes the site and the token you wanted.
  blazer: {
    parkClaim: 2.6,
    reserve: 2.6,
    photo: 1.3,
    camera: 1.3,
    bottle: 0.9,
    campfireCost: 0.5,
    block: 0.4,
    finishPenalty: 0.55,
    skipPenalty: 1.0,
    gearAppetite: 1.2,
    sunBias: 1.05,
  },
};

function weightsFor(player: Player): Weights {
  return PROFILES[player.personality ?? 'collector'];
}

/* --------------------------------------------------------- park evaluation */

interface ParkTarget {
  park: ParkCard;
  need: Required<ResourceBag>;
  priority: number;
}

function bonusSynergy(state: GameState, player: Player, park: ParkCard): number {
  const view = scoringView(player, state.cameraHolder === player.index);
  let delta = 0;
  for (const id of player.bonusCards) {
    const card = BONUS_CARDS.find((b) => b.id === id);
    if (!card) continue;
    delta += card.score({ ...view, parks: [...view.parks, park] }) - card.score(view);
  }
  return delta;
}

/** Parks worth chasing: the row plus the player's own reservations. */
function targets(state: GameState, player: Player): ParkTarget[] {
  const reservedElsewhere = new Set(
    state.players.flatMap((p) => (p.index === player.index ? [] : p.reserved.map((r) => r.id))),
  );
  const pool = [...player.reserved, ...state.parkRow.filter((p) => !reservedElsewhere.has(p.id))];

  return pool.map((park) => {
    const cost = effectiveCost(player, park);
    const need = bag({});
    let missing = 0;
    for (const r of COST_RESOURCES) {
      const short = Math.max(0, cost[r] - (player.resources[r] ?? 0));
      need[r] = short;
      missing += short;
    }
    const wildCover = Math.min(missing, player.resources.wild ?? 0);
    const realMissing = missing - wildCover;
    const value = park.vp + bonusSynergy(state, player, park) * 0.9;
    const reservedByMe = player.reserved.some((p) => p.id === park.id);
    return {
      park,
      need,
      priority: (value / (1 + realMissing * 0.8)) * (reservedByMe ? 1.25 : 1),
    };
  });
}

/** How much each resource is worth to this player right now. */
function resourceValues(state: GameState, player: Player): Record<Resource, number> {
  const w = weightsFor(player);
  const values: Record<Resource, number> = { sun: 0, water: 0, forest: 0, mountain: 0, wild: 0 };
  const ranked = targets(state, player)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  for (const [i, target] of ranked.entries()) {
    const weight = target.priority * (1 - i * 0.22);
    for (const r of COST_RESOURCES) {
      if (target.need[r] > 0) values[r] += weight * Math.min(target.need[r], 2) * 0.42;
    }
  }
  for (const r of RESOURCES) {
    values[r] += 0.45; // a spare resource is never dead weight
  }
  // Sun is wiped at every season break, so it is only worth what it can buy
  // before then: park costs, gear and photos.
  values.sun = values.sun * 0.75 + w.sunBias * 0.85;
  // A wildcard pays for whatever is scarcest, so it is worth the best of them.
  values.wild = Math.max(...COST_RESOURCES.map((r) => values[r])) * 1.05;
  return values;
}

/* --------------------------------------------------------- move evaluation */

function opponentAppetite(state: GameState, index: number): number {
  const kind = state.trail[index];
  const def = siteDef(kind);
  const gainSize = def.gain ? bagTotal(def.gain) : 2;
  const reachable = state.players.filter(
    (p) => p.index !== state.current && p.hikers.some((h) => !h.finished && h.position < index),
  ).length;
  return gainSize * reachable * 0.25;
}

/** How much of a park's value is at risk if we walk past the Trail End now. */
function claimUrgency(state: GameState, player: Player, park: ParkCard): number {
  if (player.reserved.some((p) => p.id === park.id)) return 0.18;
  const contenders = state.players.filter(
    (other) => other.index !== player.index && canClaimSoon(other, park),
  ).length;
  return Math.min(1, 0.3 + 0.22 * contenders);
}

/** An opponent is a threat to a park when they are one resource away from it. */
function canClaimSoon(other: Player, park: ParkCard): boolean {
  const cost = effectiveCost(other, park);
  let missing = 0;
  for (const r of COST_RESOURCES) missing += Math.max(0, cost[r] - (other.resources[r] ?? 0));
  return missing - (other.resources.wild ?? 0) <= 1;
}

function bestTrailEndValue(state: GameState, player: Player, values: Record<Resource, number>): number {
  const w = weightsFor(player);
  const options: number[] = [];

  const claim = claimableParks(state, player.index)
    .map((p) => (p.vp + bonusSynergy(state, player, p)) * claimUrgency(state, player, p))
    .sort((a, b) => b - a)[0];
  if (claim !== undefined) options.push(claim * w.parkClaim * 0.55);

  const reserve = reservableParks(state)
    .map((p) => p.vp + bonusSynergy(state, player, p))
    .sort((a, b) => b - a)[0];
  if (reserve !== undefined) {
    // The first reservation of the season also carries the first player token.
    const prize = state.firstPlayerTokenClaimed ? 0 : FIRST_PLAYER_VP + 1.2;
    options.push((reserve * 0.42 + prize) * (w.reserve / 2.3));
  }

  const gear = affordableGear(state, player.index)
    .map((g) => gearValue(state, player, g, values) * w.gearAppetite - gearCost(state, g) * 0.5)
    .sort((a, b) => b - a)[0];
  if (gear !== undefined) options.push(gear);

  if (canAffordPhoto(state, player.index)) {
    options.push(w.photo * photoValue(player) * 0.6);
  }
  options.push(values.sun * 0.5);
  return Math.max(...options);
}

function siteValue(
  state: GameState,
  player: Player,
  index: number,
  values: Record<Resource, number>,
): number {
  const kind = state.trail[index];
  const def = siteDef(kind);
  const w = weightsFor(player);
  let value = 0;

  if (def.gain) {
    for (const r of RESOURCES) {
      const count = def.gain[r] ?? 0;
      if (count > 0) {
        const withGear =
          count +
          player.gear.filter((g) => g.effect.kind === 'bonus-on-gain' && g.effect.resource === r).length;
        value += values[r] * withGear;
      }
    }
  }

  // The season token on an untaken site is worth a full resource to the first
  // hiker who gets there.
  const token = state.siteTokens[index];
  if (token) value += values[token];

  switch (kind) {
    case 'spring':
      value += player.bottles.some((b) => b.used) ? w.bottle * 0.9 : 0.2;
      break;
    case 'camera': {
      const holdsCamera = state.cameraHolder === player.index;
      const photoNow = canAffordPhoto(state, player.index) ? w.photo * photoValue(player) * 0.8 : 0;
      // Taking the camera is worth more when someone else is holding it.
      const grab = w.camera * (state.cameraHolder === null ? 0.7 : holdsCamera ? 0.25 : 1);
      value += Math.max(grab + photoNow, w.bottle);
      break;
    }
    case 'trail-end':
      value += bestTrailEndValue(state, player, values);
      break;
    default:
      break;
  }

  value += opponentAppetite(state, index) * w.block;
  return value;
}

/**
 * Stops a hiker could still make. A site someone is standing on today usually
 * clears before the season ends, so it counts as a partial stop rather than
 * not at all - otherwise a crowded trail makes walking home look free.
 */
function stopsAhead(state: GameState, from: number): { index: number; weight: number }[] {
  const end = state.trail.length - 1;
  const out: { index: number; weight: number }[] = [];
  for (let i = from + 1; i < end; i++) {
    out.push({ index: i, weight: occupants(state, i).length === 0 ? 1 : 0.7 });
  }
  return out;
}

/**
 * The heart of the CPU: every turn spent walking past a site is a turn it will
 * never get back, because the season ends when both hikers are home. So a move
 * is worth the value of where it lands minus the value of the stops it gives up.
 */
export function bestMove(state: GameState): GameAction | null {
  const player = state.players[state.current];
  const w = weightsFor(player);
  const values = resourceValues(state, player);
  const moves = legalMoves(state);
  if (moves.length === 0) return null;

  const end = state.trail.length - 1;
  let best: { action: GameAction; score: number } | null = null;

  for (const option of moves) {
    const hiker = player.hikers.find((h) => h.id === option.hikerId)!;
    const ahead = stopsAhead(state, hiker.position);
    const weightTotal = ahead.reduce((sum, s) => sum + s.weight, 0);
    const meanAhead =
      weightTotal === 0
        ? 0
        : ahead.reduce((sum, s) => sum + siteValue(state, player, s.index, values) * s.weight, 0) /
          weightTotal;

    let score = siteValue(state, player, option.to, values);
    const skipped = ahead
      .filter((s) => s.index < option.to)
      .reduce((sum, s) => sum + s.weight, 0);
    score -= skipped * meanAhead * w.skipPenalty;
    if (option.useCampfire) score -= w.campfireCost;
    if (option.to === end) {
      const lost = Math.min(weightTotal, 4);
      score -= lost * meanAhead * w.finishPenalty * (state.season === 4 ? 0.75 : 1);
    }

    if (!best || score > best.score) {
      best = {
        action: { type: 'move', hikerId: option.hikerId, to: option.to, useCampfire: option.useCampfire },
        score,
      };
    }
  }
  return best ? best.action : null;
}

/* --------------------------------------------------------- gear evaluation */

function gearValue(
  state: GameState,
  player: Player,
  card: GearCard,
  values: Record<Resource, number>,
): number {
  const w = weightsFor(player);
  const seasonsLeft = 5 - state.season;
  switch (card.effect.kind) {
    case 'bonus-on-gain':
      return values[card.effect.resource] * 0.9 * seasonsLeft * 0.45;
    case 'season-income':
      return bagTotal(card.effect.gain) * 0.8 * seasonsLeft * 0.4;
    case 'season-campfire':
      return seasonsLeft * 0.4;
    case 'cheap-photos':
      return w.photo * seasonsLeft * 0.45;
    case 'photo-value':
      return (player.photos + seasonsLeft) * 0.55 * (w.photo / 1.2);
    case 'ignore-occupancy':
      return (1.0 + w.block) * seasonsLeft * 0.42;
    case 'extra-bottle':
      return w.bottle * seasonsLeft * 0.45;
    case 'park-discount':
      return card.effect.amount * seasonsLeft * 0.7;
    default:
      return 0;
  }
}

/* ----------------------------------------------------- pending decisions */

function cameraDecision(state: GameState, player: Player): GameAction {
  const w = weightsFor(player);
  // Declining the camera hands over a bottle instead; take whichever is worth more.
  const cameraWorth =
    w.camera * (state.cameraHolder === player.index ? 0.3 : 1) +
    (canAffordPhoto(state, player.index) ? w.photo * photoValue(player) * 0.5 : 0);
  return { type: 'camera', option: cameraWorth >= w.bottle ? 'take-camera' : 'take-bottle' };
}

function trailEndDecision(state: GameState, player: Player): GameAction {
  const w = weightsFor(player);
  const values = resourceValues(state, player);

  const claim = claimableParks(state, player.index)
    .map((p) => ({ p, score: p.vp + bonusSynergy(state, player, p) }))
    .sort((a, b) => b.score - a.score)[0];
  const reserve = reservableParks(state)
    .map((p) => ({ p, score: p.vp + bonusSynergy(state, player, p) }))
    .sort((a, b) => b.score - a.score)[0];
  const gear = affordableGear(state, player.index)
    .map((g) => ({ g, score: gearValue(state, player, g, values) * w.gearAppetite - gearCost(state, g) * 0.5 }))
    .sort((a, b) => b.score - a.score)[0];

  const options: { action: GameAction; score: number }[] = [];

  if (claim) {
    const lastChance = state.season >= 3;
    const cost = bagTotal(effectiveCost(player, claim.p));
    const worthIt = lastChance || claim.score >= 2.5 || claim.score / Math.max(1, cost) >= 0.6;
    if (worthIt) {
      options.push({
        action: { type: 'trail-end', option: 'claim-park', parkId: claim.p.id },
        score: claim.score * w.parkClaim * 0.5,
      });
    }
  }

  if (reserve && player.reserved.length < 2 && state.season < 4) {
    const prize = state.firstPlayerTokenClaimed ? 0 : FIRST_PLAYER_VP + 1.2;
    options.push({
      action: { type: 'trail-end', option: 'reserve-park', parkId: reserve.p.id },
      score: (reserve.score * 0.42 + prize) * (w.reserve / 2.3),
    });
  }

  if (gear && gear.score > 0.5) {
    options.push({ action: { type: 'trail-end', option: 'buy-gear', gearId: gear.g.id }, score: gear.score });
  }

  if (canAffordPhoto(state, player.index)) {
    const surplus = (player.resources.sun ?? 0) - photoCost(state, player.index);
    options.push({
      action: { type: 'trail-end', option: 'photo' },
      // Sun left at the season break is wasted, so a photo is close to free then.
      score: w.photo * photoValue(player) * 0.6 + (surplus >= 0 ? 0.4 : 0),
    });
  }

  options.push({ action: { type: 'trail-end', option: 'rest' }, score: values.sun * 0.5 });
  options.sort((a, b) => b.score - a.score);
  return options[0].action;
}

/** Bottles convert spare water; use one when the output is worth more. */
function bottleAction(state: GameState): GameAction | null {
  const player = state.players[state.current];
  const values = resourceValues(state, player);
  for (const bottle of usableBottles(player)) {
    const def = bottleDef(bottle.kind);
    const out = RESOURCES.reduce((sum, r) => sum + values[r] * (def.gain[r] ?? 0), 0);
    const inCost = values.water * (def.cost.water ?? 0);
    // Late in the season, water that will never buy anything is better converted.
    if (out > inCost * 1.15) {
      return { type: 'use-bottle', bottleId: bottle.id };
    }
  }
  return null;
}

/** The single action this CPU wants to take next. */
export function aiAction(state: GameState): GameAction | null {
  if (state.phase === 'season-end') return { type: 'end-season' };
  if (state.phase !== 'playing') return null;
  const player = state.players[state.current];
  if (player.isHuman) return null;

  if (state.pending) {
    if (state.pending.stage === 'take-photo') {
      // Only shoot if the sun is not already spoken for by a park in reach.
      const w = weightsFor(player);
      const earmark = Math.max(
        0,
        ...targets(state, player)
          .sort((a, b) => b.priority - a.priority)
          .slice(0, 2)
          .map((t) => t.need.sun),
      );
      const left = (player.resources.sun ?? 0) - photoCost(state, player.index);
      return { type: 'camera-photo', take: left >= earmark || w.photo >= 2 };
    }
    if (state.pending.kind === 'camera') return cameraDecision(state, player);
    return trailEndDecision(state, player);
  }

  const bottle = bottleAction(state);
  if (bottle) return bottle;
  return bestMove(state);
}
