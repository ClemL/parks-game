import {
  affordableGear,
  bag,
  bagTotal,
  canteensAvailable,
  claimableParks,
  effectiveCost,
  legalMoves,
  occupants,
  photoValue,
  reservableParks,
  siteDef,
} from './engine';
import { BONUS_CARDS } from './data/bonuses';
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
import { RESOURCES } from './types';

interface Weights {
  parkClaim: number;
  reservation: number;
  photo: number;
  campfireToken: number;
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
    reservation: 2.2,
    photo: 1.25,
    campfireToken: 0.9,
    campfireCost: 1.1,
    block: 0.15,
    finishPenalty: 0.7,
    skipPenalty: 1.0,
    gearAppetite: 1.0,
    sunBias: 0.9,
  },
  // Scout Bo: photos and gear engine first, parks when they are cheap.
  photographer: {
    parkClaim: 2.1,
    reservation: 1.4,
    photo: 2.1,
    campfireToken: 0.8,
    campfireCost: 1.0,
    block: 0.2,
    finishPenalty: 0.6,
    skipPenalty: 1.0,
    gearAppetite: 1.5,
    sunBias: 1.45,
  },
  // Blazer Cy: tempo and denial - takes the site you wanted.
  blazer: {
    parkClaim: 2.6,
    reservation: 1.9,
    photo: 1.35,
    campfireToken: 1.25,
    campfireCost: 0.5,
    block: 0.4,
    finishPenalty: 0.6,
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

function bonusSynergy(player: Player, park: ParkCard): number {
  const view = scoringView(player);
  let delta = 0;
  for (const id of player.bonusCards) {
    const card = BONUS_CARDS.find((b) => b.id === id);
    if (!card) continue;
    const before = card.score(view);
    const after = card.score({ ...view, parks: [...view.parks, park] });
    delta += after - before;
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
    for (const r of RESOURCES) {
      const short = Math.max(0, cost[r] - (player.resources[r] ?? 0));
      need[r] = short;
      missing += short;
    }
    const wildCover = Math.min(missing, canteensAvailable(player));
    const realMissing = missing - wildCover;
    const value = park.vp + bonusSynergy(player, park) * 0.9;
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
  const values: Record<Resource, number> = { sun: 0, water: 0, forest: 0, mountain: 0, animal: 0 };
  const ranked = targets(state, player)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  for (const [i, target] of ranked.entries()) {
    const weight = target.priority * (1 - i * 0.22);
    for (const r of RESOURCES) {
      if (target.need[r] > 0) values[r] += weight * Math.min(target.need[r], 2) * 0.42;
    }
  }
  for (const r of RESOURCES) {
    values[r] += 0.45; // a spare resource is never dead weight
  }
  // Sun buys gear and photos, so it keeps value even with nothing to pay for.
  // Sun is wiped at the end of every season, so it is only worth what it can
  // buy before then: park costs, gear, and photos.
  values.sun = values.sun * 0.75 + w.sunBias * 0.85;
  return values;
}

/* --------------------------------------------------------- move evaluation */

function opponentAppetite(state: GameState, index: number): number {
  // How attractive this site is to other players who could still reach it.
  const kind = state.trail[index];
  const def = siteDef(kind);
  const gainSize = def.gain ? bagTotal(def.gain) : kind === 'vista' || kind === 'reservation' ? 2 : 1;
  const reachable = state.players.filter(
    (p) =>
      p.index !== state.current &&
      p.hikers.some((h) => !h.finished && h.position < index),
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
  for (const r of RESOURCES) missing += Math.max(0, cost[r] - (other.resources[r] ?? 0));
  return missing - canteensAvailable(other) <= 1;
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
          count + player.gear.filter((g) => g.effect.kind === 'bonus-on-gain' && g.effect.resource === r).length;
        value += values[r] * withGear;
      }
    }
  }

  switch (kind) {
    case 'vista':
      value += Math.max(...RESOURCES.map((r) => values[r]));
      break;
    case 'campfire':
      value += w.campfireToken * (player.campfires === 0 ? 1.4 : 0.7);
      break;
    case 'photo': {
      const free = player.gear.some((g) => g.effect.kind === 'free-photos');
      const canShoot = free || (player.resources.sun ?? 0) >= 1;
      value += canShoot ? w.photo * photoValue(player) : values.sun * 0.8;
      break;
    }
    case 'canteen':
      value += player.canteens.used > 0 ? 1.3 * player.canteens.used : 0.4;
      break;
    case 'reservation': {
      const best = reservableParks(state)
        .map((p) => p.vp + bonusSynergy(player, p) * 0.9)
        .sort((a, b) => b - a)[0];
      value += best ? (best / 5) * w.reservation : 0;
      break;
    }
    case 'trail-end': {
      // The Trail End never closes, so a park we can already afford is mostly
      // deferred value. Only the risk of an opponent taking it first is urgent.
      const claimable = claimableParks(state, player.index);
      const best = claimable
        .map((p) => (p.vp + bonusSynergy(player, p)) * claimUrgency(state, player, p))
        .sort((a, b) => b - a)[0];
      if (best !== undefined) {
        value += best * w.parkClaim * 0.55;
      } else {
        const free = player.gear.some((g) => g.effect.kind === 'free-photos');
        value += free || (player.resources.sun ?? 0) >= 1 ? w.photo * 0.5 : values.sun * 0.5;
      }
      break;
    }
    default:
      break;
  }

  value += opponentAppetite(state, index) * w.block;
  return value;
}

