import { createRoot } from 'react-dom/client';
import { EXPANSION_PARKS, PARKS } from '../game/data/parks';
import { IllustratedParkArt, SceneSvg } from './illustrated';
import { CAMPSITE_SCENES, SITE_SCENES } from './sites';
import { SCENES } from './scenes';

const only = new URLSearchParams(location.search).get('only')?.split(',');
const parks = [...PARKS, ...EXPANSION_PARKS].filter((p) => !only || only.includes(p.id));

createRoot(document.getElementById('root')!).render(
  <>
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
  </div>
  <h2>Trail sites and campsites</h2>
  <div className="sheet">
    {[...Object.entries(SITE_SCENES), ...Object.entries(CAMPSITE_SCENES)]
      .filter(([id]) => !only || only.includes(id))
      .map(([id, scene]) => (
        <div className="cell" key={id}>
          <div className="art">
            <SceneSvg scene={scene} label={scene.view} />
          </div>
          <div className="mini tile">
            <SceneSvg scene={scene} label={scene.view} />
          </div>
          <b>{id}</b>
          <span>{scene.view}</span>
        </div>
      ))}
  </div>
  </>,
);
