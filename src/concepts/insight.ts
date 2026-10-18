import {
  applyAction,
  bonusCardById,
  canClaim,
  effectiveCost,
  photoValue,
  siteDef,
  wildCoverage,
  type MoveOption,
} from '../game/engine';
import { scoringView } from '../game/scoring';
import {
  COST_RESOURCES,
  RESOURCES,
  type DecisionKind,
  type GameState,
  type ParkCard,
  type Player,
  type Resource,
  type ResourceBag,
  type SiteKind,
  type SiteToken,
} from '../game/types';

/**
 * Read-only questions the redesigns ask of a game: what a move would pay, how
 * close each park is, what a player is showing. Nothing here changes the game;
 * a preview runs the real reducer on a copy.
 */

/** A site's effect in a few words, for a tile or a row that has no room for rules text. */
export const SITE_VERB: Record<SiteKind, string> = {
  trailhead: 'Start',
  'trail-end': 'Visit · reserve · gear',
  forest: 'Gain a tree',
  mountain: 'Gain a mountain',
  valley: 'Gain 2 water',
  basin: 'Gain 2 sun',
  waterfall: 'Water and sun',
  camera: 'Camera or bottle',
  'adv-wildcard': 'Trade for a wildcard',
  'adv-swap': 'Trade twice',
  'adv-park': 'Visit or reserve',
  'adv-copy': 'Copy a site for 1 water',
  'adv-memory': 'Photo for one of each',
  'adv-bison': 'Wildcard, move bison',
  'adv-lookout': 'Sun per hiker ahead',
  'adv-talk': 'Reserve the top card',
};

export interface MovePreview {
  option: MoveOption;
  kind: SiteKind;
  /** Change to the mover's resources, season token and weather included. */
  delta: ResourceBag;
  /** The season token waiting on the site, if any. */
  token: SiteToken;
  /** The decision the move opens, if it opens one. */
  decision: DecisionKind | null;
  /** Parks the mover cannot pay for now and could right after this move. */
  unlocks: ParkCard[];
  /** A tent site: the figures are for taking its action, and a campsite is the alternative. */
  tent: boolean;
  /** How many sites the hiker walks past without stopping. */
  passes: number;
}

/** Parks a player could put money towards: the open row plus their own reservations. */
export function goalParks(state: GameState, playerIndex: number): ParkCard[] {
  const player = state.players[playerIndex];
  const reservedElsewhere = new Set(
    state.players.flatMap((p) => (p.index === playerIndex ? [] : p.reserved.map((r) => r.id))),
  );
  const seen = new Set<string>();
  return [...player.reserved, ...state.parkRow.filter((p) => !reservedElsewhere.has(p.id))].filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

/** What a move would do, worked out by playing it on a copy of the game. */
export function previewMove(state: GameState, option: MoveOption): MovePreview {
  const mover = state.current;
  const before = state.players[mover];
  let next = applyAction(state, { type: 'move', hikerId: option.hikerId, to: option.to, useCampfire: option.useCampfire });
  // A tent site asks first whether to camp; preview the site's own action.
  const tent = next.pending?.player === mover && next.pending.kind === 'tent';
  if (tent) next = applyAction(next, { type: 'tent', option: 'site' });
  const after = next.players[mover];
  const delta: ResourceBag = {};
  for (const r of RESOURCES) {
    const change = (after.resources[r] ?? 0) - (before.resources[r] ?? 0);
    if (change !== 0) delta[r] = change;
  }
  const from = before.hikers.find((h) => h.id === option.hikerId)?.position ?? 0;
  const unlocks = goalParks(state, mover).filter(
    (park) => !canClaim(state, before, park) && canClaim(next, after, park),
  );
  return {
    option,
    kind: state.trail[option.to],
    delta,
    token: state.siteTokens[option.to],
    decision: next.pending?.player === mover ? next.pending.kind : null,
    unlocks,
    tent,
    passes: Math.max(0, option.to - from - 1),
  };
}

/** How each unit of a park's cost would be paid from what a player holds. */
export type PipState = 'held' | 'wild' | 'short';

export interface ParkProgress {
  park: ParkCard;
  /** One entry per resource the park asks for, after discounts. */
  pips: { resource: Resource; state: PipState }[];
  /** Units still uncovered once matching resources and wildcards are counted. */
  short: number;
  ready: boolean;
}

/**
 * How close a player is to a park. Matching resources pay first and wildcards
 * cover what is left, the way the engine pays; with an extra bag, the same
 * question is asked of the pack a move would leave behind.
 */
export function parkProgress(state: GameState, player: Player, park: ParkCard, extra: ResourceBag = {}): ParkProgress {
  const held = (r: Resource) => Math.max(0, (player.resources[r] ?? 0) + (extra[r] ?? 0));
  const probe: Player = { ...player, resources: Object.fromEntries(RESOURCES.map((r) => [r, held(r)])) };
  const cost = effectiveCost(probe, park, state);
  let wildUnits = held('wild') * wildCoverage(state);
  const pips: ParkProgress['pips'] = [];
  let short = 0;
  for (const r of COST_RESOURCES) {
    for (let i = 0; i < cost[r]; i++) {
      if (i < held(r)) pips.push({ resource: r, state: 'held' });
      else if (wildUnits > 0) {
        wildUnits -= 1;
        pips.push({ resource: r, state: 'wild' });
      } else {
        short += 1;
        pips.push({ resource: r, state: 'short' });
      }
    }
  }
  return { park, pips, short, ready: canClaim(state, probe, park) };
}

/** Points a player has on the table: parks and photos. Bonus cards stay hidden. */
export function showingVp(player: Player): number {
  return player.parks.reduce((sum, p) => sum + p.vp, 0) + player.photos * photoValue(player);
}

/** Each of a player's bonus cards, with what it would score if the game ended now. */
export function bonusStanding(state: GameState, player: Player) {
  const view = scoringView(player, state.cameraHolder === player.index);
  return player.bonusCards.map((id) => {
    const card = bonusCardById(id);
    return { card, vp: card.score(view) };
  });
}

/** The site under a move, by index, for labels. */
export function siteName(state: GameState, index: number): string {
  return siteDef(state.trail[index]).name;
}

/**
 * Who could visit a park on their next park action: anyone who can pay for it,
 * unless it is reserved, in which case only the player holding it.
 */
export function contenders(state: GameState, park: ParkCard): Player[] {
  const holder = state.players.find((p) => p.reserved.some((r) => r.id === park.id));
  return (holder ? [holder] : state.players).filter((p) => canClaim(state, p, park));
}

/** Park points a player banked in one season, from the season each park was visited in. */
export function seasonHaul(player: Player, season: number): number {
  return player.parks.reduce((sum, park, i) => sum + (player.claimedInSeason[i] === season ? park.vp : 0), 0);
}

/**
 * Where the log stood when a player last acted: entries after it happened
 * while they waited. -1 when they have not acted yet.
 */
export function lastOwnEntry(state: GameState, playerIndex: number): number {
  for (let i = state.log.length - 1; i >= 0; i--) {
    if (state.log[i].player === playerIndex) return i;
  }
  return -1;
}
