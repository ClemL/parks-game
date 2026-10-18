import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Game } from '../hooks/useGame';
import type { MoveOption } from '../game/engine';
import {
  bisonPark,
  bottleDef,
  campfireAllowance,
  campsiteDef,
  gearCost,
  hasTent,
  occupants,
  pendingLabel,
  SEASONS,
  siteDef,
  tokenCount,
  usableBottles,
} from '../game/engine';
import { parkDeckLeft } from '../game/view';
import { TOKEN_LIMIT } from '../game/data/sites';
import { RESOURCES, type GameState, type ParkCard } from '../game/types';
import { RESOURCE_ICON, RESOURCE_LABEL, costLabel } from '../components/Bits';
import { ParkArt } from '../components/ParkCardView';
import { useInfo } from '../components/InfoSheet';
import { useWalkingPawns } from '../components/TrailView';
import { bonusStanding, parkProgress, previewMove, showingVp, SITE_VERB, type MovePreview } from './insight';
import { GameOverlays, NewGameButton, SEASON_NAMES, useExplainSite, usePageSkin } from './shared';
import './trail-map.css';

/**
 * Concept C: built for a phone in one hand. The trail runs down the screen as
 * a switchback map, so it scrolls the way a phone scrolls, and everything you
 * touch sits in a dock along the bottom edge, under your thumb. A tap aims a
 * hiker and a second tap sends it, so a slip of the thumb costs nothing.
 */

type Drawer = 'parks' | 'kit' | 'shop' | 'log';

const DRAWERS: [Drawer, string][] = [
  ['parks', 'Parks'],
  ['kit', 'Kit'],
  ['shop', 'Shop'],
  ['log', 'Log'],
];

export function TrailMap({ game }: { game: Game }) {
  const { state, moves, isHumanTurn, selectedHiker, dispatch } = game;
  usePageSkin('parchment', state.season);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [aim, setAim] = useState<number | null>(null);
  const canAct = isHumanTurn && !state.pending;

  const hiker = selectedHiker ?? moves[0]?.hikerId ?? null;
  const options = useMemo(() => (canAct ? moves.filter((m) => m.hikerId === hiker) : []), [moves, hiker, canAct]);
  // An aim only means anything for the board and the hiker it was taken on.
  useEffect(() => setAim(null), [state, hiker]);
  const aimed = useMemo(() => {
    const option = options.find((o) => o.to === aim);
    return option ? previewMove(state, option) : null;
  }, [state, options, aim]);

  const go = (option: MoveOption) =>
    dispatch({ type: 'move', hikerId: option.hikerId, to: option.to, useCampfire: option.useCampfire });

  const ready = state.parkRow.concat(state.players[0].reserved).filter((p) => parkProgress(state, state.players[0], p).ready).length;

  return (
    <div className="tm" data-drawer={drawer ?? 'none'}>
      <Band game={game} onRules={() => setRulesOpen(true)} />
      <Rivals state={state} />
      <div className="tm-body">
        <div className="tm-col">
          <MapView
            game={game}
            options={options}
            aim={aim}
            onPick={(index) => {
              const option = options.find((o) => o.to === index);
              if (!option) return false;
              if (aim === index) go(option);
              else setAim(index);
              return true;
            }}
          />
          <Dock
            game={game}
            hiker={hiker}
            canAct={canAct}
            aimed={aimed}
            hasOptions={options.length > 0}
            onGo={() => aimed && go(aimed.option)}
            drawer={drawer}
            onDrawer={(next) => setDrawer((open) => (open === next ? null : next))}
            ready={ready}
          />
        </div>
        <aside className="tm-drawer" aria-label="Parks, kit, shop and log">
          <div className="tm-drawer-head">
            <button type="button" onClick={() => setDrawer(null)} aria-label="Close">
              ✕
            </button>
          </div>
          <ParksSection state={state} />
          <KitSection game={game} canAct={canAct} />
          <ShopSection state={state} />
          <LogSection state={state} />
        </aside>
      </div>
      {drawer && <button type="button" className="tm-scrim" aria-label="Close the drawer" onClick={() => setDrawer(null)} />}
      <GameOverlays game={game} rulesOpen={rulesOpen} onCloseRules={() => setRulesOpen(false)} />
    </div>
  );
}

/* --------------------------------------------------------------------- band */

