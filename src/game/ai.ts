import {
  affordableGear,
  canClaimChance,
  copyableSites,
  hasTent,
  usableCampsites,
  tokenCount,
  wildCoverage,
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
import { FIRST_PLAYER_VP, GEAR_VP, TOKEN_LIMIT } from './data/sites';
import { scoringView } from './scoring';
import type {
  AiPersonality,
  CampsiteDef,
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
  trade: number;
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
    trade: 1.0,
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
    trade: 0.9,
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
    trade: 1.1,
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
    const cost = effectiveCost(player, park, state);
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
  // Sun keeps between seasons now, so it is worth what it can buy - gear,
  // photos and park costs - with no expiry discount.
  values.sun = values.sun * 0.9 + w.sunBias * 0.8;
  // Near the twelve-token limit, another token is worth little: it will be
  // discarded at the end of the turn.
  const room = TOKEN_LIMIT - tokenCount(player);
  if (room <= 3) {
    const squeeze = Math.max(0.12, room / 4);
    for (const r of RESOURCES) values[r] *= squeeze;
  }
  // A wildcard pays for whatever is scarcest - and covers two resources once
  // Nightfall is in play, so it is worth roughly twice as much then.
  values.wild = Math.max(...COST_RESOURCES.map((r) => values[r])) * 1.05 * wildCoverage(state);
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
    (other) => other.index !== player.index && canClaimSoon(state, other, park),
  ).length;
  return Math.min(1, 0.3 + 0.22 * contenders);
}

/** An opponent is a threat to a park when they are one resource away from it. */
function canClaimSoon(state: GameState, other: Player, park: ParkCard): boolean {
  const cost = effectiveCost(other, park, state);
  let missing = 0;
  for (const r of COST_RESOURCES) missing += Math.max(0, cost[r] - (other.resources[r] ?? 0));
  return missing - (other.resources.wild ?? 0) * wildCoverage(state) <= 1;
}

/** What a night at each open campsite would be worth, best first. */
function campsiteValue(
  player: Player,
  def: CampsiteDef,
  values: Record<Resource, number>,
): number {
  const w = weightsFor(player);
  const effect = def.effect;
  switch (effect.kind) {
    case 'gain':
      return RESOURCES.reduce((sum, r) => sum + values[r] * (effect.gain[r] ?? 0), 0);
    case 'trade': {
      const affordable = COST_RESOURCES.every(
        (r) => (player.resources[r] ?? 0) >= (effect.give[r] ?? 0),
      );
      if (!affordable) return 0;
      const out = RESOURCES.reduce((sum, r) => sum + values[r] * (effect.gain[r] ?? 0), 0);
      const paid = COST_RESOURCES.reduce((sum, r) => sum + values[r] * (effect.give[r] ?? 0), 0);
      return out - paid;
    }
    case 'trade-any': {
      const held = COST_RESOURCES.filter((r) => (player.resources[r] ?? 0) > 0);
      if (held.length === 0) return 0;
      const worst = Math.min(...held.map((r) => values[r]));
      const out = RESOURCES.reduce((sum, r) => sum + values[r] * (effect.gain[r] ?? 0), 0);
      return out - worst;
    }
    case 'bottle': {
      const extra = effect.gain
        ? RESOURCES.reduce((sum, r) => sum + values[r] * (effect.gain![r] ?? 0), 0)
        : 0;
      return w.bottle * effect.count * 0.9 + extra;
    }
    case 'outfitter': {
      const cost = (effect.cost.sun ?? 0) * values.sun;
      if ((player.resources.sun ?? 0) < (effect.cost.sun ?? 0)) return 0;
      // A free gear card, roughly the value of the best one in the deck.
      return 2.6 * w.gearAppetite - cost;
    }
    default:
      return 0;
  }
}

