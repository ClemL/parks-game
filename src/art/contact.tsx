import { createRoot } from 'react-dom/client';
import { EXPANSION_PARKS, PARKS } from '../game/data/parks';
import { IllustratedParkArt } from './illustrated';
import { SCENES } from './scenes';

const only = new URLSearchParams(location.search).get('only')?.split(',');
const parks = [...PARKS, ...EXPANSION_PARKS].filter((p) => !only || only.includes(p.id));

createRoot(document.getElementById('root')!).render(
  <div className="sheet">
    {parks.map((park) => (
      <div className="cell" key={park.id}>
        <div className="art">
          <IllustratedParkArt park={park} />
        </div>
        <div className="card">
          <IllustratedParkArt park={park} />
        </div>
        <div className="mini">
          <IllustratedParkArt park={park} />
        </div>
        <b>{park.name}</b>
        <span>{SCENES[park.id]?.view ?? '— no scene yet —'}</span>
      </div>
    ))}
  </div>,
);
