import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
import { bonusStanding, parkProgress, seasonHaul, showingVp, SITE_VERB } from './insight';
import { GameOverlays, NewGameButton, SEASON_NAMES, useExplainSite, usePageSkin } from './shared';
import './passport.css';

/**
 * Concept D: the year is the story. The board as a park passport you fill in
 * over four seasons: each park visited is inked as a stamp dated by season,
 * reserved parks are pencilled in, the parks on offer are stamps still to
 * collect, and a strip of four pages shows how each traveller's year is going.
 */

const FONT = 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap';

/** Typed entries are set in Courier Prime, the way a passport office would fill one in. */
function usePassportFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT;
    document.head.appendChild(link);
  }, []);
}

export function Passport({ game }: { game: Game }) {
  const { state } = game;
  usePageSkin('parchment', state.season);
  usePassportFont();
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="pp">
      <header className="pp-cover">
        <div className="pp-cover-title">
          <span className="pp-emblem" aria-hidden="true">
            ✦
          </span>
          <span>
            <b>Passport</b>
            <small>Trailside Seasons · four seasons, one book</small>
          </span>
        </div>
        <div className="pp-cover-actions">
          <button type="button" onClick={game.undo} disabled={!game.canUndo}>
            Undo
          </button>
          <button type="button" onClick={() => setRulesOpen(true)}>
            Rules
          </button>
          <NewGameButton game={game} />
        </div>
      </header>

      <Year state={state} />

      <div className="pp-book">
        <section className="pp-page pp-left" aria-label="This season's itinerary">
          <Itinerary game={game} />
          <Ledger game={game} />
          <Travellers state={state} />
        </section>
        <section className="pp-page pp-right" aria-label="Your stamps">
          <Stamps state={state} />
          <OnOffer state={state} />
          <Endorsements state={state} />
        </section>
      </div>

      <BackPages state={state} />
      <GameOverlays game={game} rulesOpen={rulesOpen} onCloseRules={() => setRulesOpen(false)} />
    </div>
  );
}

/* --------------------------------------------------------------- the year */