function Band({ game, onRules }: { game: Game; onRules: () => void }) {
  const { state, isHumanTurn } = game;
  const active = state.players[state.current];
  let status: string;
  if (state.phase === 'game-over') status = 'The year is over';
  else if (state.phase === 'season-end') status = `${SEASON_NAMES[state.season - 1]} is over`;
  else if (!isHumanTurn) status = `${active.name} is choosing…`;
  else if (state.pending) status = `Decide: ${pendingLabel(state)}`;
  else status = 'Your turn';

  return (
    <header className="tm-band">
      <div className="tm-band-title">
        <small>Trailside Seasons · Trail map</small>
        <h1>
          {SEASON_NAMES[state.season - 1]}
          <span>
            {state.season} of {SEASONS} · {state.trail.length - 2} stops
          </span>
        </h1>
      </div>
      <div className="tm-band-actions">
        <button type="button" onClick={game.undo} disabled={!game.canUndo}>
          Undo
        </button>
        <button type="button" onClick={onRules}>
          Rules
        </button>
        <NewGameButton game={game} />
      </div>
      <p className="tm-band-status" aria-live="polite">
        <span
          className={`tm-dot${isHumanTurn ? ' tm-dot-you' : ''}`}
          style={{ '--seat': active.color } as CSSProperties}
          aria-hidden="true"
        />
        {status}
        {state.seasonCard && (
          <span className="tm-band-card" title={state.seasonCard.text}>
            <b>{state.seasonCard.name}</b> {state.seasonCard.text}
          </span>
        )}
      </p>
    </header>
  );
}

