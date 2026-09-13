import { useState } from 'react';
import type { ParkCard } from '../game/types';
import type { ArtMap } from '../art/parkArt';
import { GeneratedParkArt } from '../art/generated';
import { CostRow } from './Bits';

export function ParkArt({ park, art }: { park: ParkCard; art: ArtMap }) {
  const entry = art[park.wikiTitle];
  const [failed, setFailed] = useState(false);
  if (!entry || failed) return <GeneratedParkArt park={park} />;
  return (
    <img
      className="park-art-img"
      src={entry.url}
      alt={`${park.name} National Park`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function ParkCardView({
  park,
  art,
  affordable,
  reservedBy,
  onClick,
  compact,
  selected,
}: {
  park: ParkCard;
  art: ArtMap;
  affordable?: boolean;
  reservedBy?: string;
  onClick?: () => void;
  compact?: boolean;
  selected?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={[
        'park-card',
        compact ? 'park-card-compact' : '',
        affordable ? 'affordable' : '',
        selected ? 'selected' : '',
        onClick ? 'clickable' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      {...(onClick ? { type: 'button' as const } : {})}
    >
      <div className="park-art">
        <ParkArt park={park} art={art} />
        <span className="park-vp" title={`${park.vp} victory points`}>
          {park.vp}
        </span>
      </div>
      <div className="park-body">
        <div className="park-name">{park.name}</div>
        {!compact && <div className="park-state">{park.state}</div>}
        <CostRow cost={park.cost} />
        {!compact && <div className="park-tags">{park.tags.join(' · ')}</div>}
        {reservedBy && <div className="park-reserved">Reserved by {reservedBy}</div>}
      </div>
    </Tag>
  );
}
