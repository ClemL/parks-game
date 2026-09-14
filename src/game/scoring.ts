import { BONUS_CARDS } from './data/bonuses';
import { FIRST_PLAYER_VP, GEAR_VP } from './data/sites';
import type { FinalScore, GameState, Player, PlayerScoringView } from './types';
import { RESOURCES } from './types';

function photoVpPer(player: Player): number {
  const card = player.gear.find((g) => g.effect.kind === 'photo-value');
  return card && card.effect.kind === 'photo-value' ? card.effect.vp : 1;
}

export function scoringView(player: Player, hasCamera: boolean): PlayerScoringView {
  return {
    parks: player.parks,
    photos: player.photos,
    gear: player.gear,
    resources: player.resources,
    campfires: player.campfires,
    bottles: player.bottles,
    reserved: player.reserved,
    hasCamera,
    claimedInSeason: player.claimedInSeason,
  };
}

export function scoreGame(state: GameState): FinalScore[] {
  const scores = state.players.map((player) => {
    const view = scoringView(player, state.cameraHolder === player.index);
    const parkVp = player.parks.reduce((sum, p) => sum + p.vp, 0);
    const photoVp = player.photos * photoVpPer(player);
    // Gear scores, so building an engine competes with claiming another park.
    const gearVp = player.gear.length * GEAR_VP;
    const bonusBreakdown = player.bonusCards.map((id) => {
      const card = BONUS_CARDS.find((b) => b.id === id)!;
      return { name: card.name, vp: card.score(view) };
    });
    const bonusVp = bonusBreakdown.reduce((sum, b) => sum + b.vp, 0);
    const firstPlayerVp = state.firstPlayer === player.index ? FIRST_PLAYER_VP : 0;
    // Leftover resources are worth 1 VP per 3 (house rule, see the rules panel).
    const leftover = RESOURCES.reduce((sum, r) => sum + (player.resources[r] ?? 0), 0);
    const leftoverVp = Math.floor(leftover / 3);
    return {
      player: player.index,
      parkVp,
      photoVp,
      gearVp,
      bonusVp,
      firstPlayerVp,
      leftoverVp,
      total: parkVp + photoVp + gearVp + bonusVp + firstPlayerVp + leftoverVp,
      bonusBreakdown,
    };
  });

  return scores.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const pa = state.players[a.player];
    const pb = state.players[b.player];
    if (pb.parks.length !== pa.parks.length) return pb.parks.length - pa.parks.length;
    return pb.photos - pa.photos;
  });
}
