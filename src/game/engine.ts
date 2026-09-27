/**
 * The transition layer: everything that advances the game. Setup, static rules
 * lookups and board queries live in ./engine/*, and this file re-exports them
 * so `import ... from './engine'` keeps working across the app.
 */
import {
  COST_RESOURCES,
  RESOURCES,
  type BottleKind,
  type GameAction,
  type GameState,
  type Player,
  type Resource,
  type ResourceBag,
  type SiteKind,
} from './types';
import { BOTTLES } from './data/sites';
import { SITES, TOKEN_LIMIT, gearDiscountsForPlayers, trailLength } from './data/sites';
import { campsiteCapacity } from './data/campsites';
import { scoreGame } from './scoring';
import { BONUS_CARDS } from './data/bonuses';
import { clone, label, log, spend } from './engine/primitives';
import {
  applyPayment,
  campfireAllowance,
  canAffordPhoto,
  chanceSeason,
  defaultPhotoPayment,
  effectiveCost,
  gainAtSite,
  gainResources,
  gearCost,
  planPayment,
  validPhotoPayment,
  wildCoverage,
} from './engine/rules';
import {
  affordableGear,
  bisonPark,
  campsiteDef,
  canReserveTop,
  claimableParks,
  copyableSites,
  hasTent,
  legalMoves,
  reservableParks,
  tokensOverLimit,
  usableCampsites,
} from './engine/queries';
import { buildTrail, GEAR_ROW_SIZE, seedSiteTokens, SEASONS, tentSitesFor } from './engine/setup';

export * from './engine/primitives';
export * from './engine/rules';
export * from './engine/queries';
export * from './engine/setup';

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
    case 'tent':
      resolveTent(next, action.option, action.campsiteId);
      break;
    case 'bison':
      resolveBison(next, action.give);
      break;
    case 'camera':
      resolveCamera(next, action.option);
      break;
    case 'camera-photo':
      resolveCameraPhoto(next, action.take, action.pay);
      break;
    case 'season-photo':
      resolveSeasonPhoto(next, action.take, action.pay);
      break;
    case 'discard':
      resolveDiscard(next, action.resources);
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

/** Bottles are a free action on your own turn, before or after moving. */
function useBottle(state: GameState, bottleId: string): void {
  const player = state.players[state.current];
  const bottle = player.bottles.find((b) => b.id === bottleId);
  if (!bottle || bottle.used) return;
  const def = BOTTLES[bottle.kind];
  const cost = def.cost.water ?? 0;
  // A flask takes freshly drawn water only, never what is already in the pack.
  if (player.waterThisTurn < cost) return;
  if (!spend(player, 'water', cost)) return;
  player.waterThisTurn -= cost;

  const gained: string[] = [];
  gainResources(player, def.gain, gained);
  bottle.used = true;
  log(state, player.index, `emptied a ${def.name}: 1 water became ${gained.join(', ')}`);
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

  // Walking on makes the last stop's water stale: a flask can only be filled
  // from the water this stop pays out.
  player.waterThisTurn = 0;
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

  // Nightfall: a tent site offers its own action or a night at a campsite -
  // but only ask when a campsite is actually open and payable.
  if (hasTent(state, to) && usableCampsites(state, player.index).length > 0) {
    state.pending = { player: player.index, hikerId, siteIndex: to, kind: 'tent' };
    log(state, player.index, `arrived at a tent site (${SITES[state.trail[to]].name})`);
    return;
  }

  resolveSite(state, player, to, hikerId, false);
}

