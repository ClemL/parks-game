import type { GameState } from '../game/types';
import { RESOURCES } from '../game/types';
import { bottleDef, campfireAllowance, tokenCount, usableBottles } from '../game/engine';
import { GEAR_VP, TOKEN_LIMIT } from '../game/data/sites';
import { ChipCount, ResourceChip } from './Bits';
import { useInfo } from './InfoSheet';
import { useCountFlashes } from '../hooks/useFlash';

/**
 * Everything you are carrying, on one line at the top of the board: resources,
 * bottles and gear. The full player panel still holds parks and bonus cards.
 */
export function KitBar({
  state,
  onUseBottle,
  canAct,
  seat = 0,
}: {
  state: GameState;
  onUseBottle: (bottleId: string) => void;
  canAct: boolean;
  /** Whose kit this is. Seat 0 in single-device play. */
  seat?: number;
}) {
  const player = state.players[seat];
  const info = useInfo();
  const ready = new Set(usableBottles(player).map((b) => b.id));
  const tokens = tokenCount(player);

  // Anything that just arrived or was just spent gets a moment on screen.
  const flash = useCountFlashes({
    sun: player.resources.sun ?? 0,
    water: player.resources.water ?? 0,
    forest: player.resources.forest ?? 0,
    mountain: player.resources.mountain ?? 0,
    wild: player.resources.wild ?? 0,
    tokens,
    campfires: player.campfires,
    photos: player.photos,
  });

  return (
    <section className="kit" aria-label="Your resources, bottles and gear">
      <span className="kit-label">Your kit</span>

      <span className="kit-group">
        {RESOURCES.map((r) => (
          <ResourceChip
            key={r}
            resource={r}
            count={player.resources[r] ?? 0}
            dim={(player.resources[r] ?? 0) === 0}
            flash={flash[r]}
          />
        ))}
        <button
          type="button"
          className={`chip chip-info${tokens >= TOKEN_LIMIT ? ' chip-full' : ''}${
            flash.tokens ? ` chip-${flash.tokens.dir}` : ''
          }`}
          title={`${tokens} of ${TOKEN_LIMIT} tokens`}
          onClick={() =>
            info.show({
              title: 'Token limit',
              icon: '🎒',
              lines: [
                `Nobody may end a turn holding more than ${TOKEN_LIMIT} tokens; the overflow goes back, sun first and wildcards last.`,
                { label: 'Carrying', value: `${tokens} of ${TOKEN_LIMIT}` },
              ],
            })
          }
        >
          <span aria-hidden="true">🎒</span>
          <b key={flash.tokens?.at ?? 'steady'} className="chip-count">
            {tokens}/{TOKEN_LIMIT}
          </b>
        </button>
      </span>

      <span className="kit-group">
        <button
          type="button"
          className={`chip chip-info${flash.campfires ? ` chip-${flash.campfires.dir}` : ''}`}
          title="Campfire tokens"
          onClick={() =>
            info.show({
              title: 'Campfire tokens',
              icon: '🔥',
              lines: [
                'Spend one to step onto a site another hiker already occupies.',
                'It re-lights when your first hiker reaches the Trail End.',
                { label: 'Alight', value: `${player.campfires} of ${campfireAllowance(player)}` },
              ],
            })
          }
        >
          <span aria-hidden="true">🔥</span>
          <ChipCount count={player.campfires} flash={flash.campfires} />
        </button>
        <button
          type="button"
          className={`chip chip-info${flash.photos ? ` chip-${flash.photos.dir}` : ''}`}
          title="Photos taken"
          onClick={() =>
            info.show({
              title: 'Photos',
              icon: '📸',
              lines: ['1 VP each, or 2 VP with the Photo Album.', { label: 'Taken', value: String(player.photos) }],
            })
          }
        >
          <span aria-hidden="true">📸</span>
          <ChipCount count={player.photos} flash={flash.photos} />
        </button>
      </span>

      <span className="kit-group kit-bottles">
        {player.bottles.map((bottle) => {
          const def = bottleDef(bottle.kind);
          const usable = canAct && ready.has(bottle.id);
          const gain = Object.entries(def.gain)
            .map(([r, n]) => `${n} ${r === 'forest' ? 'tree' : r}`)
            .join(' + ');
          return (
            <button
              key={bottle.id}
              type="button"
              className={`kit-bottle${bottle.used ? ' bottle-used' : ''}${usable ? ' bottle-ready' : ''}`}
              disabled={bottle.used}
              title={bottle.used ? `${def.name} — used this season` : `${def.name}: 1 water → ${gain}`}
              onClick={() =>
                usable
                  ? onUseBottle(bottle.id)
                  : info.show({
                      title: def.name,
                      icon: def.icon,
                      lines: [
                        `1 water → ${gain}.`,
                        'One conversion per bottle per season; they refill at the season break.',
                        {
                          label: 'State',
                          value: bottle.used ? 'used this season' : canAct ? 'needs water' : 'ready',
                        },
                      ],
                    })
              }
            >
              <span aria-hidden="true">{def.icon}</span>
              <span className="kit-bottle-name">{def.name}</span>
              {usable && <span className="kit-use">use</span>}
            </button>
          );
        })}
      </span>

      <span className="kit-group kit-gear">
        {player.gear.length === 0 ? (
          <span className="muted">no gear yet</span>
        ) : (
          player.gear.map((gear) => (
            <button
              key={gear.id}
              type="button"
              className="kit-gear-item card-info"
              title={`${gear.name}: ${gear.text}`}
              onClick={() =>
                info.show({
                  title: gear.name,
                  icon: gear.icon,
                  lines: [gear.text, { label: 'Scores', value: `${GEAR_VP} VP` }],
                })
              }
            >
              <span aria-hidden="true">{gear.icon}</span> {gear.name}
            </button>
          ))
        )}
      </span>
    </section>
  );
}
