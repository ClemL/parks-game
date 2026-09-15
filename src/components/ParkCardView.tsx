import { useState } from 'react';
import type { ParkCard } from '../game/types';
import type { ArtMap } from '../art/parkArt';
import { GeneratedParkArt } from '../art/generated';
import { costLabel, CostRow, RESOURCE_LABEL } from './Bits';
import { useInfo } from './InfoSheet';

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
  bison,
}: {
  park: ParkCard;
  art: ArtMap;
  affordable?: boolean;
  reservedBy?: string;
  onClick?: () => void;
  compact?: boolean;
  selected?: boolean;
  bison?: boolean;
}) {
  const info = useInfo();
  // Without a click handler of its own, a card explains itself when tapped.
  const explain = () =>
    info.show({
      title: park.name,
      icon: '🏞️',
      lines: [
        { label: 'Worth', value: `${park.vp} VP` },
        { label: 'Cost', value: costLabel(park.cost) },
        { label: 'State', value: park.state },
        { label: 'Terrain', value: park.tags.join(', ') },
        ...(reservedBy ? [{ label: 'Reserved by', value: reservedBy }] : []),
        ...(bison ? ['The bison is here: visiting trades a resource for a wildcard.'] : []),
        `Wildcards ${RESOURCE_LABEL.wild} pay for any resource in this cost.`,
      ],
    });
  const handler = onClick ?? explain;
  const Tag = 'button';
  return (
    <Tag
      className={[
        'park-card',
        compact ? 'park-card-compact' : '',
        affordable ? 'affordable' : '',
        selected ? 'selected' : '',
        onClick ? 'clickable' : 'card-info',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handler}
      type="button"
    >
      <div className="park-art">
        <ParkArt park={park} art={art} />
        <span className="park-vp" title={`${park.vp} victory points`}>
          {park.vp}
        </span>
        {bison && (
          <span className="park-bison" title="The bison is here: visiting this park offers a wildcard trade">
            🦬
          </span>
        )}
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