function resolveTent(state: GameState, option: 'site' | 'camp', campsiteId?: string): void {
  const pending = state.pending;
  if (!pending || pending.kind !== 'tent') return;
  const player = state.players[pending.player];

  if (option === 'site') {
    state.pending = null;
    resolveSite(state, player, pending.siteIndex, pending.hikerId, false);
    return;
  }

  const campsite = state.campsites.find((c) => c.id === campsiteId);
  const def = campsite ? campsiteDef(campsite.id) : undefined;
  if (!campsite || !def || campsite.tents.length >= campsiteCapacity(state.players.length)) return;

  campsite.tents.push(player.index);
  const gained: string[] = [];
  let ok = true;

  switch (def.effect.kind) {
    case 'gain':
      gainResources(player, def.effect.gain, gained);
      break;
    case 'trade': {
      for (const r of COST_RESOURCES) {
        const need = def.effect.give[r] ?? 0;
        if (need > 0 && (player.resources[r] ?? 0) < need) ok = false;
      }
      if (ok) {
        for (const r of COST_RESOURCES) spend(player, r, def.effect.give[r] ?? 0);
        gainResources(player, def.effect.gain, gained);
      }
      break;
    }
    case 'trade-any': {
      // Hand over whichever resource the player has most of.
      const give = [...COST_RESOURCES]
        .filter((r) => (player.resources[r] ?? 0) > 0)
        .sort((a, b) => (player.resources[b] ?? 0) - (player.resources[a] ?? 0))[0];
      if (give) {
        spend(player, give);
        gained.push(`traded 1 ${label(give)}`);
        gainResources(player, def.effect.gain, gained);
      } else {
        ok = false;
      }
      break;
    }
    case 'bottle': {
      for (let i = 0; i < def.effect.count; i++) {
        const kind: BottleKind = state.bottleDeck.shift() ?? 'sun-flask';
        player.bottles.push({
          id: `p${player.index}c${player.bottles.length}s${state.season}`,
          kind,
          used: false,
        });
        gained.push(BOTTLES[kind].name);
      }
      if (def.effect.gain) gainResources(player, def.effect.gain, gained);
      break;
    }
    case 'outfitter': {
      const cost = def.effect.cost.sun ?? 0;
      if ((player.resources.sun ?? 0) < cost) {
        ok = false;
        break;
      }
      spend(player, 'sun', cost);
      // Send the whole gear row to the bottom and deal a fresh one.
      state.gearDeck.push(...state.gearRow);
      state.gearRow = state.gearDeck.splice(0, GEAR_ROW_SIZE);
      const free = state.gearRow.find((g) => !player.gear.some((o) => o.id === g.id));
      if (free) {
        player.gear.push(free);
        if (free.effect.kind === 'extra-bottle') {
          player.bottles.push({
            id: `p${player.index}g${player.bottles.length}`,
            kind: free.effect.bottle,
            used: false,
          });
        }
        if (free.effect.kind === 'season-campfire') player.campfires += 1;
        const index = state.gearRow.findIndex((g) => g.id === free.id);
        const replacement = state.gearDeck.shift();
        if (replacement) state.gearRow[index] = replacement;
        else state.gearRow.splice(index, 1);
        gained.push(`${free.name} for free`);
      }
      break;
    }
  }

  log(
    state,
    player.index,
    ok
      ? `camped at ${def.name}${gained.length ? ` and gained ${gained.join(', ')}` : ''}`
      : `camped at ${def.name} but could not pay for it`,
  );
  finishDecision(state);
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
  if (site.gain) gainAtSite(state, player, site.gain, gained);

  // Wildlife expansion sites resolve immediately, with no decision to make.
  switch (kind) {
    case 'adv-memory':
      if (player.photos > 0) {
        player.photos -= 1;
        gainAtSite(state, player, { sun: 1, water: 1, forest: 1, mountain: 1 }, gained);
        gained.push('(gave up a photo)');
      } else {
        gained.push('no photo to give up');
      }
      break;
    case 'adv-bison': {
      // Trade the resource you hold most of for a wildcard, then move the bison.
      const give = [...COST_RESOURCES]
        .filter((r) => (player.resources[r] ?? 0) > 0)
        .sort((a, b) => (player.resources[b] ?? 0) - (player.resources[a] ?? 0))[0];
      if (give) {
        spend(player, give);
        gainAtSite(state, player, { wild: 1 }, gained);
        gained.push(`for 1 ${label(give)}`);
      } else {
        gained.push('nothing to trade the bison');
      }
      if (state.bison !== null && state.parkRow.length > 0) {
        state.bison = (state.bison + 1) % state.parkRow.length;
        gained.push('and moved the bison on');
      }
      break;
    }
    case 'adv-lookout': {
      const ahead = state.players.reduce(
        (sum, other) =>
          sum + other.hikers.filter((h) => !h.finished && h.position > index).length,
        0,
      );
      if (ahead > 0) gainAtSite(state, player, { sun: ahead }, gained);
      else gained.push('nobody ahead to spot');
      break;
    }
    case 'adv-talk': {
      const park = state.parkDeck.shift();
      if (park) {
        player.reserved.push(park);
        takeFirstPlayerToken(state, player);
        gained.push(`reserved ${park.name} from the deck`);
      }
      break;
    }
    default:
      break;
  }

  // The season token waiting on this site goes to whoever arrives first. A
  // copied action does not reach for it.
  if (!copied) {
    const token = state.siteTokens[index];
    if (token) {
      gainAtSite(state, player, { [token]: 1 }, gained);
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
      closeTurn(state, player, index, hikerId);
    }
    return;
  }

  closeTurn(state, player, index, hikerId);
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
        canReserveTop(state)
      );
    default:
      return true;
  }
}

