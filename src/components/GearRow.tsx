import type { GameState } from '../game/types';

export function GearRow({
  state,
  canBuy,
  onBuy,
}: {
  state: GameState;
  canBuy: (gearId: string) => boolean;
  onBuy: (gearId: string) => void;
}) {
  return (
    <div className="card-strip gear-strip">
      {state.gearRow.map((gear) => {
        const buyable = canBuy(gear.id);
        return (
          <button
            key={gear.id}
            type="button"
            className={`gear-card${buyable ? ' affordable clickable' : ''}`}
            disabled={!buyable}
            onClick={() => onBuy(gear.id)}
            title={buyable ? `Buy ${gear.name} for ${gear.cost} sun` : gear.text}
          >
            <span className="gear-icon" aria-hidden="true">
              {gear.icon}
            </span>
            <span className="gear-name">{gear.name}</span>
            <span className="gear-cost">{gear.cost} ☀️</span>
            <span className="gear-text">{gear.text}</span>
          </button>
        );
      })}
      {state.gearRow.length === 0 && <p className="muted">The gear shop is sold out.</p>}
    </div>
  );
}