function bestCampsite(
  state: GameState,
  player: Player,
  values: Record<Resource, number>,
): { def: CampsiteDef; score: number } | null {
  const ranked = usableCampsites(state, player.index)
    .map((def) => ({ def, score: campsiteValue(player, def, values) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0] ?? null;
}

/** Value of the best park or gear action, wherever it is offered. */
function bestParkOrGearValue(
  state: GameState,
  player: Player,
  values: Record<Resource, number>,
): number {
  const w = weightsFor(player);
  const options: number[] = [0];

  const claim = claimableParks(state, player.index)
    .map((p) => (p.vp + bonusSynergy(state, player, p)) * claimUrgency(state, player, p))
    .sort((a, b) => b - a)[0];
  if (claim !== undefined) options.push(claim * w.parkClaim * 0.55);

  if (canClaimChance(state, player.index)) {
    // An unseen park from the deck, priced at the average card.
    options.push(3.6 * w.parkClaim * 0.5);
  }

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

  return Math.max(...options);
}

function bestTrailEndValue(state: GameState, player: Player, values: Record<Resource, number>): number {
  const w = weightsFor(player);
  const options: number[] = [bestParkOrGearValue(state, player, values)];
  if (canAffordPhoto(state, player.index)) options.push(w.photo * photoValue(player) * 0.6);
  options.push(values.sun * 0.5);
  return Math.max(...options);
}

function siteValue(
  state: GameState,
  player: Player,
  index: number,
  values: Record<Resource, number>,
  /** Set while pricing a copy, so an Overlook never prices itself. */
  noCopy = false,
): number {
  const kind = state.trail[index];
  if (noCopy && (kind === 'adv-copy' || kind === 'trail-end')) return 0;
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
    case 'camera': {
      const holdsCamera = state.cameraHolder === player.index;
      const photoNow = canAffordPhoto(state, player.index) ? w.photo * photoValue(player) * 0.8 : 0;
      // Taking the camera is worth more when someone else is holding it.
      const grab = w.camera * (state.cameraHolder === null ? 0.7 : holdsCamera ? 0.25 : 1);
      value += Math.max(grab + photoNow, w.bottle);
      break;
    }
    case 'adv-wildcard': {
      // Trade the least useful resource for a wildcard.
      const worst = Math.min(
        ...COST_RESOURCES.filter((r) => (player.resources[r] ?? 0) > 0).map((r) => values[r]),
      );
      value += Number.isFinite(worst) ? Math.max(0, values.wild - worst) * w.trade : 0;
      break;
    }
    case 'adv-swap': {
      const held = COST_RESOURCES.filter((r) => (player.resources[r] ?? 0) > 0);
      if (held.length > 0) {
        const worst = Math.min(...held.map((r) => values[r]));
        const best = Math.max(...COST_RESOURCES.map((r) => values[r]));
        // Two trades, and the second is usually worth less than the first.
        value += Math.max(0, best - worst) * 1.6 * w.trade;
      }
      break;
    }
    case 'adv-park':
      // The Ranger Station is the Trail End's park and gear menu, mid-trail,
      // and it does not retire the hiker.
      value += bestParkOrGearValue(state, player, values);
      break;
    case 'adv-copy': {
      const best = copyableSites(state, player.index)
        .map((i) => siteValue(state, player, i, values, true))
        .sort((a, b) => b - a)[0];
      value += best !== undefined ? Math.max(0, best - values.water) : 0;
      break;
    }
    case 'adv-memory':
      // Trading a photo for one of everything: only worth it with a photo spare.
      value +=
        player.photos > 0
          ? COST_RESOURCES.reduce((sum, r) => sum + values[r], 0) - photoValue(player) * 1.1
          : 0;
      break;
    case 'adv-bison': {
      const held = COST_RESOURCES.filter((r) => (player.resources[r] ?? 0) > 0);
      const worst = held.length > 0 ? Math.min(...held.map((r) => values[r])) : 0;
      value += held.length > 0 ? Math.max(0, values.wild - worst) + 0.2 : 0.2;
      break;
    }
    case 'adv-lookout': {
      const ahead = state.players.reduce(
        (sum, other) => sum + other.hikers.filter((h) => !h.finished && h.position > index).length,
        0,
      );
      value += values.sun * ahead;
      break;
    }
    case 'adv-talk':
      // An unseen park plus, often, the first player token.
      value += 2.2 + (state.firstPlayerTokenClaimed ? 0 : FIRST_PLAYER_VP + 1.2);
      break;
    case 'trail-end':
      value += bestTrailEndValue(state, player, values);
      break;
    default:
      break;
  }

  // Nightfall: a tent site is worth the better of its own action and a campsite.
  if (hasTent(state, index) && !noCopy) {
    const camp = bestCampsite(state, player, values);
    if (camp && camp.score > value) value = camp.score;
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
    if (option.useCampfire) {
      // A campfire spent before your first hiker comes home is refunded then.
      score -= w.campfireCost * (player.campfireRelit ? 1 : 0.45);
    }
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
  // Every gear card is worth points on its own now, on top of its effect.
  const keepValue = GEAR_VP * 0.55;
  switch (card.effect.kind) {
    case 'bonus-on-gain':
      return keepValue + values[card.effect.resource] * 0.9 * seasonsLeft * 0.45;
    case 'season-income':
      return keepValue + bagTotal(card.effect.gain) * 0.8 * seasonsLeft * 0.4;
    case 'season-campfire':
      return keepValue + seasonsLeft * 0.4;
    case 'cheap-photos':
      return keepValue + w.photo * seasonsLeft * 0.45;
    case 'photo-value':
      return keepValue + (player.photos + seasonsLeft) * 0.55 * (w.photo / 1.2);
    case 'ignore-occupancy':
      return keepValue + (1.0 + w.block) * seasonsLeft * 0.42;
    case 'extra-bottle':
      return keepValue + w.bottle * seasonsLeft * 0.45;
    case 'park-discount':
      return keepValue + card.effect.amount * seasonsLeft * 0.7;
    default:
      return keepValue;
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

/** At a tent site, camp only when a campsite beats the site's own action. */
function tentDecision(state: GameState, player: Player): GameAction {
  const pending = state.pending!;
  const values = resourceValues(state, player);
  const camp = bestCampsite(state, player, values);
  // Price the site itself without the tent option, so the two can be compared.
  const own = siteValue(state, player, pending.siteIndex, values, true);
  return camp && camp.score > own
    ? { type: 'tent', option: 'camp', campsiteId: camp.def.id }
    : { type: 'tent', option: 'site' };
}

/** The bison's trade: hand over the least useful resource for a wildcard. */
function bisonDecision(state: GameState, player: Player): GameAction {
  const values = resourceValues(state, player);
  const held = COST_RESOURCES.filter((r) => (player.resources[r] ?? 0) > 0);
  if (held.length === 0) return { type: 'bison' };
  const worst = held.reduce((a, r) => (values[r] < values[a] ? r : a), held[0]);
  return values.wild > values[worst] ? { type: 'bison', give: worst } : { type: 'bison' };
}

/** Trade the least useful resource for a wildcard, or pass. */
function wildSwapDecision(state: GameState, player: Player): GameAction {
  const values = resourceValues(state, player);
  const held = COST_RESOURCES.filter((r) => (player.resources[r] ?? 0) > 0);
  if (held.length === 0) return { type: 'swap-done' };
  const worst = held.reduce((a, r) => (values[r] < values[a] ? r : a), held[0]);
  return values.wild > values[worst] ? { type: 'swap-give', resource: worst } : { type: 'swap-done' };
}

/** At a Trading Post, hand over the least useful resource for the most useful. */
function tokenSwapDecision(state: GameState, player: Player): GameAction {
  const pending = state.pending!;
  const values = resourceValues(state, player);

  if (pending.stage === 'get') {
    const give = pending.give!;
    const best = COST_RESOURCES.filter((r) => r !== give).reduce(
      (a, r) => (values[r] > values[a] ? r : a),
      COST_RESOURCES.find((r) => r !== give)!,
    );
    return { type: 'swap-get', resource: best };
  }

  const held = COST_RESOURCES.filter((r) => (player.resources[r] ?? 0) > 0);
  if (held.length === 0) return { type: 'swap-done' };
  const worst = held.reduce((a, r) => (values[r] < values[a] ? r : a), held[0]);
  const best = Math.max(...COST_RESOURCES.filter((r) => r !== worst).map((r) => values[r]));
  return best > values[worst] * 1.1
    ? { type: 'swap-give', resource: worst }
    : { type: 'swap-done' };
}

/** At an Overlook, copy the most valuable occupied site if it beats the water. */
function copyDecision(state: GameState, player: Player): GameAction {
  const values = resourceValues(state, player);
  const ranked = copyableSites(state, player.index)
    .map((index) => ({ index, score: siteValue(state, player, index, values, true) }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  return top && top.score > values.water
    ? { type: 'copy-site', siteIndex: top.index }
    : { type: 'copy-skip' };
}

/** The Ranger Station: the Trail End's park and gear menu, mid-trail. */
function parkOrGearDecision(state: GameState, player: Player): GameAction {
  const choice = parkOrGearChoice(state, player);
  return choice ? { ...choice, type: 'park-or-gear' } : { type: 'park-or-gear', option: 'skip' };
}

/** Shared ranking of the claim / reserve / buy options. */
function parkOrGearChoice(
  state: GameState,
  player: Player,
): {
  option: 'claim-park' | 'reserve-park' | 'buy-gear' | 'chance-park';
  parkId?: string;
  gearId?: string;
} | null {
  const w = weightsFor(player);
  const values = resourceValues(state, player);
  const options: {
    score: number;
    choice: {
      option: 'claim-park' | 'reserve-park' | 'buy-gear' | 'chance-park';
      parkId?: string;
      gearId?: string;
    };
  }[] = [];

  const claim = claimableParks(state, player.index)
    .map((p) => ({ p, score: p.vp + bonusSynergy(state, player, p) }))
    .sort((a, b) => b.score - a.score)[0];
  if (claim) {
    const lastChance = state.season >= 3;
    const cost = bagTotal(effectiveCost(player, claim.p, state));
    if (lastChance || claim.score >= 2.5 || claim.score / Math.max(1, cost) >= 0.6) {
      options.push({ score: claim.score * w.parkClaim * 0.5, choice: { option: 'claim-park', parkId: claim.p.id } });
    }
  }

  const reserve = reservableParks(state)
    .map((p) => ({ p, score: p.vp + bonusSynergy(state, player, p) }))
    .sort((a, b) => b.score - a.score)[0];
  if (reserve && player.reserved.length < 2 && state.season < 4) {
    const prize = state.firstPlayerTokenClaimed ? 0 : FIRST_PLAYER_VP + 1.2;
    options.push({
      score: (reserve.score * 0.42 + prize) * (w.reserve / 2.3),
      choice: { option: 'reserve-park', parkId: reserve.p.id },
    });
  }

  const gear = affordableGear(state, player.index)
    .map((g) => ({ g, score: gearValue(state, player, g, values) * w.gearAppetite - gearCost(state, g) * 0.5 }))
    .sort((a, b) => b.score - a.score)[0];
  if (gear && gear.score > 0.5) {
    options.push({ score: gear.score, choice: { option: 'buy-gear', gearId: gear.g.id } });
  }

  // A Season of Chance park is worth taking when nothing on the board is better.
  if (canClaimChance(state, player.index)) {
    options.push({ score: 3.6 * w.parkClaim * 0.42, choice: { option: 'chance-park' } });
  }

  options.sort((a, b) => b.score - a.score);
  return options[0]?.choice ?? null;
}

function trailEndDecision(state: GameState, player: Player): GameAction {
  const w = weightsFor(player);
  const values = resourceValues(state, player);
  const options: { action: GameAction; score: number }[] = [];

  const parkOrGear = parkOrGearChoice(state, player);
  if (parkOrGear) {
    options.push({
      action: { ...parkOrGear, type: 'trail-end' },
      score: parkOrGearValueOf(state, player, values, parkOrGear),
    });
  }

  if (canAffordPhoto(state, player.index)) {
    options.push({
      action: { type: 'trail-end', option: 'photo' },
      score: w.photo * photoValue(player) * 0.6,
    });
  }

  options.push({ action: { type: 'trail-end', option: 'rest' }, score: values.sun * 0.5 });
  options.sort((a, b) => b.score - a.score);
  return options[0].action;
}

/** Score a specific park/gear choice so it can compete with photo and rest. */
function parkOrGearValueOf(
  state: GameState,
  player: Player,
  values: Record<Resource, number>,
  choice: {
    option: 'claim-park' | 'reserve-park' | 'buy-gear' | 'chance-park';
    parkId?: string;
    gearId?: string;
  },
): number {
  const w = weightsFor(player);
  if (choice.option === 'claim-park') {
    const park = claimableParks(state, player.index).find((p) => p.id === choice.parkId);
    return park ? (park.vp + bonusSynergy(state, player, park)) * w.parkClaim * 0.5 : 0;
  }
  if (choice.option === 'chance-park') return 3.6 * w.parkClaim * 0.42;
  if (choice.option === 'reserve-park') {
    const park = reservableParks(state).find((p) => p.id === choice.parkId);
    const prize = state.firstPlayerTokenClaimed ? 0 : FIRST_PLAYER_VP + 1.2;
    return park ? ((park.vp + bonusSynergy(state, player, park)) * 0.42 + prize) * (w.reserve / 2.3) : 0;
  }
  const card = affordableGear(state, player.index).find((g) => g.id === choice.gearId);
  return card ? gearValue(state, player, card, values) * w.gearAppetite - gearCost(state, card) * 0.5 : 0;
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
    switch (state.pending.kind) {
      case 'tent':
        return tentDecision(state, player);
      case 'bison':
        return bisonDecision(state, player);
      case 'wild-swap':
        return wildSwapDecision(state, player);
      case 'token-swap':
        return tokenSwapDecision(state, player);
      case 'copy-site':
        return copyDecision(state, player);
      case 'park-or-gear':
        return parkOrGearDecision(state, player);
      default:
        break;
    }
    if (state.pending.stage === 'take-photo') {
      // Shoot unless the sun is spoken for by a park in reach; a full pack is
      // a reason to shoot, since the overflow would be discarded anyway.
      const w = weightsFor(player);
      const earmark = Math.max(
        0,
        ...targets(state, player)
          .sort((a, b) => b.priority - a.priority)
          .slice(0, 2)
          .map((t) => t.need.sun),
      );
      const left = (player.resources.sun ?? 0) - photoCost(state, player.index);
      const full = tokenCount(player) >= TOKEN_LIMIT - 1;
      return { type: 'camera-photo', take: left >= earmark || full || w.photo >= 2 };
    }
    if (state.pending.kind === 'camera') return cameraDecision(state, player);
    return trailEndDecision(state, player);
  }

  const bottle = bottleAction(state);
  if (bottle) return bottle;
  return bestMove(state);
}
