import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Game, Speed } from '../hooks/useGame';
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
import { RESOURCES, type GameState, type LogEntry, type Player } from '../game/types';
import { RESOURCE_ICON, RESOURCE_LABEL, costLabel } from '../components/Bits';
import { ParkArt } from '../components/ParkCardView';
import { useInfo } from '../components/InfoSheet';
import { useWalkingPawns } from '../components/TrailView';
import { bonusStanding, contenders, lastOwnEntry, parkProgress, showingVp, SITE_VERB } from './insight';
import { GameOverlays, NewGameButton, SEASON_NAMES, useExplainSite, usePageSkin } from './shared';
import './broadcast.css';

/**
 * Concept E: make the other players' turns worth watching. With four seats,
 * three turns in four belong to someone else, and the current board reports
 * them as a log line and a flash. Here the trail is a race grid, one lane per
 * player, so position and blocking read at a glance; a play-by-play turns each
 * move into a call with a recap of what happened while you waited; and every
 * park in the row says who can already pay for it.
 */

const FONT = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&display=swap';

/** Broadcast graphics are set in a condensed grotesque, Barlow Condensed. */
function useBroadcastFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT;
    document.head.appendChild(link);
  }, []);
}

export function Broadcast({ game }: { game: Game }) {
  const { state } = game;
  usePageSkin('nightfall', state.season);
  useBroadcastFont();
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="bc">
      <Scorebug game={game} onRules={() => setRulesOpen(true)} />
      <div className="bc-main">
        <div className="bc-stage">
          <RaceGrid game={game} />
          <Contest state={state} />
        </div>
        <Feed state={state} />
      </div>
      <LowerThird game={game} />
      <GameOverlays game={game} rulesOpen={rulesOpen} onCloseRules={() => setRulesOpen(false)} />
    </div>
  );
}

/* ----------------------------------------------------------------- scorebug */

/** Who moves from here, in order, leaving out anyone already home for the season. */
function turnOrder(state: GameState): Player[] {
  if (state.phase !== 'playing') return [];
  const n = state.players.length;
  return Array.from({ length: n }, (_, step) => state.players[(state.current + step) % n]).filter(
    (p) => !p.hikers.every((h) => h.finished),
  );
}

const SPEEDS: [Speed, string][] = [
  ['slow', 'Slow'],
  ['normal', 'Normal'],
  ['fast', 'Fast'],
];