function Rivals({ state }: { state: GameState }) {
  return (
    <ul className="tm-rivals" aria-label="Players">
      {state.players.map((player) => {
        const active = state.current === player.index && state.phase === 'playing';
        const walking = player.hikers.filter((h) => !h.finished).length;
        return (
          <li
            key={player.index}
            className={`${active ? 'on' : ''}${player.isHuman ? ' you' : ''}`}
            style={{ '--seat': player.color } as CSSProperties}
          >
            <span className="tm-dot" aria-hidden="true" />
            <b>{player.isHuman ? 'You' : player.name}</b>
            <span className="tm-rival-vp">{showingVp(player)}</span>
            <small>
              {player.parks.length}🏞️ · {walking === 0 ? 'home' : `${walking}🚶`}
              {state.cameraHolder === player.index && ' · 📷'}
              {state.firstPlayer === player.index && ' · 1st'}
            </small>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------------- map */

/** Row height in the path's own units; the path is drawn in percent across, rows down. */
const ROW = 10;

/** Where each stop sits across the map, so the trail switches back as it descends. */
const across = (i: number) => (i === 0 ? 50 : Math.round(50 + 27 * Math.sin(i * 1.15)));

function MapView({
  game,
  options,
  aim,
  onPick,
}: {
  game: Game;
  options: MoveOption[];
  aim: number | null;
  /** Answers whether the tap was a move; a tap that was not explains the stop. */
  onPick: (index: number) => boolean;
}) {
  const { state, selectedHiker, lastCpuMove } = game;
  const explain = useExplainSite(state);
  const box = useRef<HTMLOListElement>(null);
  useWalkingPawns(box, state, '.tm-pawn');

  const end = state.trail.length - 1;
  const home = state.players.flatMap((p) => p.hikers.filter((h) => h.finished).map((h) => h.id));
  const xs = state.trail.map((_, i) => across(i));
  const path = smoothPath(xs.map((x, i) => [x, (i + 0.5) * ROW] as const));

  // Bring the nearest stop you could walk to into view when the turn comes back.
  const first = options[0]?.to;
  useLayoutEffect(() => {
    if (first === undefined) return;
    const stop = box.current?.querySelectorAll<HTMLElement>('.tm-stop')[first];
    stop?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [first, selectedHiker]);

  return (
    <section className={`tm-map${options.length > 0 ? ' tm-picking' : ''}`} aria-label="The trail">
      <svg
        className="tm-path"
        viewBox={`0 0 100 ${state.trail.length * ROW}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={path} className="tm-path-bed" vectorEffect="non-scaling-stroke" />
        <path d={path} className="tm-path-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <ol className="tm-stops" ref={box}>
        {state.trail.map((kind, index) => {
          const def = siteDef(kind);
          const option = options.find((o) => o.to === index);
          const token = state.siteTokens[index];
          const pawns = [...occupants(state, index), ...(index === end ? home : [])];
          const just = lastCpuMove?.index === index ? state.players[lastCpuMove.player] : null;
          const right = xs[index] <= 50;
          return (
            <li
              key={index}
              className={[
                'tm-stop',
                right ? 'tm-right' : 'tm-left',
                option ? 'tm-open' : '',
                option?.useCampfire ? 'tm-fire' : '',
                aim === index ? 'tm-aimed' : '',
                just ? 'tm-just' : '',
                def.tier === 'advanced' ? 'tm-adv' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ '--x': `${xs[index]}%`, '--just': just?.color } as CSSProperties}
            >
              <button
                type="button"
                className="tm-hit"
                aria-pressed={option ? aim === index : undefined}
                aria-label={`${index === 0 ? 'Trailhead' : index === end ? 'Trail End' : `Stop ${index}`}: ${def.name}. ${def.text}${
                  token ? ` A ${token} season token is here.` : ''
                }${option ? (aim === index ? ' Aimed: press again to go.' : ' Press to aim here.') : ''}`}
                onClick={() => {
                  if (!onPick(index)) explain(index);
                }}
              >
                <span className="tm-marker">
                  <span className="tm-marker-icon" aria-hidden="true">
                    {def.icon}
                  </span>
                  <span className="tm-marker-num">{index === 0 ? 'S' : index === end ? 'E' : index}</span>
                </span>
                <span className="tm-label">
                  <b>{def.name}</b>
                  <span className="tm-pay">
                    {def.gain ? (
                      RESOURCES.filter((r) => (def.gain![r] ?? 0) > 0).map((r) => (
                        <span key={r}>{RESOURCE_ICON[r].repeat(def.gain![r]!)}</span>
                      ))
                    ) : (
                      <span>{SITE_VERB[kind]}</span>
                    )}
                    {token && (
                      <span className={`tm-token tm-token-${token}`} title={`Season token: 1 ${token}`}>
                        +{RESOURCE_ICON[token]}
                      </span>
                    )}
                    {hasTent(state, index) && <span title="Tent site">⛺</span>}
                  </span>
                  {option && (aim === index || option.useCampfire) && (
                    <span className="tm-cue">{aim === index ? 'Tap again to go' : '🔥 Shares a site'}</span>
                  )}
                </span>
                <span className="tm-pawns">
                  {pawns.map((id) => {
                    const owner = state.players[Number(id[1])];
                    return (
                      <span
                        key={id}
                        data-hiker={id}
                        className={`tm-pawn${id === selectedHiker ? ' tm-pawn-on' : ''}${home.includes(id) ? ' tm-pawn-home' : ''}`}
                        style={{ '--seat': owner.color } as CSSProperties}
                        title={`${owner.name}'s hiker`}
                      >
                        {owner.isHuman ? '🚶' : owner.name[0]}
                      </span>
                    );
                  })}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** A smooth curve through the stops (Catmull-Rom, as cubic Béziers). */
function smoothPath(points: readonly (readonly [number, number])[]): string {
  if (points.length < 2) return '';
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/* --------------------------------------------------------------------- dock */

function Dock({
  game,
  hiker,
  canAct,
  aimed,
  hasOptions,
  onGo,
  drawer,
  onDrawer,
  ready,
}: {
  game: Game;
  hiker: string | null;
  canAct: boolean;
  aimed: MovePreview | null;
  hasOptions: boolean;
  onGo: () => void;
  drawer: Drawer | null;
  onDrawer: (drawer: Drawer) => void;
  ready: number;
}) {
  const { state, moves, dispatch } = game;
  const me = state.players[0];
  const movable = new Set(moves.map((m) => m.hikerId));
  const tokens = tokenCount(me);
  const usable = new Set(usableBottles(me).map((b) => b.id));

  return (
    <footer className="tm-dock" aria-label="Your move">
      <div className="tm-dock-row tm-dock-top">
        {canAct ? (
          <div className="tm-hikers" role="radiogroup" aria-label="Hiker">
            {me.hikers.map((h, i) => (
              <button
                key={h.id}
                type="button"
                role="radio"
                aria-checked={hiker === h.id}
                className={hiker === h.id ? 'on' : ''}
                disabled={!movable.has(h.id)}
                onClick={() => game.setSelectedHiker(h.id)}
              >
                🚶{i + 1}
                <small>{h.finished ? 'home' : h.position === 0 ? 'start' : `at ${h.position}`}</small>
              </button>
            ))}
          </div>
        ) : (
          <span className="tm-dock-wait">{state.pending ? `Decide: ${pendingLabel(state)}` : 'Watching the others…'}</span>
        )}
        <nav className="tm-drawer-tabs" aria-label="Drawers">
          {DRAWERS.map(([id, label]) => (
            <button key={id} type="button" className={drawer === id ? 'on' : ''} aria-expanded={drawer === id} onClick={() => onDrawer(id)}>
              {label}
              {id === 'parks' && ready > 0 && <span className="tm-count">{ready}</span>}
            </button>
          ))}
        </nav>
      </div>

      <div className={`tm-dock-row tm-route${aimed ? ' tm-route-aimed' : ''}`}>
        {aimed ? (
          <>
            <span className="tm-route-body">
              <b>
                {aimed.option.to === state.trail.length - 1 ? 'Trail End' : `${aimed.option.to} · ${siteDef(aimed.kind).name}`}
              </b>
              <span className="tm-route-tags">
                {RESOURCES.filter((r) => (aimed.delta[r] ?? 0) !== 0).map((r) => (
                  <span key={r} className="tm-gain">
                    {(aimed.delta[r] ?? 0) > 0 ? '+' : '−'}
                    {Math.abs(aimed.delta[r] ?? 0)}
                    {RESOURCE_ICON[r]}
                  </span>
                ))}
                {aimed.decision && <span className="tm-tag">then you choose</span>}
                {aimed.tent && <span className="tm-tag">⛺ or camp</span>}
                {aimed.option.useCampfire && <span className="tm-tag tm-tag-fire">spends 🔥</span>}
                {aimed.passes > 0 && <span className="tm-tag tm-tag-quiet">skips {aimed.passes}</span>}
                {aimed.unlocks.map((park) => (
                  <span key={park.id} className="tm-tag tm-tag-unlock">
                    ✓ {park.name}
                  </span>
                ))}
              </span>
            </span>
            <button type="button" className="tm-go" onClick={onGo}>
              Go
            </button>
          </>
        ) : (
          <span className="tm-route-hint">
            {canAct
              ? hasOptions
                ? 'Tap a lit stop to aim. Tap it again, or Go, to walk.'
                : 'Both hikers are home for the season.'
              : state.phase === 'playing'
                ? `${state.players[state.current].isHuman ? 'You' : state.players[state.current].name} on the trail`
                : 'Season break'}
          </span>
        )}
      </div>

      <div className="tm-dock-row tm-pack">
        {RESOURCES.map((r) => (
          <span key={r} className={`tm-res${(me.resources[r] ?? 0) === 0 ? ' zero' : ''}`} title={RESOURCE_LABEL[r]}>
            <span aria-hidden="true">{RESOURCE_ICON[r]}</span>
            {me.resources[r] ?? 0}
          </span>
        ))}
        <span className={`tm-meter${tokens >= TOKEN_LIMIT ? ' full' : ''}`} title={`${tokens} of ${TOKEN_LIMIT} tokens`}>
          <span style={{ width: `${(tokens / TOKEN_LIMIT) * 100}%` }} />
          <b>
            {tokens}/{TOKEN_LIMIT}
          </b>
        </span>
        {me.bottles.map((bottle) => {
          const def = bottleDef(bottle.kind);
          const ok = canAct && usable.has(bottle.id);
          if (!ok) return null;
          return (
            <button
              key={bottle.id}
              type="button"
              className="tm-flask"
              onClick={() => dispatch({ type: 'use-bottle', bottleId: bottle.id })}
              title={`Use ${def.name}`}
            >
              {def.icon} Use
            </button>
          );
        })}
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ drawers */

function ParksSection({ state }: { state: GameState }) {
  const me = state.players[0];
  const info = useInfo();
  const bison = bisonPark(state);
  const card = (park: ParkCard, reserved: boolean) => {
    const progress = parkProgress(state, me, park);
    return (
      <li key={park.id}>
        <button
          type="button"
          className={`tm-park${progress.ready ? ' ready' : ''}`}
          onClick={() =>
            info.show({
              title: park.name,
              icon: '🏞️',
              lines: [
                { label: 'Worth', value: `${park.vp} VP` },
                { label: 'Cost', value: costLabel(park.cost) },
                { label: 'State', value: park.state },
                ...(bison?.id === park.id ? ['The bison is here: visiting trades a resource for a wildcard.'] : []),
              ],
            })
          }
        >
          <span className="tm-park-art">
            <ParkArt park={park} art={{}} />
          </span>
          <span className="tm-park-body">
            <b>
              {park.name}
              {reserved && <small> · reserved</small>}
              {bison?.id === park.id && ' 🦬'}
            </b>
            <span className="tm-pips">
              {progress.pips.map((pip, i) => (
                <span key={i} className={`tm-pip tm-pip-${pip.state}`}>
                  {RESOURCE_ICON[pip.resource]}
                </span>
              ))}
            </span>
            <small>{progress.ready ? 'Within reach' : `${progress.short} short`}</small>
          </span>
          <span className="tm-park-vp">{park.vp}</span>
        </button>
      </li>
    );
  };
  return (
    <section className="tm-sec" data-sec="parks" aria-label="Parks">
      <h2>
        Parks <span>{parkDeckLeft(state)} in the deck</span>
      </h2>
      <ul className="tm-parks">
        {state.parkRow.map((park) => card(park, false))}
        {me.reserved.map((park) => card(park, true))}
      </ul>
    </section>
  );
}

function KitSection({ game, canAct }: { game: Game; canAct: boolean }) {
  const { state, dispatch } = game;
  const me = state.players[0];
  const usable = new Set(usableBottles(me).map((b) => b.id));
  return (
    <section className="tm-sec" data-sec="kit" aria-label="Your kit">
      <h2>
        Your kit <span>{showingVp(me)} VP showing</span>
      </h2>
      <ul className="tm-kit">
        <li>
          🔥 Campfire
          <b>
            {me.campfires}/{campfireAllowance(me)}
          </b>
        </li>
        <li>
          📸 Photos <b>{me.photos}</b>
          {state.cameraHolder === 0 && ' · you hold the camera'}
        </li>
        {state.firstPlayer === 0 && <li>🥇 First player token</li>}
        {me.bottles.map((bottle) => {
          const def = bottleDef(bottle.kind);
          const ok = canAct && usable.has(bottle.id);
          return (
            <li key={bottle.id} className={bottle.used ? 'used' : ''}>
              {def.icon} {def.name}
              {ok ? (
                <button type="button" onClick={() => dispatch({ type: 'use-bottle', bottleId: bottle.id })}>
                  Use
                </button>
              ) : (
                <small>{bottle.used ? 'empty' : 'fills from fresh water'}</small>
              )}
            </li>
          );
        })}
        {me.gear.map((gear) => (
          <li key={gear.id}>
            {gear.icon} {gear.name} <small>{gear.text}</small>
          </li>
        ))}
      </ul>
      <h3>Visited</h3>
      <p className="tm-visited">{me.parks.length === 0 ? 'No parks yet.' : me.parks.map((p) => `${p.name} (${p.vp})`).join(' · ')}</p>
      <h3>Bonus cards</h3>
      <ul className="tm-kit">
        {bonusStanding(state, me).map(({ card, vp }) => (
          <li key={card.id}>
            🎯 {card.name} <b>{vp} VP now</b>
            <small>{card.text}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ShopSection({ state }: { state: GameState }) {
  const sun = state.players[0].resources.sun ?? 0;
  return (
    <section className="tm-sec" data-sec="shop" aria-label="Gear and campsites">
      <h2>
        Gear <span>at the Trail End{state.gearDiscountsLeft > 0 ? ` · ${state.gearDiscountsLeft} discount left` : ''}</span>
      </h2>
      <ul className="tm-kit">
        {state.gearRow.map((gear) => {
          const cost = gearCost(state, gear);
          return (
            <li key={gear.id} className={sun >= cost ? 'afford' : ''}>
              {gear.icon} {gear.name}
              <b className="tm-price">
                {cost}☀️{cost !== gear.cost && <s>{gear.cost}</s>}
              </b>
              <small>{gear.text}</small>
            </li>
          );
        })}
      </ul>
      {state.campsites.length > 0 && (
        <>
          <h3>Campsites, from any ⛺</h3>
          <ul className="tm-kit">
            {state.campsites.map((slot) => {
              const def = campsiteDef(slot.id);
              return (
                <li key={slot.id}>
                  {def.icon} {def.name}
                  <span className="tm-tents">
                    {slot.tents.map((owner, i) => (
                      <span key={i} className="tm-dot" style={{ '--seat': state.players[owner].color } as CSSProperties} />
                    ))}
                  </span>
                  <small>{def.text}</small>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function LogSection({ state }: { state: GameState }) {
  return (
    <section className="tm-sec" data-sec="log" aria-label="Trail log">
      <h2>Trail log</h2>
      <ol className="tm-log">
        {state.log
          .slice(-14)
          .reverse()
          .map((entry, i) => (
            <li key={state.log.length - i}>
              {entry.player >= 0 && (
                <span className="tm-dot" style={{ '--seat': state.players[entry.player].color } as CSSProperties} aria-hidden="true" />
              )}
              <span>
                {entry.player >= 0 && <b>{state.players[entry.player].name} </b>}
                {entry.text}
              </span>
            </li>
          ))}
      </ol>
    </section>
  );
}
