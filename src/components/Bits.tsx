import type { Resource, ResourceBag } from '../game/types';
import { RESOURCES } from '../game/types';
import { useInfo } from './InfoSheet';
import type { Flash } from '../hooks/useFlash';

export const RESOURCE_ICON: Record<Resource, string> = {
  sun: '☀️',
  water: '💧',
  forest: '🌲',
  mountain: '⛰️',
  wild: '🐾',
};

export const RESOURCE_LABEL: Record<Resource, string> = {
  sun: 'Sun',
  water: 'Water',
  forest: 'Tree',
  mountain: 'Mountain',
  wild: 'Wildcard',
};

const RESOURCE_USE: Record<Resource, string> = {
  sun: 'Buys gear and photos. No park asks for sun.',
  water: 'Pays park costs, fills bottles and pays the Overlook.',
  forest: 'Pays park costs.',
  mountain: 'Pays park costs.',
  wild: 'Pays for any resource, and two of them each once Nightfall is in play.',
};

export function ResourceChip({
  resource,
  count,
  dim,
  flash,
}: {
  resource: Resource;
  count: number;
  dim?: boolean;
  /** Set when this count just moved, to animate the gain or the spend. */
  flash?: Flash;
}) {
  const info = useInfo();
  const label =
    resource === 'wild'
      ? `${count} wildcards (each pays for any resource)`
      : `${count} ${RESOURCE_LABEL[resource]}`;
  return (
    <button
      type="button"
      className={`chip chip-info${dim ? ' chip-dim' : ''}${flash ? ` chip-${flash.dir}` : ''}`}
      title={label}
      aria-label={label}
      onClick={() =>
        info.show({
          title: RESOURCE_LABEL[resource],
          icon: RESOURCE_ICON[resource],
          lines: [RESOURCE_USE[resource], { label: 'Held', value: String(count) }],
        })
      }
    >
      <span aria-hidden="true">{RESOURCE_ICON[resource]}</span>
      <ChipCount count={count} flash={flash} />
    </button>
  );
}

/**
 * The number on a chip. Remounting it on every change restarts the pop, so two
 * gains in a row both register.
 */
export function ChipCount({ count, flash }: { count: number; flash?: Flash }) {
  return (
    <>
      <b key={flash?.at ?? 'steady'} className="chip-count">
        {count}
      </b>
      {flash && (
        <span key={`d${flash.at}`} className={`chip-delta chip-delta-${flash.dir}`} aria-hidden="true">
          {flash.dir === 'up' ? '+' : '−'}
          {flash.by}
        </span>
      )}
    </>
  );
}

/** Cost shown as one icon per required resource. */
export function CostRow({ cost, className }: { cost: ResourceBag; className?: string }) {
  const icons: string[] = [];
  for (const r of RESOURCES) {
    for (let i = 0; i < (cost[r] ?? 0); i++) icons.push(RESOURCE_ICON[r]);
  }
  return (
    <span className={`cost-row ${className ?? ''}`} aria-label={costLabel(cost)}>
      {icons.map((icon, i) => (
        <span key={i} className="cost-pip" aria-hidden="true">
          {icon}
        </span>
      ))}
    </span>
  );
}

export function costLabel(cost: ResourceBag): string {
  return (
    RESOURCES.filter((r) => (cost[r] ?? 0) > 0)
      .map((r) => `${cost[r]} ${RESOURCE_LABEL[r]}`)
      .join(', ') || 'free'
  );
}