/** Sites a hiker could still stop at, ignoring who is standing where. */
function openSitesAhead(state: GameState, from: number): number[] {
  const end = state.trail.length - 1;
  const out: number[] = [];
  for (let i = from + 1; i < end; i++) {
    if (occupants(state, i).length === 0) out.push(i);
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
    const ahead = openSitesAhead(state, hiker.position);
    const meanAhead =
      ahead.length === 0
        ? 0
        : ahead.reduce((sum, i) => sum + siteValue(state, player, i, values), 0) / ahead.length;

    let score = siteValue(state, player, option.to, values);

    // Stops walked past, not counting sites that were blocked anyway.
    const skipped = ahead.filter((i) => i < option.to).length;
    score -= skipped * meanAhead * w.skipPenalty;

    if (option.useCampfire) score -= w.campfireCost;

    if (option.to === end) {
      // Retiring a hiker forfeits every stop it had left this season.
      const lost = Math.min(ahead.length, 4);
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

function gearValue(state: GameState, player: Player, card: GearCard, values: Record<Resource, number>): number {
  const w = weightsFor(player);
  const seasonsLeft = 5 - state.season;
  switch (card.effect.kind) {
    case 'bonus-on-gain':
      return values[card.effect.resource] * 0.9 * seasonsLeft * 0.45;
    case 'season-income':
      return bagTotal(card.effect.gain) * 0.8 * seasonsLeft * 0.4;
    case 'season-campfire':
      return w.campfireToken * seasonsLeft * 0.4;
    case 'free-photos':
      return w.photo * seasonsLeft * 0.5;
    case 'photo-value':
      return (player.photos + seasonsLeft) * 0.55 * (w.photo / 1.2);
    case 'ignore-occupancy':
      return (1.0 + w.block) * seasonsLeft * 0.42;
    case 'extra-canteen':
      return seasonsLeft * 0.55;
    case 'park-discount':
      return card.effect.amount * seasonsLeft * 0.7;
    default:
      return 0;
  }
}

export function bestGearPurchase(state: GameState): GameAction | null {
  const player = state.players[state.current];
  const w = weightsFor(player);
  const values = resourceValues(state, player);
  const options = affordableGear(state);
  if (options.length === 0) return null;

  // Keep back sun for a park we could claim this season with a hiker still walking.
  const hikerWalking = player.hikers.some((h) => !h.finished);
  const sunNeededNow = hikerWalking
    ? Math.max(
        0,
        ...claimableParks(state, player.index)
          .filter((p) => p.vp >= 4)
          .map((p) => effectiveCost(player, p).sun ?? 0),
      )
    : 0;

  let best: { card: GearCard; score: number } | null = null;
  for (const card of options) {
    if ((player.resources.sun ?? 0) - card.cost < sunNeededNow) continue;
    const score = gearValue(state, player, card, values) * w.gearAppetite - card.cost * 0.55;
    if (score > 0.55 && (!best || score > best.score)) best = { card, score };
  }
  return best ? { type: 'buy-gear', gearId: best.card.id } : null;
}

/* ----------------------------------------------------- pending decisions */

function resolvePending(state: GameState): GameAction {
  const player = state.players[state.current];
  const w = weightsFor(player);
  const values = resourceValues(state, player);
  const pending = state.pending!;

  if (pending.kind === 'vista') {
    const pick = RESOURCES.reduce((bestR, r) => (values[r] > values[bestR] ? r : bestR), RESOURCES[0]);
    return { type: 'choose-resource', resource: pick };
  }

  if (pending.kind === 'reservation') {
    const options = reservableParks(state);
    if (options.length === 0) return { type: 'choose-reservation', parkId: '' };
    const pick = options
      .map((p) => ({ p, score: p.vp + bonusSynergy(player, p) * 0.9 - bagTotal(p.cost) * 0.25 }))
      .sort((a, b) => b.score - a.score)[0].p;
    return { type: 'choose-reservation', parkId: pick.id };
  }

  if (pending.kind === 'photo') {
    const free = player.gear.some((g) => g.effect.kind === 'free-photos');
    const sun = player.resources.sun ?? 0;
    const sunEarmarked = Math.max(
      0,
      ...targets(state, player)
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 2)
        .map((t) => t.need.sun),
    );
    const take = free || (sun >= 1 && (w.photo >= 1.25 || sun - 1 >= sunEarmarked));
    return { type: 'choose-photo', take };
  }

  // Trail end: claim the best park if it is worth the resources, else bank value.
  const claimable = claimableParks(state, player.index)
    .map((p) => ({ p, score: p.vp + bonusSynergy(player, p) }))
    .sort((a, b) => b.score - a.score);

  if (claimable.length > 0) {
    const top = claimable[0];
    const lastChance = state.season >= 3;
    const cost = bagTotal(effectiveCost(player, top.p));
    const worthIt = lastChance || top.score >= 2.5 || top.score / Math.max(1, cost) >= 0.6;
    if (worthIt) return { type: 'trail-end', option: 'claim-park', parkId: top.p.id };
  }

  // A photo beats one more sun whenever that sun would expire unspent.
  const free = player.gear.some((g) => g.effect.kind === 'free-photos');
  const sun = player.resources.sun ?? 0;
  const lastHikerOut = player.hikers.filter((h) => !h.finished).length === 0;
  if (free || (sun >= 1 && (lastHikerOut || sun >= 2 || w.photo >= 1.25))) {
    return { type: 'trail-end', option: 'photo' };
  }
  return { type: 'trail-end', option: 'sun' };
}

/** The single action this CPU wants to take next. */
export function aiAction(state: GameState): GameAction | null {
  if (state.phase === 'season-end') return { type: 'end-season' };
  if (state.phase !== 'playing') return null;
  const player = state.players[state.current];
  if (player.isHuman) return null;

  if (state.pending) return resolvePending(state);
  const gear = bestGearPurchase(state);
  if (gear) return gear;
  return bestMove(state);
}