function finishDecision(state: GameState): void {
  const pending = state.pending;
  if (!pending) return;
  const player = state.players[pending.player];
  state.pending = null;
  closeTurn(state, player, pending.siteIndex, pending.hikerId);
}

/**
 * The end of a turn. Nobody may finish one holding more than the token limit,
 * so a player over it chooses what to hand back before play moves on.
 */
function closeTurn(state: GameState, player: Player, siteIndex: number, hikerId: string): void {
  if (tokensOverLimit(state, player.index) > 0) {
    state.pending = { player: player.index, hikerId, siteIndex, kind: 'discard' };
    return;
  }
  endTurn(state);
}

/** The tokens a player over the limit hands back, as they chose them. */
function resolveDiscard(state: GameState, resources: ResourceBag): void {
  const pending = state.pending;
  if (!pending || pending.kind !== 'discard') return;
  const player = state.players[pending.player];
  const over = tokensOverLimit(state, player.index);
  let total = 0;
  for (const r of RESOURCES) {
    const n = resources[r] ?? 0;
    if (n < 0 || !Number.isInteger(n) || n > (player.resources[r] ?? 0)) return;
    total += n;
  }
  if (total !== over) return;
  const returned: string[] = [];
  for (const r of RESOURCES) {
    const n = resources[r] ?? 0;
    if (n === 0) continue;
    player.resources[r] = (player.resources[r] ?? 0) - n;
    returned.push(`${n} ${label(r)}`);
  }
  log(state, player.index, `was over the ${TOKEN_LIMIT}-token limit and returned ${returned.join(', ')}`);
  state.pending = null;
  endTurn(state);
}

/**
 * A sensible discard for a player who does not choose: sun first, then the
 * most plentiful park resource, and a wildcard only when nothing else is left.
 */
export function defaultDiscard(state: GameState, playerIndex: number): ResourceBag {
  const player = state.players[playerIndex];
  const left = { ...player.resources };
  const out: ResourceBag = {};
  for (let n = tokensOverLimit(state, playerIndex); n > 0; n--) {
    const pick =
      [...COST_RESOURCES]
        .filter((r) => (left[r] ?? 0) > 0)
        .sort((a, b) => {
          if (a === 'sun') return -1;
          if (b === 'sun') return 1;
          return (left[b] ?? 0) - (left[a] ?? 0);
        })[0] ?? 'wild';
    left[pick] = (left[pick] ?? 0) - 1;
    out[pick] = (out[pick] ?? 0) + 1;
  }
  return out;
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

function resolveCameraPhoto(state: GameState, take: boolean, pay?: ResourceBag): void {
  if (!state.pending || state.pending.stage !== 'take-photo') return;
  const player = state.players[state.pending.player];
  if (take && !takePhoto(state, player, pay)) return;
  finishDecision(state);
}

/** The camera holder's closing photo, once every hiker is home. */
function resolveSeasonPhoto(state: GameState, take: boolean, pay?: ResourceBag): void {
  if (!state.pending || state.pending.kind !== 'season-photo') return;
  const player = state.players[state.pending.player];
  if (take && !takePhoto(state, player, pay)) return;
  if (!take) log(state, player.index, 'put the camera away without a closing photo');
  state.pending = null;
  endTurn(state);
}

/** Photos take tokens of any kind: the ones chosen, or a sensible mix. */
function takePhoto(state: GameState, player: Player, pay?: ResourceBag): boolean {
  const spendBag = pay ?? defaultPhotoPayment(state, player.index);
  if (!spendBag || !validPhotoPayment(state, player.index, spendBag)) return false;
  const paid: string[] = [];
  for (const r of RESOURCES) {
    const n = spendBag[r] ?? 0;
    if (n === 0) continue;
    player.resources[r] = (player.resources[r] ?? 0) - n;
    paid.push(`${n} ${label(r)}`);
  }
  player.photos += 1;
  log(state, player.index, `took a photo for ${paid.join(', ')}`);
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
    case 'chance-park':
      claimChancePark(state, player);
      break;
    case 'reserve-park':
      reservePark(state, player, action.parkId);
      break;
    case 'reserve-top':
      reserveTop(state, player);
      break;
    default:
      log(state, player.index, 'passed at the Ranger Station');
      break;
  }
  if (bisonInterrupted(state)) return;
  finishDecision(state);
}

