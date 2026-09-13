import type { Resource, ResourceBag } from '../game/types';
import { RESOURCES } from '../game/types';

export const RESOURCE_ICON: Record<Resource, string> = {
  sun: '☀️',
  water: '💧',
  forest: '🌲',
  mountain: '⛰️',
  animal: '🐾',
};

export const RESOURCE_LABEL: Record<Resource, string> = {
  sun: 'Sun',
  water: 'Water',
  forest: 'Forest',
  mountain: 'Mountain',
  animal: 'Wildlife',
};

export function ResourceChip({
  resource,
  count,
  dim,
}: {
  resource: Resource;
  count: number;
  dim?: boolean;
}) {
  return (
    <span
      className={`chip${dim ? ' chip-dim' : ''}`}
      title={`${count} ${RESOURCE_LABEL[resource]}`}
      aria-label={`${count} ${RESOURCE_LABEL[resource]}`}
    >
      <span aria-hidden="true">{RESOURCE_ICON[resource]}</span>
      <b>{count}</b>
    </span>
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