function Scorebug({ game, onRules }: { game: Game; onRules: () => void }) {
  const { state, isHumanTurn } = game;
  const order = turnOrder(state);

  return (
    <header className="bc-bug">
      <div className="bc-bug-season">
        <span className="bc-live" aria-hidden="true">
          On the trail
        </span>
        <b>{SEASON_NAMES[state.season - 1]}</b>
        <span>
          {state.season}/{SEASONS}
        </span>
      </div>
      <ol className="bc-order" aria-label="Turn order">
        {order.map((player, i) => (
          <li
            key={player.index}
            className={`${i === 0 ? 'now' : ''}${player.isHuman ? ' you' : ''}`}
            style={{ '--seat': player.color } as CSSProperties}
          >
            <small>{i === 0 ? (state.pending ? 'deciding' : 'on the clock') : i === 1 ? 'next' : 'then'}</small>
            <b>{player.isHuman ? 'You' : player.name}</b>
          </li>
        ))}
        {order.length === 0 && (
          <li className="now">
            <small>break</small>
            <b>{state.phase === 'game-over' ? 'Final' : 'Season over'}</b>
          </li>
        )}
      </ol>
      <div className="bc-bug-tools">
        <div className="bc-speed" role="radiogroup" aria-label="CPU speed">
          {SPEEDS.map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={game.speed === id} className={game.speed === id ? 'on' : ''} onClick={() => game.setSpeed(id)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={game.undo} disabled={!game.canUndo}>
          Undo
        </button>
        <button type="button" onClick={onRules}>
          Rules
        </button>
        <NewGameButton game={game} />
      </div>
      {state.seasonCard && (
        <p className="bc-bug-card">
          <b>{state.seasonCard.name}</b> {state.seasonCard.text}
          {isHumanTurn && state.pending && <span className="bc-bug-decide">Your decision: {pendingLabel(state)}</span>}
        </p>
      )}
    </header>
  );
}

/* ---------------------------------------------------------------- race grid */

function RaceGrid({ game }: { game: Game }) {
  const { state, moves, isHumanTurn, selectedHiker, setSelectedHiker, dispatch, lastCpuMove } = game;
  const canAct = isHumanTurn && !state.pending;
  const explain = useExplainSite(state);
  const box = useRef<HTMLDivElement>(null);
  useWalkingPawns(box, state, '.bc-pawn');
  const end = state.trail.length - 1;
  const movable = new Set(moves.map((m) => m.hikerId));
  // The first movable hiker stands in until one is chosen, so the lit squares never flicker.
  const hiker = selectedHiker ?? moves[0]?.hikerId ?? null;
  const blocked = state.trail.map((_, i) => i > 0 && i < end && occupants(state, i).length > 0);

  // Bring your nearest target into view when the grid is wider than the screen.
  const first = canAct ? moves.filter((m) => m.hikerId === hiker).map((m) => m.to).sort((a, b) => a - b)[0] : undefined;
  useEffect(() => {
    const root = box.current;
    if (first === undefined || !root || root.scrollWidth <= root.clientWidth) return;
    const cell = root.querySelector<HTMLElement>(`[data-col="${first}"]`);
    const lane = root.querySelector<HTMLElement>('.bc-corner')?.offsetWidth ?? 0;
    if (cell) root.scrollTo({ left: Math.max(0, cell.offsetLeft - lane - 90), behavior: 'smooth' });
  }, [first]);

  return (
    <section className="bc-panel bc-race" aria-label="Race grid">
      <h2 className="bc-title">
        The race <span>one lane per player · a lit square is a move · hatched sites are taken</span>
      </h2>
      <div className="bc-grid-wrap" ref={box}>
        <table className="bc-grid" style={{ '--n': state.trail.length } as CSSProperties}>
          <thead>
            <tr>
              <th scope="col" className="bc-corner">
                Site
              </th>
              {state.trail.map((kind, index) => {
                const def = siteDef(kind);
                const token = state.siteTokens[index];
                return (
                  <th
                    key={index}
                    scope="col"
                    data-col={index}
                    className={`bc-site${blocked[index] ? ' bc-taken' : ''}${def.tier === 'advanced' ? ' bc-adv' : ''}`}
                  >
                    <button type="button" onClick={() => explain(index)} title={`${def.name}: ${def.text}`}>
                      <span className="bc-site-num">{index === 0 ? 'Start' : index === end ? 'End' : index}</span>
                      <span className="bc-site-icon" aria-hidden="true">
                        {def.icon}
                      </span>
                      <span className="bc-site-name">{def.name}</span>
                      <span className="bc-site-verb">
                        {SITE_VERB[kind]}
                        {token && <span className={`bc-token bc-token-${token}`}>+{RESOURCE_ICON[token]}</span>}
                        {hasTent(state, index) && ' ⛺'}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {state.players.map((player) => {
              const active = state.current === player.index && state.phase === 'playing';
              const walking = player.hikers.filter((h) => !h.finished).length;
              return (
                <tr
                  key={player.index}
                  className={`${active ? 'bc-on' : ''}${player.isHuman ? ' bc-you' : ''}`}
                  style={{ '--seat': player.color } as CSSProperties}
                >
                  <th scope="row" className="bc-lane">
                    <span className="bc-lane-name">
                      <span className="bc-dot" aria-hidden="true" />
                      {player.isHuman ? 'You' : player.name}
                      <b>{showingVp(player)}</b>
                    </span>
                    <small>
                      🔥{player.campfires} · {tokenCount(player)} token{tokenCount(player) === 1 ? '' : 's'} ·{' '}
                      {active ? 'moving' : walking === 0 ? 'home' : `${walking} out`}
                      {state.cameraHolder === player.index && ' · 📷'}
                      {state.firstPlayer === player.index && ' · 1st'}
                    </small>
                  </th>
                  {state.trail.map((_, index) => {
                    const hikers = player.hikers.filter((h) => h.position === index && (index === end || !h.finished));
                    const target = player.isHuman && canAct ? moves.find((m) => m.to === index && m.hikerId === hiker) : undefined;
                    const just = lastCpuMove?.index === index && lastCpuMove.player === player.index;
                    return (
                      <td
                        key={index}
                        className={[blocked[index] ? 'bc-taken' : '', target ? 'bc-open' : '', target?.useCampfire ? 'bc-fire' : '', just ? 'bc-just' : '']
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {target && (
                          <button
                            type="button"
                            className="bc-go"
                            onClick={() => dispatch({ type: 'move', hikerId: target.hikerId, to: target.to, useCampfire: target.useCampfire })}
                            aria-label={`Move to ${siteDef(state.trail[index]).name}${target.useCampfire ? ', spending your campfire' : ''}`}
                          >
                            {target.useCampfire ? '🔥' : 'Go'}
                          </button>
                        )}
                        {hikers.map((h) => {
                          const mine = player.isHuman && canAct && movable.has(h.id);
                          return (
                            <button
                              key={h.id}
                              type="button"
                              data-hiker={h.id}
                              className={`bc-pawn${h.id === hiker ? ' bc-pawn-on' : ''}${h.finished ? ' bc-pawn-home' : ''}`}
                              disabled={!mine}
                              onClick={() => setSelectedHiker(h.id)}
                              aria-label={`${player.name}'s hiker ${player.hikers.indexOf(h) + 1}${h.finished ? ', home' : ''}`}
                            >
                              {player.isHuman ? player.hikers.indexOf(h) + 1 : player.name[0]}
                            </button>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ contest */

function Contest({ state }: { state: GameState }) {
  const me = state.players[0];
  const info = useInfo();
  const bison = bisonPark(state);
  const parks = [...me.reserved, ...state.parkRow];

  return (
    <section className="bc-panel bc-contest" aria-label="Parks in contention">
      <h2 className="bc-title">
        In contention <span>who can pay for each park right now · {parkDeckLeft(state)} in the deck</span>
      </h2>
      <ul className="bc-parks">
        {parks.map((park) => {
          const mine = me.reserved.some((r) => r.id === park.id);
          const can = contenders(state, park);
          const rivals = can.filter((p) => !p.isHuman);
          const progress = parkProgress(state, me, park);
          return (
            <li key={park.id} className={`bc-park${rivals.length > 0 ? ' bc-contested' : ''}${progress.ready ? ' bc-ready' : ''}`}>
              <button
                type="button"
                className="bc-park-art"
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
                aria-label={`About ${park.name}`}
              >
                <ParkArt park={park} art={{}} />
                <span className="bc-park-vp">{park.vp}</span>
                {bison?.id === park.id && <span className="bc-bison">🦬</span>}
              </button>
              <span className="bc-park-body">
                <b>
                  {park.name}
                  {mine && <small> · your reservation</small>}
                </b>
                <span className="bc-pips" aria-label={`Your progress: ${progress.ready ? 'ready' : `${progress.short} short`}`}>
                  {progress.pips.map((pip, i) => (
                    <span key={i} className={`bc-pip bc-pip-${pip.state}`}>
                      {RESOURCE_ICON[pip.resource]}
                    </span>
                  ))}
                </span>
                <span className="bc-can">
                  {can.length === 0 ? (
                    <small>Nobody can pay yet</small>
                  ) : (
                    <>
                      <small>Can pay now</small>
                      {can.map((p) => (
                        <span key={p.index} className="bc-chip" style={{ '--seat': p.color } as CSSProperties}>
                          {p.isHuman ? 'You' : p.name}
                        </span>
                      ))}
                    </>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="bc-shops">
        <div>
          <h3>Gear shop</h3>
          <ul>
            {state.gearRow.map((gear) => {
              const cost = gearCost(state, gear);
              return (
                <li key={gear.id} title={gear.text}>
                  <span aria-hidden="true">{gear.icon}</span> {gear.name}
                  <b>
                    {cost}☀️{cost !== gear.cost && <s>{gear.cost}</s>}
                  </b>
                </li>
              );
            })}
          </ul>
        </div>
        {state.campsites.length > 0 && (
          <div>
            <h3>Campsites</h3>
            <ul>
              {state.campsites.map((slot) => {
                const def = campsiteDef(slot.id);
                return (
                  <li key={slot.id} title={def.text}>
                    <span aria-hidden="true">{def.icon}</span> {def.name}
                    <span className="bc-tents">
                      {slot.tents.map((owner, i) => (
                        <span key={i} className="bc-dot" style={{ '--seat': state.players[owner].color } as CSSProperties} />
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- feed */

/** The kind of play a log line reports, for its icon and its weight in the feed. */
function playKind(entry: LogEntry): { icon: string; big: boolean } {
  const text = entry.text;
  if (entry.player < 0) return { icon: '🗓️', big: false };
  if (text.startsWith('visited') || text.includes('and visited')) return { icon: '🏞️', big: true };
  if (text.startsWith('reserved')) return { icon: '📌', big: true };
  if (text.startsWith('took a photo')) return { icon: '📸', big: false };
  if (text.startsWith('took the camera') || text.startsWith('picked up the camera')) return { icon: '📷', big: true };
  if (text.startsWith('bought')) return { icon: '🎒', big: true };
  if (text.startsWith('camped')) return { icon: '⛺', big: false };
  if (text.includes('traded')) return { icon: '🔄', big: false };
  if (text.includes('campfire')) return { icon: '🔥', big: false };
  if (text.startsWith('moved') || text.startsWith('copied') || text.startsWith('arrived') || text.startsWith('reached')) return { icon: '🥾', big: false };
  return { icon: '•', big: false };
}

function Feed({ state }: { state: GameState }) {
  const mark = lastOwnEntry(state, 0);
  const first = Math.max(0, state.log.length - 40);
  const entries = state.log.map((entry, i) => ({ entry, i })).slice(first).reverse();
  const since = state.log.slice(mark + 1).filter((e) => e.player > 0);
  const missed = since.filter((e) => playKind(e).big);

  return (
    <aside className="bc-panel bc-feed" aria-label="Play-by-play">
      <h2 className="bc-title">Play-by-play</h2>
      {mark >= 0 && since.length > 0 && (
        <div className="bc-recap">
          <small>While you waited</small>
          {missed.length === 0 ? (
            <p>
              {since.length} plays, and nothing changed hands: no park visited or reserved, no gear bought, the camera where it was.
            </p>
          ) : (
            <ul>
              {missed.map((e, i) => (
                <li key={i} style={{ '--seat': state.players[e.player].color } as CSSProperties}>
                  <b>{state.players[e.player].name}</b> {e.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <ol className="bc-calls" aria-live="polite">
        {entries.map(({ entry, i }) => {
          const kind = playKind(entry);
          const player = entry.player >= 0 ? state.players[entry.player] : null;
          return (
            <Fragment key={i}>
              <li
                className={`bc-call${kind.big ? ' bc-big' : ''}${player ? '' : ' bc-sys'}${player?.isHuman ? ' bc-call-you' : ''}`}
                style={{ '--seat': player?.color ?? 'transparent' } as CSSProperties}
              >
                <span className="bc-call-icon" aria-hidden="true">
                  {kind.icon}
                </span>
                <span>
                  {player && <b>{player.isHuman ? 'You' : player.name} </b>}
                  {entry.text}
                </span>
              </li>
              {i === mark + 1 && mark >= 0 && (
                <li className="bc-divider" aria-hidden="true">
                  <span>↑ since your last move</span>
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </aside>
  );
}

/* --------------------------------------------------------------- lower third */

function LowerThird({ game }: { game: Game }) {
  const { state, isHumanTurn, dispatch } = game;
  const me = state.players[0];
  const info = useInfo();
  const canAct = isHumanTurn && !state.pending;
  const usable = new Set(usableBottles(me).map((b) => b.id));
  const tokens = tokenCount(me);

  return (
    <footer className="bc-third" aria-label="Your pack">
      <div className="bc-third-name" style={{ '--seat': me.color } as CSSProperties}>
        <span className="bc-dot" aria-hidden="true" />
        <b>You</b>
        <span className="bc-third-vp">
          {showingVp(me)}
          <small>VP showing</small>
        </span>
      </div>
      <div className="bc-third-res">
        {RESOURCES.map((r) => (
          <span key={r} className={(me.resources[r] ?? 0) === 0 ? 'zero' : ''} title={RESOURCE_LABEL[r]}>
            <span aria-hidden="true">{RESOURCE_ICON[r]}</span>
            {me.resources[r] ?? 0}
          </span>
        ))}
        <span className={`bc-meter${tokens >= TOKEN_LIMIT ? ' full' : ''}`} title={`${tokens} of ${TOKEN_LIMIT} tokens`}>
          <span style={{ width: `${(tokens / TOKEN_LIMIT) * 100}%` }} />
          <b>
            {tokens}/{TOKEN_LIMIT}
          </b>
        </span>
      </div>
      <div className="bc-third-extra">
        <div className="bc-third-kit">
          <span title={`${me.campfires} of ${campfireAllowance(me)} campfires alight`}>🔥 {me.campfires}</span>
          <span>📸 {me.photos}</span>
          {me.bottles.map((bottle) => {
            const def = bottleDef(bottle.kind);
            const ok = canAct && usable.has(bottle.id);
            return (
              <button
                key={bottle.id}
                type="button"
                className={`bc-flask${ok ? ' ready' : ''}${bottle.used ? ' used' : ''}`}
                disabled={bottle.used}
                onClick={() =>
                  ok
                    ? dispatch({ type: 'use-bottle', bottleId: bottle.id })
                    : info.show({ title: def.name, icon: def.icon, lines: ['Converts 1 freshly drawn water, once a season.'] })
                }
              >
                {def.icon} {ok ? 'Use' : def.name.replace(/ Flask$/, '')}
              </button>
            );
          })}
          {me.gear.map((gear) => (
            <span key={gear.id} title={gear.text}>
              {gear.icon} {gear.name}
            </span>
          ))}
        </div>
        <div className="bc-third-bonus">
          {bonusStanding(state, me).map(({ card, vp }) => (
            <button
              key={card.id}
              type="button"
              onClick={() => info.show({ title: card.name, icon: '🎯', lines: [card.text, { label: 'Scoring now', value: `${vp} VP` }] })}
            >
              🎯 {card.name} <b>{vp}</b>
            </button>
          ))}
          {me.parks.length > 0 && (
            <span className="bc-third-parks">
              {me.parks.map((park) => (
                <span key={park.id} title={`${park.name} · ${park.vp} VP`}>
                  <ParkArt park={park} art={{}} />
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