/* --------------------------------------------------------------- trail end */



/**
 * Visiting the bison's park offers a trade, then the bison moves one park to
 * the right; when it wraps around, a gear card is replaced.
 */
function moveBisonOn(state: GameState, player: Player): void {
  if (state.bison === null) return;
  const next = state.bison + 1;
  if (next >= Math.max(1, state.parkRow.length)) {
    state.bison = 0;
    const replaced = state.gearRow[0];
    if (replaced) {
      state.gearDeck.push(replaced);
      const fresh = state.gearDeck.shift();
      if (fresh) state.gearRow[0] = fresh;
      log(state, player.index, `the bison looped back and refreshed the gear row`);
    }
  } else {
    state.bison = next;
  }
}

function resolveBison(state: GameState, give?: Resource): void {
  const pending = state.pending;
  if (!pending || pending.kind !== 'bison') return;
  const player = state.players[pending.player];

  if (give && COST_RESOURCES.includes(give) && (player.resources[give] ?? 0) > 0) {
    spend(player, give);
    const gained: string[] = [];
    gainResources(player, { wild: 1 }, gained);
    log(state, player.index, `traded 1 ${label(give)} to the bison for ${gained.join(', ')}`);
  }
  moveBisonOn(state, player);

  // A bison trade interrupts the stop that triggered it; carry on where we left off.
  const resume = pending.resume ?? null;
  state.pending = resume;
  if (!resume) closeTurn(state, player, pending.siteIndex, pending.hikerId);
}

function claimPark(state: GameState, player: Player, parkId?: string): boolean {
  const park = claimableParks(state, player.index).find((p) => p.id === parkId);
  if (!park) return false;
  const plan = planPayment(player, effectiveCost(player, park, state), wildCoverage(state));
  if (!plan) return false;
  const onBison = bisonPark(state)?.id === park.id;

  applyPayment(player, plan);
  player.parks.push(park);
  player.claimedInSeason.push(state.season);

  const reservedIndex = player.reserved.findIndex((p) => p.id === park.id);
  if (reservedIndex >= 0) player.reserved.splice(reservedIndex, 1);
  else removeFromRow(state, park.id);

  const wild = plan.wild > 0 ? ` (${plan.wild} wildcard)` : '';
  log(state, player.index, `visited ${park.name} for ${park.vp} VP${wild}`);

  // Wildlife: the bison was standing here, so its trade is on offer.
  if (onBison) {
    state.pending = {
      player: player.index,
      hikerId: state.pending?.hikerId ?? '',
      siteIndex: state.pending?.siteIndex ?? 0,
      kind: 'bison',
      resume: null,
    };
  }
  return true;
}

/** Claim the unseen top card of the park deck during a Season of Chance. */
function claimChancePark(state: GameState, player: Player): boolean {
  if (!chanceSeason(state)) return false;
  const park = state.parkDeck[0];
  if (!park) return false;
  const plan = planPayment(player, effectiveCost(player, park, state), wildCoverage(state));
  if (!plan) return false;
  state.parkDeck.shift();
  applyPayment(player, plan);
  player.parks.push(park);
  player.claimedInSeason.push(state.season);
  log(state, player.index, `took a chance on the deck and visited ${park.name} for ${park.vp} VP`);
  return true;
}



