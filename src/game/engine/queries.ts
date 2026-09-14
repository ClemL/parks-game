import {
  COST_RESOURCES,
  type CampsiteDef,
  type GameState,
  type GearCard,
  type ParkCard,
} from '../types';
import { CAMPSITES, campsiteCapacity } from '../data/campsites';
import { SITES } from '../data/sites';
import {
  canClaim,
  chanceSeason,
  effectiveCost,
  gearCost,
  hasEffect,
  planPayment,
  wildCoverage,
} from './rules';

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
    return canClaim(state, player, p);
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



/** Campsites with a free tent slot. */
export function openCampsites(state: GameState): CampsiteDef[] {
  const capacity = campsiteCapacity(state.players.length);
  return state.campsites
    .filter((c) => c.tents.length < capacity)
    .map((c) => CAMPSITES.find((def) => def.id === c.id)!)
    .filter(Boolean);
}

/** True when this player could actually carry out the campsite's action. */
export function canUseCampsite(state: GameState, playerIndex: number, def: CampsiteDef): boolean {
  const player = state.players[playerIndex];
  const effect = def.effect;
  switch (effect.kind) {
    case 'trade':
      return COST_RESOURCES.every((r) => (player.resources[r] ?? 0) >= (effect.give[r] ?? 0));
    case 'trade-any':
      return COST_RESOURCES.some((r) => (player.resources[r] ?? 0) > 0);
    case 'outfitter':
      return (player.resources.sun ?? 0) >= (effect.cost.sun ?? 0);
    default:
      return true;
  }
}

/** Campsites this player could both reach and pay for. */
export function usableCampsites(state: GameState, playerIndex: number): CampsiteDef[] {
  return openCampsites(state).filter((def) => canUseCampsite(state, playerIndex, def));
}

export function campsiteDef(id: string): CampsiteDef {
  return CAMPSITES.find((c) => c.id === id)!;
}

/** True when this trail site carries a tent this season. */
export function hasTent(state: GameState, index: number): boolean {
  return state.tentSites.includes(index);
}

/** The park the bison is standing on, if the Wildlife expansion is in play. */
export function bisonPark(state: GameState): ParkCard | null {
  if (state.bison === null) return null;
  return state.parkRow[state.bison] ?? null;
}

/** Could this player pay for the top of the deck right now? */
export function canClaimChance(state: GameState, playerIndex: number): boolean {
  if (!chanceSeason(state)) return false;
  const park = state.parkDeck[0];
  if (!park) return false;
  const player = state.players[playerIndex];
  return planPayment(player, effectiveCost(player, park, state), wildCoverage(state)) !== null;
}
