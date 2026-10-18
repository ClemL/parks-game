import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Game } from '../hooks/useGame';
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
import { RESOURCES, type GameState, type ParkCard, type Player } from '../game/types';
import { RESOURCE_ICON, RESOURCE_LABEL, costLabel } from '../components/Bits';
import { ParkArt } from '../components/ParkCardView';
import { useInfo } from '../components/InfoSheet';
import { useWalkingPawns } from '../components/TrailView';
import { SiteArt } from '../art/siteArt';
import { useCountFlashes } from '../hooks/useFlash';
import { bonusStanding, parkProgress, showingVp, SITE_VERB } from './insight';
import { GameOverlays, NewGameButton, SEASON_NAMES, useExplainSite, usePageSkin } from './shared';
import './tabletop.css';

/**
 * Concept A: the screen is the board. Every piece keeps one place, the way it
 * would on a table: the trail winds across the middle, opponents sit across
 * the top, the parks are dealt below the trail and your backpack lies in front
 * of you along the bottom edge.
 */
export function Tabletop({ game }: { game: Game }) {
  const { state, isHumanTurn } = game;
  const [rulesOpen, setRulesOpen] = useState(false);
  usePageSkin('trailside', state.season);

  return (
    <div className={`tt tt-season-${state.season}`}>
      <TopRail game={game} onRules={() => setRulesOpen(true)} />
      <Seats state={state} />
      <Trail game={game} />
      <div className="tt-market">
        <ParkRow state={state} />
        <SideBoard state={state} />
      </div>
      <Backpack game={game} canAct={isHumanTurn && !state.pending} />
      <GameOverlays game={game} rulesOpen={rulesOpen} onCloseRules={() => setRulesOpen(false)} />
    </div>
  );
}

/* ----------------------------------------------------------------- top rail */

