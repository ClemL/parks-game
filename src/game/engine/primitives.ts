import type { GameState, Player, Resource, ResourceBag } from '../types';
import { RESOURCES } from '../types';

/** Small shared helpers: bags of resources, logging and spending. */

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

export function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Resource names as they read in the log. */
export function label(r: Resource): string {
  return r === 'forest' ? 'tree' : r === 'wild' ? 'wildcard' : r;
}

export function spend(player: Player, resource: Resource, count = 1): boolean {
  if ((player.resources[resource] ?? 0) < count) return false;
  player.resources[resource] = (player.resources[resource] ?? 0) - count;
  return true;
}

export function log(state: GameState, player: number, text: string): void {
  state.log.push({ season: state.season, player, text });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}