/** The first reservation of a season also takes the first player token. */
function takeFirstPlayerToken(state: GameState, player: Player): boolean {
  if (state.firstPlayerTokenClaimed) return false;
  state.firstPlayerTokenClaimed = true;
  state.firstPlayer = player.index;
  return true;
}

function reservePark(state: GameState, player: Player, parkId?: string): boolean {
  const park = reservableParks(state).find((p) => p.id === parkId);
  if (!park) return false;
  player.reserved.push(park);
  removeFromRow(state, park.id);
  const note = takeFirstPlayerToken(state, player) ? ' and took the first player token' : '';
  log(state, player.index, `reserved ${park.name}${note}`);
  return true;
}

/** The blind reserve house rule: the top card of the deck, sight unseen. */
function reserveTop(state: GameState, player: Player): boolean {
  if (!canReserveTop(state)) return false;
  const park = state.parkDeck.shift();
  if (!park) return false;
  player.reserved.push(park);
  const note = takeFirstPlayerToken(state, player) ? ' and took the first player token' : '';
  log(state, player.index, `reserved the top card of the park deck${note}`);
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
    case 'chance-park':
      claimChancePark(state, player);
      break;
    case 'reserve-park':
      reservePark(state, player, action.parkId);
      break;
    case 'reserve-top':
      reserveTop(state, player);
      break;
    case 'buy-gear':
      buyGear(state, player, action.gearId);
      break;
    default:
      log(state, player.index, 'passed at the Trail End');
      break;
  }

  if (bisonInterrupted(state)) return;
  finishDecision(state);
}

/** True when a bison trade interrupted the action we were resolving. */
function bisonInterrupted(state: GameState): boolean {
  return state.pending?.kind === 'bison';
}

function removeFromRow(state: GameState, parkId: string): void {
  const index = state.parkRow.findIndex((p) => p.id === parkId);
  if (index < 0) return;
  const replacement = state.parkDeck.shift();
  if (replacement) state.parkRow[index] = replacement;
  else state.parkRow.splice(index, 1);
}

function playerDone(player: Player): boolean {
  return player.hikers.every((h) => h.finished);
}

function endTurn(state: GameState): void {
  if (state.players.every(playerDone)) {
    // Whoever holds the camera may take one last photo before the season closes.
    const holder = state.cameraHolder;
    if (!state.seasonPhotoOffered && holder !== null && canAffordPhoto(state, holder)) {
      state.seasonPhotoOffered = true;
      state.current = holder;
      state.pending = { player: holder, hikerId: '', siteIndex: state.trail.length - 1, kind: 'season-photo' };
      log(state, holder, 'holds the camera as the season ends');
      return;
    }
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

  const [trail, rng] = buildTrail(state.season, state.advancedOrder, state.rng, state.players.length);
  const [tokens, rng2] = seedSiteTokens(trail, rng);
  state.trail = trail;
  state.siteTokens = tokens;
  state.rng = rng2;
  state.gearDiscountsLeft = gearDiscountsForPlayers(state.players.length);
  state.firstPlayerTokenClaimed = false;
  state.seasonPhotoOffered = false;
  state.seasonCard = state.seasonDeck.find((c) => c.season === state.season) ?? null;
  state.tentSites = state.expansions.nightfall ? tentSitesFor(trail) : [];
  for (const campsite of state.campsites) campsite.tents = [];

  for (const player of state.players) {
    // Resources carry over between seasons; the token limit is checked at the
    // end of each player's next turn.
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
    // Season income is not water drawn on a turn, and the season's first
    // player is never handed their turn by endTurn, so clear the lot here.
    player.waterThisTurn = 0;
  }

  state.current = state.firstPlayer;
  state.phase = 'playing';
  log(
    state,
    -1,
    `Season ${state.season} begins: ${trailLength(state.season, state.players.length)} sites, ${state.season} advanced site${
      state.season === 1 ? '' : 's'
    }${state.seasonCard ? `, ${state.seasonCard.name} - ${state.seasonCard.text}` : ''}. ${
      state.players[state.firstPlayer].name
    } leads.`,
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