function TopRail({ game, onRules }: { game: Game; onRules: () => void }) {
  const { state, moves, isHumanTurn, selectedHiker } = game;
  const active = state.players[state.current];
  const human = state.players[0];
  const movable = [...new Set(moves.map((m) => m.hikerId))];
  const hikerNumber = selectedHiker ? human.hikers.findIndex((h) => h.id === selectedHiker) + 1 : 0;
  const last = state.log[state.log.length - 1];

  let status: JSX.Element;
  if (state.phase === 'game-over') status = <span className="tt-turn">The year is over</span>;
  else if (state.phase === 'season-end') status = <span className="tt-turn">{SEASON_NAMES[state.season - 1]} is over</span>;
  else if (!isHumanTurn)
    status = (
      <span className="tt-turn tt-turn-cpu" style={{ '--seat': active.color } as CSSProperties}>
        <span className="tt-dot" aria-hidden="true" />
        {active.name} is choosing…
      </span>
    );
  else if (state.pending) status = <span className="tt-turn tt-turn-you">Decide: {pendingLabel(state)}</span>;
  else
    status = (
      <span className="tt-turn tt-turn-you">
        Your turn
        {movable.length > 1 ? (
          <button type="button" className="tt-hiker-switch" onClick={game.cycleHiker} title="Switch to your other hiker">
            Hiker {hikerNumber} ⇄
          </button>
        ) : (
          hikerNumber > 0 && <span className="tt-hiker-switch tt-static">Hiker {hikerNumber}</span>
        )}
      </span>
    );

  return (
    <header className="tt-top">
      <ol className="tt-seasons" aria-label={`Season ${state.season} of ${SEASONS}`}>
        {SEASON_NAMES.map((name, i) => (
          <li
            key={name}
            className={i + 1 < state.season ? 'done' : i + 1 === state.season ? 'now' : ''}
            aria-current={i + 1 === state.season ? 'step' : undefined}
          >
            <span className="tt-season-dot" aria-hidden="true" />
            {name}
          </li>
        ))}
      </ol>
      {state.seasonCard && (
        <p className="tt-season-card" title={state.seasonCard.text}>
          <b>{state.seasonCard.name}</b> {state.seasonCard.text}
        </p>
      )}
      <div className="tt-status">
        {status}
        {last && (
          <span className="tt-ticker" aria-live="polite">
            {last.player >= 0 ? `${state.players[last.player].name} ${last.text}` : last.text}
          </span>
        )}
      </div>
      <div className="tt-actions">
        <button type="button" onClick={game.undo} disabled={!game.canUndo}>
          Undo
        </button>
        <button type="button" onClick={onRules}>
          Rules
        </button>
        <NewGameButton game={game} />
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------- seats */

function Seats({ state }: { state: GameState }) {
  return (
    <section className="tt-seats" aria-label="Opponents">
      {state.players
        .filter((p) => !p.isHuman)
        .map((player) => (
          <Seat key={player.index} state={state} player={player} />
        ))}
    </section>
  );
}

function Seat({ state, player }: { state: GameState; player: Player }) {
  const active = state.current === player.index && state.phase === 'playing';
  const walking = player.hikers.filter((h) => !h.finished).length;
  return (
    <article
      className={`tt-seat${active ? ' tt-seat-active' : ''}`}
      style={{ '--seat': player.color } as CSSProperties}
      aria-label={`${player.name}, ${showingVp(player)} points showing`}
    >
      <header>
        <span className="tt-dot" aria-hidden="true" />
        <b>{player.name}</b>
        {state.firstPlayer === player.index && <span className="tt-badge" title="First player token">1st</span>}
        {state.cameraHolder === player.index && <span className="tt-badge" title="Holds the camera">📷</span>}
        <span className="tt-seat-vp">{showingVp(player)}</span>
      </header>
      <div className="tt-seat-res">
        {RESOURCES.map((r) => (
          <span key={r} className={(player.resources[r] ?? 0) === 0 ? 'zero' : ''} title={RESOURCE_LABEL[r]}>
            <span aria-hidden="true">{RESOURCE_ICON[r]}</span>
            {player.resources[r] ?? 0}
          </span>
        ))}
      </div>
      <footer>
        <span className="tt-seat-parks" aria-label={`${player.parks.length} parks`}>
          {player.parks.slice(-4).map((park) => (
            <span key={park.id} className="tt-seat-park" title={park.name}>
              <ParkArt park={park} art={{}} />
            </span>
          ))}
          {player.parks.length === 0 ? 'no parks yet' : player.parks.length > 4 ? `+${player.parks.length - 4}` : ''}
        </span>
        <span className="tt-seat-meta">
          {player.photos > 0 && `📸${player.photos} · `}
          {player.reserved.length > 0 && `${player.reserved.length} reserved · `}
          {walking === 0 ? 'home' : `${walking} walking`}
        </span>
      </footer>
    </article>
  );
}

/* -------------------------------------------------------------------- trail */

/** How far below a tile the pawns stand, and so where the path runs. */
const PAWN_LINE = 23;

/** How far each stop rises or falls, so the trail winds rather than marches. */
const wave = (i: number, n: number) => Math.round(Math.sin((i / Math.max(1, n - 1)) * Math.PI * 2.2) * 26);

function Trail({ game }: { game: Game }) {
  const { state, moves, isHumanTurn, selectedHiker, setSelectedHiker, dispatch, lastCpuMove } = game;
  const canAct = isHumanTurn && !state.pending;
  const explain = useExplainSite(state);
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState('');
  useWalkingPawns(box, state, '.tt-pawn');

  // Measure the tiles once laid out and thread the path along the ground in
  // front of them, where the pawns stand. It lives in the scrolled content, so
  // it scrolls with the tiles.
  useLayoutEffect(() => {
    const root = inner.current;
    if (!root) return;
    const draw = () => {
      const base = root.getBoundingClientRect();
      const points = [...root.querySelectorAll<HTMLElement>('.tt-tile')].map((tile) => {
        const r = tile.getBoundingClientRect();
        return [r.left - base.left + r.width / 2, r.bottom - base.top + PAWN_LINE] as const;
      });
      setPath(smoothPath(points));
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(root);
    return () => observer.disconnect();
  }, [state.trail.length]);

  // Bring the nearest site you could walk to into view on a narrow screen.
  const firstTarget = canAct
    ? moves.filter((m) => !selectedHiker || m.hikerId === selectedHiker).map((m) => m.to).sort((a, b) => a - b)[0]
    : undefined;
  useLayoutEffect(() => {
    const root = box.current;
    if (firstTarget === undefined || !root || root.scrollWidth <= root.clientWidth) return;
    const stop = root.querySelectorAll<HTMLElement>('.tt-stop')[firstTarget];
    if (stop) root.scrollTo({ left: stop.offsetLeft - root.clientWidth / 2 + stop.offsetWidth / 2, behavior: 'smooth' });
  }, [firstTarget]);

  const end = state.trail.length - 1;
  const targetsFor = (index: number) =>
    canAct ? moves.filter((m) => m.to === index && (!selectedHiker || m.hikerId === selectedHiker)) : [];
  const home = state.players.flatMap((p) => p.hikers.filter((h) => h.finished).map((h) => h.id));

  return (
    <section className={`tt-trail${canAct ? ' tt-picking' : ''}`} aria-label="The trail">
      <Panorama season={state.season} />
      <div className="tt-trail-scroll" ref={box}>
        <div className="tt-trail-inner" ref={inner}>
          <svg className="tt-path" aria-hidden="true" width="100%" height="100%">
            <path d={path} className="tt-path-bed" />
            <path d={path} className="tt-path-line" />
          </svg>
          <ol className="tt-stops" style={{ '--n': state.trail.length } as CSSProperties}>
            {state.trail.map((kind, index) => {
              const def = siteDef(kind);
              const target = targetsFor(index)[0];
              const token = state.siteTokens[index];
              const pawns = [...occupants(state, index), ...(index === end ? home : [])];
              const just = lastCpuMove?.index === index ? state.players[lastCpuMove.player] : null;
              return (
                <li
                  key={index}
                  className={[
                    'tt-stop',
                    index === 0 ? 'tt-start' : '',
                    index === end ? 'tt-end' : '',
                    target ? 'tt-target' : '',
                    target?.useCampfire ? 'tt-target-fire' : '',
                    just ? 'tt-just' : '',
                    def.tier === 'advanced' ? 'tt-adv' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ '--dy': `${wave(index, state.trail.length)}px`, '--just': just?.color } as CSSProperties}
                >
                  <button
                    type="button"
                    className="tt-tile"
                    onClick={() =>
                      target
                        ? dispatch({ type: 'move', hikerId: target.hikerId, to: target.to, useCampfire: target.useCampfire })
                        : explain(index)
                    }
                    aria-label={`${def.name}. ${def.text}${token ? ` A ${token} season token is here.` : ''}${
                      target ? ' Move here.' : ''
                    }`}
                  >
                    <SiteArt id={kind} className="tt-art" />
                    <span className="tt-num">{index === 0 ? 'Start' : index === end ? 'End' : index}</span>
                    {token && (
                      <span className={`tt-token tt-token-${token}`} title={`Season token: 1 ${token}`}>
                        {RESOURCE_ICON[token]}
                      </span>
                    )}
                    {hasTent(state, index) && (
                      <span className="tt-tent" title="Tent site">
                        ⛺
                      </span>
                    )}
                    <span className="tt-name">{def.name}</span>
                    <span className="tt-pay">
                      <Payout state={state} index={index} />
                    </span>
                    {target && <span className="tt-go">{target.useCampfire ? '🔥 Share' : 'Go'}</span>}
                  </button>
                  <div className="tt-pawns">
                    {pawns.map((hikerId) => {
                      const owner = state.players[Number(hikerId[1])];
                      const finished = home.includes(hikerId);
                      const mine = owner.isHuman && canAct && !finished && moves.some((m) => m.hikerId === hikerId);
                      return (
                        <button
                          key={hikerId}
                          type="button"
                          data-hiker={hikerId}
                          className={`tt-pawn${selectedHiker === hikerId ? ' tt-pawn-on' : ''}${finished ? ' tt-pawn-home' : ''}`}
                          style={{ '--seat': owner.color } as CSSProperties}
                          disabled={!mine}
                          onClick={() => setSelectedHiker(hikerId)}
                          aria-label={`${owner.name}'s hiker${finished ? ', home' : ''}`}
                          title={`${owner.name}'s hiker${finished ? ' (home for the season)' : ''}`}
                        >
                          {owner.isHuman ? '🚶' : owner.name[0]}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** What a stop pays, in tokens where it pays tokens and in words where it asks a question. */
function Payout({ state, index }: { state: GameState; index: number }) {
  const kind = state.trail[index];
  const gain = siteDef(kind).gain;
  if (!gain) return <span className="tt-verb">{SITE_VERB[kind]}</span>;
  return (
    <>
      {RESOURCES.filter((r) => (gain[r] ?? 0) > 0).map((r) => (
        <span key={r} className="tt-gain">
          {Array.from({ length: gain[r]! }, (_, i) => (
            <span key={i} aria-hidden="true">
              {RESOURCE_ICON[r]}
            </span>
          ))}
        </span>
      ))}
    </>
  );
}

/** A smooth curve through the tile centres (Catmull-Rom, as cubic Béziers). */
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
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** The landscape behind the trail, recoloured for each season by the stylesheet. */
function Panorama({ season }: { season: number }) {
  return (
    <svg className="tt-panorama" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true" data-season={season}>
      <defs>
        <linearGradient id="tt-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="tt-sky-top" />
          <stop offset="1" className="tt-sky-low" />
        </linearGradient>
      </defs>
      <rect width="1200" height="300" fill="url(#tt-sky)" />
      <circle cx="960" cy="70" r="34" className="tt-sun" />
      <path
        className="tt-ridge-far"
        d="M0 150 L80 118 L150 136 L240 88 L320 128 L410 96 L470 120 L560 70 L650 118 L730 92 L820 130 L900 84 L990 122 L1080 100 L1200 128 L1200 300 L0 300 Z"
      />
      <path
        className="tt-ridge-mid"
        d="M0 190 L110 160 L200 178 L300 146 L390 176 L500 150 L610 182 L700 156 L800 184 L910 152 L1010 178 L1110 160 L1200 172 L1200 300 L0 300 Z"
      />
      <path className="tt-ground" d="M0 232 Q300 205 600 226 T1200 218 L1200 300 L0 300 Z" />
    </svg>
  );
}

/* ---------------------------------------------------------------- park row */

function ParkRow({ state }: { state: GameState }) {
  const human = state.players[0];
  const info = useInfo();
  const reservedBy = new Map(state.players.flatMap((p) => p.reserved.map((r) => [r.id, p] as const)));
  const bison = bisonPark(state);

  return (
    <section className="tt-parks" aria-label="Park row">
      <h2>
        Parks <span>{parkDeckLeft(state)} in the deck</span>
      </h2>
      <div className="tt-park-row">
        {state.parkRow.map((park) => {
          const holder = reservedBy.get(park.id);
          const progress = parkProgress(state, human, park);
          const open = !holder || holder.isHuman;
          return (
            <button
              key={park.id}
              type="button"
              className={`tt-park${progress.ready && open ? ' tt-park-ready' : ''}${holder && !holder.isHuman ? ' tt-park-held' : ''}`}
              onClick={() => explainPark(info, park, holder?.name, bison?.id === park.id)}
            >
              <span className="tt-park-art">
                <ParkArt park={park} art={{}} />
                <span className="tt-park-vp">{park.vp}</span>
                {bison?.id === park.id && <span className="tt-park-bison" title="The bison is here">🦬</span>}
                {progress.ready && open && <span className="tt-park-ribbon">Within reach</span>}
              </span>
              <span className="tt-park-name">{park.name}</span>
              <span className="tt-park-state">{park.state}</span>
              <span className="tt-park-cost" aria-label={`Cost: ${costLabel(park.cost)}`}>
                {progress.pips.map((pip, i) => (
                  <span key={i} className={`tt-pip tt-pip-${pip.state}`} aria-hidden="true">
                    {RESOURCE_ICON[pip.resource]}
                  </span>
                ))}
              </span>
              {holder && <span className="tt-park-tag">Reserved by {holder.isHuman ? 'you' : holder.name}</span>}
            </button>
          );
        })}
        <div className="tt-deck" aria-label={`${parkDeckLeft(state)} parks left in the deck`}>
          <span className="tt-deck-card" />
          <span className="tt-deck-card" />
          <span className="tt-deck-count">{parkDeckLeft(state)}</span>
        </div>
      </div>
    </section>
  );
}

function explainPark(info: ReturnType<typeof useInfo>, park: ParkCard, reservedBy?: string, bison?: boolean) {
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
      'Lit pips are covered by what you carry; a paw marks one a wildcard would pay.',
    ],
  });
}

/* --------------------------------------------------------------- side board */

type SideTab = 'gear' | 'camps' | 'log';

function SideBoard({ state }: { state: GameState }) {
  const [tab, setTab] = useState<SideTab>('gear');
  const tabs: [SideTab, string][] = [['gear', 'Gear shop'], ...(state.campsites.length ? [['camps', 'Campsites'] as [SideTab, string]] : []), ['log', 'Log']];
  return (
    <section className="tt-side" aria-label="Gear, campsites and log">
      <div className="tt-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'gear' && (
        <ul className="tt-list">
          {state.gearRow.map((gear) => (
            <li key={gear.id}>
              <span className="tt-list-icon" aria-hidden="true">
                {gear.icon}
              </span>
              <span>
                <b>{gear.name}</b>
                <small>{gear.text}</small>
              </span>
              <span className="tt-price">
                {gearCost(state, gear)}☀️{gearCost(state, gear) !== gear.cost && <s>{gear.cost}</s>}
              </span>
            </li>
          ))}
          <li className="tt-list-note">Bought at the Trail End{state.gearDiscountsLeft > 0 ? ` · ${state.gearDiscountsLeft} early discount left` : ''}</li>
        </ul>
      )}
      {tab === 'camps' && (
        <ul className="tt-list">
          {state.campsites.map((slot) => {
            const def = campsiteDef(slot.id);
            return (
              <li key={slot.id}>
                <span className="tt-list-icon" aria-hidden="true">
                  {def.icon}
                </span>
                <span>
                  <b>{def.name}</b>
                  <small>{def.text}</small>
                </span>
                <span className="tt-tents">
                  {slot.tents.map((owner, i) => (
                    <span key={i} className="tt-dot" style={{ '--seat': state.players[owner].color } as CSSProperties} />
                  ))}
                </span>
              </li>
            );
          })}
          <li className="tt-list-note">Reached from any tent site ⛺ instead of its action</li>
        </ul>
      )}
      {tab === 'log' && (
        <ol className="tt-list tt-log">
          {state.log
            .slice(-9)
            .reverse()
            .map((entry, i) => (
              <li key={state.log.length - i}>
                {entry.player >= 0 && (
                  <span className="tt-dot" style={{ '--seat': state.players[entry.player].color } as CSSProperties} aria-hidden="true" />
                )}
                <span>
                  {entry.player >= 0 && <b>{state.players[entry.player].name} </b>}
                  {entry.text}
                </span>
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- backpack */

function Backpack({ game, canAct }: { game: Game; canAct: boolean }) {
  const { state, dispatch } = game;
  const me = state.players[0];
  const info = useInfo();
  const tokens = tokenCount(me);
  const ready = new Set(usableBottles(me).map((b) => b.id));
  const flash = useCountFlashes({
    sun: me.resources.sun ?? 0,
    water: me.resources.water ?? 0,
    forest: me.resources.forest ?? 0,
    mountain: me.resources.mountain ?? 0,
    wild: me.resources.wild ?? 0,
  });
  const parkVp = me.parks.reduce((sum, p) => sum + p.vp, 0);

  return (
    <footer className="tt-tray" aria-label="Your backpack">
      <div className="tt-tray-group tt-tokens">
        {RESOURCES.map((r) => {
          const n = me.resources[r] ?? 0;
          const f = flash[r];
          return (
            <span key={`${r}${f?.at ?? ''}`} className={`tt-disc tt-disc-${r}${n === 0 ? ' zero' : ''}${f ? ` tt-disc-${f.dir}` : ''}`} title={`${n} ${RESOURCE_LABEL[r]}`}>
              <span aria-hidden="true">{RESOURCE_ICON[r]}</span>
              <b>{n}</b>
              {f && <i aria-hidden="true">{f.dir === 'up' ? '+' : '−'}{f.by}</i>}
            </span>
          );
        })}
        <span className={`tt-bag${tokens >= TOKEN_LIMIT ? ' full' : ''}`} title={`${tokens} of ${TOKEN_LIMIT} tokens`}>
          <span className="tt-bag-fill" style={{ width: `${(tokens / TOKEN_LIMIT) * 100}%` }} />
          <span className="tt-bag-text">
            {tokens}/{TOKEN_LIMIT}
          </span>
        </span>
      </div>

      <div className="tt-tray-group">
        <span className="tt-kit" title={`Campfire: ${me.campfires} of ${campfireAllowance(me)} alight`}>
          🔥<b>{me.campfires}</b>
        </span>
        <span className="tt-kit" title="Photos taken">
          📸<b>{me.photos}</b>
        </span>
        {state.cameraHolder === 0 && <span className="tt-kit tt-kit-on" title="You hold the camera">📷</span>}
        {state.firstPlayer === 0 && <span className="tt-kit tt-kit-on" title="You hold the first player token">1st</span>}
      </div>

      <div className="tt-tray-group">
        {me.bottles.map((bottle) => {
          const def = bottleDef(bottle.kind);
          const usable = canAct && ready.has(bottle.id);
          return (
            <button
              key={bottle.id}
              type="button"
              className={`tt-bottle${bottle.used ? ' used' : ''}${usable ? ' ready' : ''}`}
              disabled={bottle.used}
              onClick={() =>
                usable
                  ? dispatch({ type: 'use-bottle', bottleId: bottle.id })
                  : info.show({ title: def.name, icon: def.icon, lines: ['Converts 1 freshly drawn water, once a season.'] })
              }
              title={def.name}
            >
              <span aria-hidden="true">{def.icon}</span>
              {usable ? 'Use' : def.name.replace(/ Flask$/, '')}
            </button>
          );
        })}
        {me.gear.map((gear) => (
          <span key={gear.id} className="tt-mini-card" title={`${gear.name}: ${gear.text}`}>
            {gear.icon} {gear.name}
          </span>
        ))}
      </div>

      <div className="tt-tray-group tt-bonus">
        {bonusStanding(state, me).map(({ card, vp }) => (
          <button
            key={card.id}
            type="button"
            className="tt-bonus-card"
            onClick={() => info.show({ title: card.name, icon: '🎯', lines: [card.text, { label: 'Scoring now', value: `${vp} VP` }] })}
          >
            <b>{card.name}</b>
            <small>{card.text}</small>
          </button>
        ))}
      </div>

      <div className="tt-tray-group tt-mine">
        <span className="tt-stack" aria-label={`${me.parks.length} parks visited`}>
          {me.parks.length === 0 && me.reserved.length === 0 && <span className="tt-stack-empty">No parks yet</span>}
          {me.parks.map((park, i) => (
            <span key={park.id} className="tt-stack-card" style={{ '--i': i } as CSSProperties} title={`${park.name} · ${park.vp} VP`}>
              <ParkArt park={park} art={{}} />
            </span>
          ))}
          {me.reserved.map((park) => (
            <span key={park.id} className="tt-stack-card tt-stack-reserved" title={`Reserved: ${park.name}`}>
              <ParkArt park={park} art={{}} />
            </span>
          ))}
        </span>
        <span className="tt-score">
          <b>{parkVp + me.photos}</b>
          <small>VP showing</small>
        </span>
      </div>
    </footer>
  );
}
