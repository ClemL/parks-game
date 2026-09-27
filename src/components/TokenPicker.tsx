import { useState } from 'react';
import type { Resource, ResourceBag } from '../game/types';
import { RESOURCES } from '../game/types';
import { RESOURCE_ICON, RESOURCE_LABEL } from './Bits';

/**
 * Choose some of your tokens: for a photo's price, or what goes back to get
 * under the token limit. Starts from a suggested pick, so a single tap on the
 * confirm button accepts it.
 */
export function TokenPicker({
  held,
  initial,
  valid,
  confirmLabel,
  onConfirm,
  children,
}: {
  held: ResourceBag;
  initial: ResourceBag;
  valid: (pick: ResourceBag) => boolean;
  confirmLabel: (pick: ResourceBag) => string;
  onConfirm: (pick: ResourceBag) => void;
  /** Further buttons to sit beside the confirm button. */
  children?: React.ReactNode;
}) {
  const [pick, setPick] = useState<ResourceBag>(initial);
  const kinds = RESOURCES.filter((r) => (held[r] ?? 0) > 0);
  const step = (r: Resource, by: number) =>
    setPick((current) => {
      const next = Math.min(held[r] ?? 0, Math.max(0, (current[r] ?? 0) + by));
      return { ...current, [r]: next };
    });
  const ok = valid(pick);

  return (
    <>
      <ul className="token-picker">
        {kinds.map((r) => (
          <li key={r}>
            <span className="token-picker-kind">
              <span aria-hidden="true">{RESOURCE_ICON[r]}</span> {RESOURCE_LABEL[r]}
              <span className="muted"> · you hold {held[r]}</span>
            </span>
            <span className="token-picker-step">
              <button
                type="button"
                className="ghost"
                aria-label={`One less ${RESOURCE_LABEL[r]}`}
                disabled={(pick[r] ?? 0) === 0}
                onClick={() => step(r, -1)}
              >
                −
              </button>
              <output aria-label={`${RESOURCE_LABEL[r]} chosen`}>{pick[r] ?? 0}</output>
              <button
                type="button"
                className="ghost"
                aria-label={`One more ${RESOURCE_LABEL[r]}`}
                disabled={(pick[r] ?? 0) >= (held[r] ?? 0)}
                onClick={() => step(r, 1)}
              >
                +
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="choice-grid">
        <button type="button" className="choice" disabled={!ok} onClick={() => onConfirm(pick)}>
          {confirmLabel(pick)}
        </button>
        {children}
      </div>
    </>
  );
}