function Year({ state }: { state: GameState }) {
  const hauls = state.players.map((p) => SEASON_NAMES.map((_, i) => seasonHaul(p, i + 1)));
  const scale = Math.max(6, ...hauls.flat());
  return (
    <section className="pp-year" aria-label="The year so far">
      {SEASON_NAMES.map((name, i) => {
        const season = i + 1;
        const when = season < state.season ? 'past' : season === state.season ? 'now' : 'later';
        return (
          <div key={name} className={`pp-season pp-season-${when}`} aria-current={when === 'now' ? 'step' : undefined}>
            <h2>
              {name}
              <span>{when === 'past' ? 'page closed' : when === 'now' ? (state.seasonCard?.name ?? 'in progress') : 'to come'}</span>
            </h2>
            {when === 'later' ? (
              <p className="pp-season-blank">Page {season} of {SEASONS}</p>
            ) : (
              <ul>
                {state.players.map((player, p) => (
                  <li key={player.index} style={{ '--seat': player.color } as CSSProperties}>
                    <span className="pp-dot" aria-hidden="true" />
                    <span className="pp-who">{player.isHuman ? 'You' : player.name}</span>
                    <span className="pp-bar" aria-hidden="true">
                      <span style={{ width: `${(hauls[p][i] / scale) * 100}%` }} />
                    </span>
                    <b>{hauls[p][i]}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      <div className="pp-season pp-season-total">
        <h2>
          Showing
          <span>parks and photos</span>
        </h2>
        <ul>
          {[...state.players]
            .sort((a, b) => showingVp(b) - showingVp(a))
            .map((player) => (
              <li key={player.index} style={{ '--seat': player.color } as CSSProperties}>
                <span className="pp-dot" aria-hidden="true" />
                <span className="pp-who">{player.isHuman ? 'You' : player.name}</span>
                <b>{showingVp(player)}</b>
              </li>
            ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- itinerary */

function Itinerary({ game }: { game: Game }) {
  const { state, moves, isHumanTurn, selectedHiker, setSelectedHiker, dispatch, lastCpuMove } = game;
  const canAct = isHumanTurn && !state.pending;
  const explain = useExplainSite(state);
  const box = useRef<HTMLOListElement>(null);
  useWalkingPawns(box, state, '.pp-pawn');
  const me = state.players[0];
  const active = state.players[state.current];
  const end = state.trail.length - 1;
  const home = state.players.flatMap((p) => p.hikers.filter((h) => h.finished).map((h) => h.id));
  const movable = [...new Set(moves.map((m) => m.hikerId))];
  // The first movable hiker stands in until one is chosen, so the lit stops never flicker.
  const hiker = selectedHiker ?? moves[0]?.hikerId ?? null;
  const hikerNumber = hiker ? me.hikers.findIndex((h) => h.id === hiker) + 1 : 0;

  let status: JSX.Element;
  if (state.phase !== 'playing') status = <span>{state.phase === 'season-end' ? 'Season over' : 'Year over'}</span>;
  else if (!isHumanTurn) status = <span>{active.name} is choosing…</span>;
  else if (state.pending) status = <span>Decide: {pendingLabel(state)}</span>;
  else
    status = (
      <span>
        Your turn
        {movable.length > 1 ? (
          <button type="button" className="pp-switch" onClick={game.cycleHiker}>
            Hiker {hikerNumber} ⇄
          </button>
        ) : (
          hikerNumber > 0 && <span className="pp-switch pp-static">Hiker {hikerNumber}</span>
        )}
      </span>
    );

  return (
    <div className="pp-itinerary">
      <h2 className="pp-page-head">
        Itinerary · {SEASON_NAMES[state.season - 1]}
        <span className={`pp-status${isHumanTurn ? ' pp-status-you' : ''}`} aria-live="polite">
          {status}
        </span>
      </h2>
      {state.seasonCard && (
        <p className="pp-card-line">
          <b>{state.seasonCard.name}.</b> {state.seasonCard.text}
        </p>
      )}
      <ol className="pp-route" ref={box}>
        {state.trail.map((kind, index) => {
          const def = siteDef(kind);
          const target = canAct ? moves.find((m) => m.to === index && m.hikerId === hiker) : undefined;
          const token = state.siteTokens[index];
          const pawns = [...occupants(state, index), ...(index === end ? home : [])];
          const just = lastCpuMove?.index === index ? state.players[lastCpuMove.player] : null;
          return (
            <li
              key={index}
              className={[
                'pp-stop',
                target ? 'pp-open' : '',
                target?.useCampfire ? 'pp-fire' : '',
                just ? 'pp-just' : '',
                def.tier === 'advanced' ? 'pp-adv' : '',
                index === 0 || index === end ? 'pp-terminus' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ '--just': just?.color } as CSSProperties}
            >
              <button
                type="button"
                className="pp-stop-face"
                onClick={() =>
                  target
                    ? dispatch({ type: 'move', hikerId: target.hikerId, to: target.to, useCampfire: target.useCampfire })
                    : explain(index)
                }
                aria-label={`${index === 0 ? 'Trailhead' : index === end ? 'Trail End' : `Stop ${index}`}: ${def.name}. ${def.text}${
                  token ? ` A ${token} season token is here.` : ''
                }${target ? ' Move here.' : ''}`}
              >
                <span className="pp-stop-num">{index === 0 ? 'Start' : index === end ? 'End' : `No. ${index}`}</span>
                <span className="pp-stop-icon" aria-hidden="true">
                  {def.icon}
                </span>
                <span className="pp-stop-name">{def.name}</span>
                <span className="pp-stop-verb">
                  {SITE_VERB[kind]}
                  {token && ` · +${RESOURCE_ICON[token]}`}
                  {hasTent(state, index) && ' · ⛺'}
                </span>
                {target && <span className="pp-stop-go">{target.useCampfire ? '🔥 Share' : 'Go'}</span>}
              </button>
              <span className="pp-stop-pawns">
                {pawns.map((id) => {
                  const owner = state.players[Number(id[1])];
                  const mine = owner.isHuman && canAct && !home.includes(id) && movable.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      data-hiker={id}
                      className={`pp-pawn${id === hiker ? ' pp-pawn-on' : ''}${home.includes(id) ? ' pp-pawn-home' : ''}`}
                      style={{ '--seat': owner.color } as CSSProperties}
                      disabled={!mine}
                      onClick={() => setSelectedHiker(id)}
                      aria-label={`${owner.name}'s hiker`}
                      title={`${owner.name}'s hiker`}
                    >
                      {owner.isHuman ? '🚶' : owner.name[0]}
                    </button>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ----------------------------------------------------------------- ledger */

function Ledger({ game }: { game: Game }) {
  const { state, isHumanTurn, dispatch } = game;
  const me = state.players[0];
  const info = useInfo();
  const canAct = isHumanTurn && !state.pending;
  const usable = new Set(usableBottles(me).map((b) => b.id));
  const tokens = tokenCount(me);

  return (
    <div className="pp-ledger">
      <h3>Carrying</h3>
      <dl className="pp-lines">
        {RESOURCES.map((r) => (
          <div key={r} className={(me.resources[r] ?? 0) === 0 ? 'zero' : ''}>
            <dt>
              {RESOURCE_ICON[r]} {RESOURCE_LABEL[r]}
            </dt>
            <dd>{me.resources[r] ?? 0}</dd>
          </div>
        ))}
        <div className={tokens >= TOKEN_LIMIT ? 'pp-full' : ''}>
          <dt>Pack</dt>
          <dd>
            {tokens} of {TOKEN_LIMIT}
          </dd>
        </div>
      </dl>
      <ul className="pp-kit">
        <li title={`${me.campfires} of ${campfireAllowance(me)} campfires alight`}>
          🔥 {me.campfires}/{campfireAllowance(me)}
        </li>
        <li>📸 {me.photos}</li>
        {state.cameraHolder === 0 && <li className="pp-kit-on">📷 camera</li>}
        {state.firstPlayer === 0 && <li className="pp-kit-on">1st player</li>}
        {me.bottles.map((bottle) => {
          const def = bottleDef(bottle.kind);
          const ok = canAct && usable.has(bottle.id);
          return (
            <li key={bottle.id} className={bottle.used ? 'used' : ''}>
              <button
                type="button"
                className={ok ? 'pp-use' : ''}
                disabled={bottle.used}
                onClick={() =>
                  ok
                    ? dispatch({ type: 'use-bottle', bottleId: bottle.id })
                    : info.show({ title: def.name, icon: def.icon, lines: ['Converts 1 freshly drawn water, once a season.'] })
                }
              >
                {def.icon} {ok ? `Use ${def.name}` : def.name}
              </button>
            </li>
          );
        })}
        {me.gear.map((gear) => (
          <li key={gear.id} title={gear.text}>
            {gear.icon} {gear.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------- travellers */

function Travellers({ state }: { state: GameState }) {
  return (
    <div className="pp-travellers">
      <h3>Fellow travellers</h3>
      <ul>
        {state.players
          .filter((p) => !p.isHuman)
          .map((player) => {
            const active = state.current === player.index && state.phase === 'playing';
            const walking = player.hikers.filter((h) => !h.finished).length;
            return (
              <li key={player.index} className={active ? 'on' : ''} style={{ '--seat': player.color } as CSSProperties}>
                <span className="pp-photo" aria-hidden="true">
                  {player.name[0]}
                </span>
                <span className="pp-traveller">
                  <b>
                    {player.name}
                    {state.cameraHolder === player.index && ' 📷'}
                    {state.firstPlayer === player.index && ' · 1st'}
                  </b>
                  <small>
                    {showingVp(player)} VP · {player.reserved.length > 0 && `${player.reserved.length} reserved · `}
                    {active ? 'moving' : walking === 0 ? 'home' : `${walking} walking`}
                  </small>
                </span>
                <span className="pp-mini-stamps" aria-label={`${player.parks.length} parks`}>
                  {player.parks.map((park) => (
                    <span key={park.id} className="pp-mini" title={park.name}>
                      <ParkArt park={park} art={{}} />
                    </span>
                  ))}
                  {player.parks.length === 0 && <small>no stamps</small>}
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------------- stamps */

const INKS = ['#1f4e8c', '#a8322a', '#2d6a4f', '#5b3f8c', '#7a4a1d', '#0f6b73'];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** A rubber stamp: the park's picture in a ring of its name, inked or pencilled in. */
function Stamp({ park, season, mode }: { park: ParkCard; season?: number; mode: 'inked' | 'pencil' }) {
  const id = `pp-arc-${park.id}`;
  const h = hash(park.id);
  const name = park.name.toUpperCase();
  const size = Math.min(9.5, 118 / (name.length * 0.64));
  const bottom = mode === 'inked' ? `${SEASON_NAMES[(season ?? 1) - 1].toUpperCase()} · ${park.vp} VP` : `RESERVED · ${park.vp} VP`;
  return (
    <figure
      className={`pp-stamp pp-stamp-${mode}`}
      style={{ '--tilt': `${(h % 15) - 7}deg`, '--ink': INKS[h % INKS.length] } as CSSProperties}
    >
      <span className="pp-stamp-art">
        <ParkArt park={park} art={{}} />
      </span>
      <svg viewBox="0 0 100 100" className="pp-stamp-ring" aria-hidden="true">
        <defs>
          <path id={`${id}-top`} d="M 13,50 A 37,37 0 1,1 87,50" />
          <path id={`${id}-bottom`} d="M 8,50 A 42,42 0 0,0 92,50" />
        </defs>
        <circle cx="50" cy="50" r="48" className="pp-ring-outer" />
        <circle cx="50" cy="50" r="45.5" className="pp-ring-thin" />
        <circle cx="50" cy="50" r="31" className="pp-ring-inner" />
        <text style={{ fontSize: `${size}px` }}>
          <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
            {name}
          </textPath>
        </text>
        <text className="pp-ring-small">
          <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">
            {bottom}
          </textPath>
        </text>
      </svg>
      <figcaption className="pp-sr">
        {park.name}, {mode === 'inked' ? `visited in ${SEASON_NAMES[(season ?? 1) - 1]}` : 'reserved'}, {park.vp} VP
      </figcaption>
    </figure>
  );
}

function Stamps({ state }: { state: GameState }) {
  const me = state.players[0];
  const info = useInfo();
  const filled = me.parks.length + me.reserved.length;
  const blanks = Math.max(0, Math.max(6, filled + 1) - filled);
  const parkVp = me.parks.reduce((sum, p) => sum + p.vp, 0);

  return (
    <div className="pp-stamps">
      <h2 className="pp-page-head">
        Stamps
        <span>
          {me.parks.length} visited · {parkVp} VP
        </span>
      </h2>
      <div className="pp-stamp-grid">
        {me.parks.map((park, i) => (
          <button
            key={park.id}
            type="button"
            className="pp-stamp-slot"
            onClick={() => info.show({ title: park.name, icon: '🏞️', lines: parkLines(park, `Visited in ${SEASON_NAMES[me.claimedInSeason[i] - 1]}`) })}
          >
            <Stamp park={park} season={me.claimedInSeason[i]} mode="inked" />
          </button>
        ))}
        {me.reserved.map((park) => {
          const progress = parkProgress(state, me, park);
          return (
            <button
              key={park.id}
              type="button"
              className={`pp-stamp-slot${progress.ready ? ' pp-slot-ready' : ''}`}
              onClick={() =>
                info.show({
                  title: park.name,
                  icon: '✏️',
                  lines: parkLines(park, progress.ready ? 'Reserved, and you can pay for it now' : `Reserved · ${progress.short} short`),
                })
              }
            >
              <Stamp park={park} mode="pencil" />
              <span className="pp-slot-note">{progress.ready ? 'ready to ink' : `${progress.short} short`}</span>
            </button>
          );
        })}
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`blank${i}`} className="pp-stamp-slot pp-blank" aria-hidden="true">
            {i === 0 && filled === 0 && 'Visit a park to ink your first stamp'}
          </span>
        ))}
      </div>
    </div>
  );
}

function parkLines(park: ParkCard, note: string) {
  return [
    note,
    { label: 'Worth', value: `${park.vp} VP` },
    { label: 'Cost', value: costLabel(park.cost) },
    { label: 'State', value: park.state },
    { label: 'Terrain', value: park.tags.join(', ') },
  ];
}

/* ---------------------------------------------------------------- on offer */

function OnOffer({ state }: { state: GameState }) {
  const me = state.players[0];
  const info = useInfo();
  const bison = bisonPark(state);
  return (
    <div className="pp-offer">
      <h3>
        Stamps on offer <span>{parkDeckLeft(state)} more in the deck</span>
      </h3>
      <div className="pp-postage-row">
        {state.parkRow.map((park) => {
          const progress = parkProgress(state, me, park);
          return (
            <button
              key={park.id}
              type="button"
              className={`pp-postage${progress.ready ? ' pp-postage-ready' : ''}`}
              onClick={() =>
                info.show({
                  title: park.name,
                  icon: '🏞️',
                  lines: [
                    ...parkLines(park, progress.ready ? 'You can pay for it now' : `${progress.short} short`),
                    ...(bison?.id === park.id ? ['The bison is here: visiting trades a resource for a wildcard.'] : []),
                  ],
                })
              }
            >
              <span className="pp-postage-face">
                <span className="pp-postage-art">
                  <ParkArt park={park} art={{}} />
                  <span className="pp-denom">{park.vp}</span>
                  {bison?.id === park.id && <span className="pp-bison">🦬</span>}
                </span>
                <span className="pp-postage-name">{park.name}</span>
                <span className="pp-pips">
                  {progress.pips.map((pip, i) => (
                    <span key={i} className={`pp-pip pp-pip-${pip.state}`}>
                      {RESOURCE_ICON[pip.resource]}
                    </span>
                  ))}
                </span>
                <span className="pp-postage-note">{progress.ready ? 'Within reach' : `${progress.short} short`}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- endorsements */

function Endorsements({ state }: { state: GameState }) {
  const me: Player = state.players[0];
  return (
    <div className="pp-endorse">
      <h3>
        Endorsements <span>your bonus cards, scored at year end</span>
      </h3>
      <ul>
        {bonusStanding(state, me).map(({ card, vp }) => (
          <li key={card.id}>
            <span className="pp-seal" aria-hidden="true">
              ✦
            </span>
            <span>
              <b>{card.name}</b>
              <small>{card.text}</small>
            </span>
            <span className={`pp-endorse-vp${vp > 0 ? ' on' : ''}`}>
              {vp}
              <small>VP now</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------- back pages */

function BackPages({ state }: { state: GameState }) {
  const sun = state.players[0].resources.sun ?? 0;
  return (
    <section className="pp-back" aria-label="Gear, campsites and notes">
      <div className="pp-back-page">
        <h3>
          Outfitter <span>gear, bought at the Trail End</span>
        </h3>
        <ul className="pp-list">
          {state.gearRow.map((gear) => {
            const cost = gearCost(state, gear);
            return (
              <li key={gear.id} className={sun >= cost ? 'afford' : ''}>
                <span aria-hidden="true">{gear.icon}</span>
                <span>
                  <b>{gear.name}</b>
                  <small>{gear.text}</small>
                </span>
                <span className="pp-price">
                  {cost}☀️{cost !== gear.cost && <s>{gear.cost}</s>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {state.campsites.length > 0 && (
        <div className="pp-back-page">
          <h3>
            Campsites <span>from any tent site ⛺</span>
          </h3>
          <ul className="pp-list">
            {state.campsites.map((slot) => {
              const def = campsiteDef(slot.id);
              return (
                <li key={slot.id}>
                  <span aria-hidden="true">{def.icon}</span>
                  <span>
                    <b>{def.name}</b>
                    <small>{def.text}</small>
                  </span>
                  <span className="pp-tents">
                    {slot.tents.map((owner, i) => (
                      <span key={i} className="pp-dot" style={{ '--seat': state.players[owner].color } as CSSProperties} />
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="pp-back-page pp-notes">
        <h3>Notes</h3>
        <ol>
          {state.log
            .slice(-10)
            .reverse()
            .map((entry, i) => (
              <li key={state.log.length - i}>
                <span className="pp-note-season">{SEASON_NAMES[entry.season - 1]?.slice(0, 3)}</span>
                <span>
                  {entry.player >= 0 && <b>{state.players[entry.player].name} </b>}
                  {entry.text}
                </span>
              </li>
            ))}
        </ol>
      </div>
    </section>
  );
}
