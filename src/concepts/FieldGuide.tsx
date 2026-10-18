import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Game } from '../hooks/useGame';
import {
  bottleDef,
  campfireAllowance,
  campsiteDef,
  canClaim,
  gearCost,
  occupants,
  pendingLabel,
  SEASONS,
  siteDef,
  tokenCount,
  usableBottles,
} from '../game/engine';
import { parkDeckLeft } from '../game/view';
import { TOKEN_LIMIT } from '../game/data/sites';
import { RESOURCES, type GameState, type Player, type ResourceBag } from '../game/types';
import { RESOURCE_ICON, RESOURCE_LABEL } from '../components/Bits';
import { ParkArt } from '../components/ParkCardView';
import { useInfo } from '../components/InfoSheet';
import { SiteArt } from '../art/siteArt';
import {
  bonusStanding,
  goalParks,
  parkProgress,
  previewMove,
  showingVp,
  SITE_VERB,
  type MovePreview,
  type ParkProgress,
} from './insight';
import { GameOverlays, NewGameButton, SEASON_NAMES, useExplainSite, usePageSkin } from './shared';
import './field-guide.css';

/**
 * Concept B: every move shows its consequences. The screen is built around
 * the one question a turn asks: where should this hiker go? Each reachable
 * site says what it pays and which parks it brings within reach, and pointing
 * at one previews the pack and the goals as they would stand after it.
 */

type Pane = 'move' | 'goals' | 'table';

const FONT = 'https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap';

/** The field guide sets its data in Public Sans, the US government's own typeface. */
function useFieldGuideFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT;
    document.head.appendChild(link);
  }, []);
}

export function FieldGuide({ game }: { game: Game }) {
  const { state, moves, isHumanTurn, selectedHiker } = game;
  usePageSkin('auto', state.season);
  useFieldGuideFont();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [pane, setPane] = useState<Pane>('move');
  const [hover, setHover] = useState<number | null>(null);
  const canAct = isHumanTurn && !state.pending;

  const hiker = selectedHiker ?? moves[0]?.hikerId ?? null;
  const previews = useMemo(
    () => (canAct ? moves.filter((m) => m.hikerId === hiker).map((m) => previewMove(state, m)) : []),
    [state, moves, hiker, canAct],
  );
  const previewed = previews.find((p) => p.option.to === hover) ?? null;
  // A preview only means anything for the board it was worked out on.
  useEffect(() => setHover(null), [state]);

  const ready = goalParks(state, 0).filter((park) => canClaim(state, state.players[0], park)).length;

  return (
    <div className="fg" data-pane={pane}>
      <header className="fg-head">
        <div className="fg-brand">
          <span className="fg-mark" aria-hidden="true">
            ▲
          </span>
          <span>
            Trailside Seasons
            <small>Field guide</small>
          </span>
        </div>
        <SeasonGauge state={state} />
        <div className="fg-actions">
          <button type="button" onClick={game.undo} disabled={!game.canUndo}>
            Undo
          </button>
          <button type="button" onClick={() => setRulesOpen(true)}>
            Rules
          </button>
          <NewGameButton game={game} />
        </div>
      </header>

      <Standings state={state} />

      <main className="fg-main">
        <section className="fg-col fg-move" data-for="move" aria-label="Your move">
          <MoveHeader game={game} hiker={hiker} />
          <RouteLine game={game} previews={previews} hover={hover} onHover={setHover} hiker={hiker} />
          {canAct ? (
            <OptionList game={game} previews={previews} hover={hover} onHover={setHover} />
          ) : (
            <Waiting state={state} />
          )}
        </section>

        <section className="fg-col fg-goals" data-for="goals" aria-label="Your pack and goals">
          <Pack game={game} delta={previewed?.delta ?? {}} canAct={canAct} />
          <Goals state={state} delta={previewed?.delta ?? {}} previewing={previewed !== null} />
          <Objectives state={state} />
        </section>

        <section className="fg-col fg-table" data-for="table" aria-label="Gear, campsites and log">
          <Shop state={state} />
          <Log state={state} />
        </section>
      </main>

      <nav className="fg-tabs" aria-label="Sections">
        {(
          [
            ['move', 'Move', canAct ? previews.length : 0],
            ['goals', 'Goals', ready],
            ['table', 'Table', 0],
          ] as [Pane, string, number][]
        ).map(([id, label, count]) => (
          <button key={id} type="button" className={pane === id ? 'on' : ''} aria-pressed={pane === id} onClick={() => setPane(id)}>
            {label}
            {count > 0 && <span className="fg-tab-count">{count}</span>}
          </button>
        ))}
      </nav>

      <GameOverlays game={game} rulesOpen={rulesOpen} onCloseRules={() => setRulesOpen(false)} />
    </div>
  );
}

/* ------------------------------------------------------------------ header */

function SeasonGauge({ state }: { state: GameState }) {
  return (
    <div className="fg-season">
      <div className="fg-season-name">
        <b>{SEASON_NAMES[state.season - 1]}</b>
        <span>
          season {state.season} of {SEASONS} · {state.trail.length - 2} sites
        </span>
      </div>
      <span className="fg-gauge" aria-hidden="true">
        {SEASON_NAMES.map((name, i) => (
          <span key={name} className={i + 1 < state.season ? 'done' : i + 1 === state.season ? 'now' : ''} />
        ))}
      </span>
      {state.seasonCard && (
        <p className="fg-season-card">
          <b>{state.seasonCard.name}.</b> {state.seasonCard.text}
        </p>
      )}
    </div>
  );
}

function Standings({ state }: { state: GameState }) {
  const scores = state.players.map((p) => showingVp(p));
  const scale = Math.max(12, ...scores);
  return (
    <section className="fg-standings" aria-label="Standings">
      {state.players.map((player) => {
        const active = state.current === player.index && state.phase === 'playing';
        const walking = player.hikers.filter((h) => !h.finished).length;
        return (
          <div
            key={player.index}
            className={`fg-lane${active ? ' fg-lane-active' : ''}${player.isHuman ? ' fg-lane-you' : ''}`}
            style={{ '--seat': player.color } as CSSProperties}
          >
            <span className="fg-lane-name">
              <span className="fg-dot" aria-hidden="true" />
              {player.name}
              {state.firstPlayer === player.index && <span className="fg-chip">1st</span>}
              {state.cameraHolder === player.index && <span className="fg-chip">📷</span>}
            </span>
            <span className="fg-lane-track" aria-hidden="true">
              <span style={{ width: `${(showingVp(player) / scale) * 100}%` }} />
            </span>
            <span className="fg-lane-vp">{showingVp(player)}</span>
            <span className="fg-lane-meta">
              {player.parks.length} park{player.parks.length === 1 ? '' : 's'} · {tokenCount(player)} token
              {tokenCount(player) === 1 ? '' : 's'} ·{' '}
              {active ? 'moving' : walking === 0 ? 'home' : `${walking} walking`}
            </span>
          </div>
        );
      })}
    </section>
  );
}

/* -------------------------------------------------------------------- move */

function MoveHeader({ game, hiker }: { game: Game; hiker: string | null }) {
  const { state, moves, isHumanTurn } = game;
  const me = state.players[0];
  const active = state.players[state.current];

  if (!isHumanTurn || state.phase !== 'playing') {
    return (
      <header className="fg-move-head">
        <h2>{state.phase === 'playing' ? `${active.name} is moving` : state.phase === 'season-end' ? 'Season over' : 'Year over'}</h2>
      </header>
    );
  }
  if (state.pending) {
    return (
      <header className="fg-move-head">
        <h2>Decide: {pendingLabel(state)}</h2>
      </header>
    );
  }
  const movable = new Set(moves.map((m) => m.hikerId));
  return (
    <header className="fg-move-head">
      <h2>Where should this hiker go?</h2>
      <div className="fg-hikers" role="radiogroup" aria-label="Hiker">
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
            Hiker {i + 1}
            <small>{h.finished ? 'home' : `at ${siteDef(state.trail[h.position]).name}`}</small>
          </button>
        ))}
      </div>
    </header>
  );
}

function RouteLine({
  game,
  previews,
  hover,
  onHover,
  hiker,
}: {
  game: Game;
  previews: MovePreview[];
  hover: number | null;
  onHover: (to: number | null) => void;
  hiker: string | null;
}) {
  const { state, dispatch, lastCpuMove } = game;
  const explain = useExplainSite(state);
  const end = state.trail.length - 1;
  const here = state.players[0].hikers.find((h) => h.id === hiker)?.position;
  const home = state.players.flatMap((p) => p.hikers.filter((h) => h.finished).map((h) => h.id));

  return (
    <ol className="fg-route" aria-label="The trail" style={{ '--n': state.trail.length } as CSSProperties}>
      {state.trail.map((kind, index) => {
        const option = previews.find((p) => p.option.to === index)?.option;
        const pawns = [...occupants(state, index), ...(index === end ? home : [])];
        const token = state.siteTokens[index];
        const just = lastCpuMove?.index === index;
        return (
          <li
            key={index}
            className={[
              'fg-stop',
              option ? 'fg-stop-open' : '',
              hover === index ? 'fg-stop-hover' : '',
              here === index ? 'fg-stop-here' : '',
              just ? 'fg-stop-just' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="fg-stop-pawns">
              {pawns.map((id) => (
                <span
                  key={id}
                  className={`fg-pawn${id === hiker ? ' fg-pawn-on' : ''}`}
                  style={{ '--seat': state.players[Number(id[1])].color } as CSSProperties}
                  title={`${state.players[Number(id[1])].name}'s hiker`}
                />
              ))}
            </span>
            <button
              type="button"
              className="fg-station"
              onMouseEnter={() => option && onHover(index)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => option && onHover(index)}
              onBlur={() => onHover(null)}
              onClick={() =>
                option
                  ? dispatch({ type: 'move', hikerId: option.hikerId, to: option.to, useCampfire: option.useCampfire })
                  : explain(index)
              }
              aria-label={`${index === 0 ? 'Trailhead' : index === end ? 'Trail End' : `Site ${index}`}: ${siteDef(kind).name}${
                option ? '. Move here.' : ''
              }`}
            >
              {token && <span className="fg-station-token">{RESOURCE_ICON[token]}</span>}
            </button>
            <span className="fg-stop-name">{siteDef(kind).name}</span>
          </li>
        );
      })}
    </ol>
  );
}

function OptionList({
  game,
  previews,
  hover,
  onHover,
}: {
  game: Game;
  previews: MovePreview[];
  hover: number | null;
  onHover: (to: number | null) => void;
}) {
  const { state, dispatch } = game;
  if (previews.length === 0) return <p className="fg-empty">Both of your hikers are home for the season.</p>;
  return (
    <ol className="fg-options">
      {previews.map((p) => {
        const def = siteDef(p.kind);
        const gains = RESOURCES.filter((r) => (p.delta[r] ?? 0) > 0);
        const go = () => dispatch({ type: 'move', hikerId: p.option.hikerId, to: p.option.to, useCampfire: p.option.useCampfire });
        return (
          <li
            key={`${p.option.to}${p.option.useCampfire ? 'f' : ''}`}
            className={`fg-option${hover === p.option.to ? ' fg-option-hover' : ''}${p.unlocks.length ? ' fg-option-unlocks' : ''}`}
            onMouseEnter={() => onHover(p.option.to)}
            onMouseLeave={() => onHover(null)}
          >
            <span className="fg-option-art">
              <SiteArt id={p.kind} className="fg-option-art-inner" />
              <span className="fg-option-num">{p.option.to === state.trail.length - 1 ? 'End' : p.option.to}</span>
            </span>
            <span className="fg-option-body">
              <span className="fg-option-title">
                <b>{def.name}</b>
                <span>{def.choice ? SITE_VERB[p.kind] : def.text}</span>
              </span>
              <span className="fg-option-tags">
                {gains.map((r) => (
                  <span key={r} className={`fg-gain fg-gain-${r}`}>
                    +{p.delta[r]} {RESOURCE_ICON[r]}
                  </span>
                ))}
                {p.token && <span className="fg-tag">incl. the {p.token} season token</span>}
                {p.decision && <span className="fg-tag fg-tag-choice">then you choose</span>}
                {p.tent && <span className="fg-tag">⛺ or camp instead</span>}
                {p.option.useCampfire && <span className="fg-tag fg-tag-fire">🔥 spends your campfire</span>}
                {p.passes > 0 && (
                  <span className="fg-tag fg-tag-quiet">
                    passes {p.passes} site{p.passes === 1 ? '' : 's'}
                  </span>
                )}
                {p.unlocks.map((park) => (
                  <span key={park.id} className="fg-tag fg-tag-unlock">
                    ✓ puts {park.name} in reach · {park.vp} VP
                  </span>
                ))}
              </span>
            </span>
            <button type="button" className="fg-go" onClick={go} onFocus={() => onHover(p.option.to)} onBlur={() => onHover(null)}>
              Go
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Waiting({ state }: { state: GameState }) {
  const recent = state.log.slice(-4).reverse();
  return (
    <div className="fg-waiting">
      <p>Your options appear here when the turn comes back to you. Meanwhile:</p>
      <ol>
        {recent.map((entry, i) => (
          <li key={state.log.length - i} style={{ '--seat': entry.player >= 0 ? state.players[entry.player].color : 'transparent' } as CSSProperties}>
            <span className="fg-dot" aria-hidden="true" />
            <span>
              {entry.player >= 0 && <b>{state.players[entry.player].name} </b>}
              {entry.text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------- pack, goals */

function Pack({ game, delta, canAct }: { game: Game; delta: ResourceBag; canAct: boolean }) {
  const { state, dispatch } = game;
  const me = state.players[0];
  const info = useInfo();
  const ready = new Set(usableBottles(me).map((b) => b.id));
  const tokens = tokenCount(me);
  const incoming = RESOURCES.reduce((sum, r) => sum + (delta[r] ?? 0), 0);

  return (
    <section className="fg-card fg-pack" aria-label="Your pack">
      <h3>
        Your pack
        <span className={tokens + incoming > TOKEN_LIMIT ? 'fg-over' : ''}>
          {tokens}
          {incoming !== 0 && ` → ${tokens + incoming}`} / {TOKEN_LIMIT} tokens
        </span>
      </h3>
      <div className="fg-pack-row">
        {RESOURCES.map((r) => {
          const n = me.resources[r] ?? 0;
          const d = delta[r] ?? 0;
          return (
            <span key={r} className={`fg-res fg-res-${r}${n === 0 && d === 0 ? ' zero' : ''}`} title={RESOURCE_LABEL[r]}>
              <span className="fg-res-icon" aria-hidden="true">
                {RESOURCE_ICON[r]}
              </span>
              <b>{n}</b>
              {d !== 0 && (
                <span className="fg-res-delta">
                  {d > 0 ? '+' : '−'}
                  {Math.abs(d)}
                </span>
              )}
              <small>{RESOURCE_LABEL[r]}</small>
            </span>
          );
        })}
      </div>
      <div className="fg-pack-kit">
        <span title={`${me.campfires} of ${campfireAllowance(me)} campfires alight`}>🔥 {me.campfires} campfire</span>
        <span>📸 {me.photos} photo{me.photos === 1 ? '' : 's'}</span>
        {me.bottles.map((bottle) => {
          const def = bottleDef(bottle.kind);
          const usable = canAct && ready.has(bottle.id);
          return (
            <button
              key={bottle.id}
              type="button"
              className={`fg-bottle${usable ? ' ready' : ''}${bottle.used ? ' used' : ''}`}
              disabled={bottle.used}
              onClick={() =>
                usable
                  ? dispatch({ type: 'use-bottle', bottleId: bottle.id })
                  : info.show({ title: def.name, icon: def.icon, lines: ['Converts 1 freshly drawn water, once a season.'] })
              }
            >
              {def.icon} {usable ? `Use ${def.name}` : def.name}
            </button>
          );
        })}
        {me.gear.map((gear) => (
          <span key={gear.id} title={gear.text}>
            {gear.icon} {gear.name}
          </span>
        ))}
      </div>
    </section>
  );
}

function Goals({ state, delta, previewing }: { state: GameState; delta: ResourceBag; previewing: boolean }) {
  const me = state.players[0];
  const info = useInfo();
  const rows = goalParks(state, 0)
    .map((park) => ({ now: parkProgress(state, me, park), next: parkProgress(state, me, park, delta) }))
    .sort((a, b) => a.now.short - b.now.short || b.now.park.vp - a.now.park.vp);

  return (
    <section className="fg-card fg-goal-list" aria-label="Park goals">
      <h3>
        Park goals
        <span>
          {previewing ? 'after this move' : 'closest first'} · {parkDeckLeft(state)} in the deck
        </span>
      </h3>
      <ol>
        {rows.map(({ now, next }) => {
          const park = now.park;
          const mine = me.reserved.some((r) => r.id === park.id);
          const rivals = state.players.filter((p) => !p.isHuman && !mine && canClaim(state, p, park));
          const shown = previewing ? next : now;
          return (
            <li key={park.id} className={`fg-goal${shown.ready ? ' fg-goal-ready' : ''}${!now.ready && next.ready ? ' fg-goal-new' : ''}`}>
              <button
                type="button"
                className="fg-goal-art"
                onClick={() =>
                  info.show({
                    title: park.name,
                    icon: '🏞️',
                    lines: [
                      { label: 'Worth', value: `${park.vp} VP` },
                      { label: 'State', value: park.state },
                      { label: 'Terrain', value: park.tags.join(', ') },
                      'Visit it at the Trail End or the Ranger Station once every pip is covered.',
                    ],
                  })
                }
                aria-label={`About ${park.name}`}
              >
                <ParkArt park={park} art={{}} />
              </button>
              <span className="fg-goal-body">
                <span className="fg-goal-title">
                  <b>{park.name}</b>
                  {mine && <span className="fg-chip">reserved</span>}
                  <span className="fg-goal-vp">{park.vp} VP</span>
                </span>
                <Pips now={now} next={next} previewing={previewing} />
                <small>
                  {shown.ready ? 'Ready: visit at the Trail End or Ranger Station' : shortLabel(shown)}
                  {rivals.length > 0 && (
                    <span className="fg-rival">
                      {' '}
                      · {rivals.map((p) => p.name).join(', ')} could take it now
                    </span>
                  )}
                </small>
              </span>
            </li>
          );
        })}
        {rows.length === 0 && <li className="fg-empty">Every park in the row is spoken for.</li>}
      </ol>
    </section>
  );
}

function Pips({ now, next, previewing }: { now: ParkProgress; next: ParkProgress; previewing: boolean }) {
  return (
    <span className="fg-pips">
      {(previewing ? next : now).pips.map((pip, i) => {
        const gained = previewing && now.pips[i]?.state === 'short' && pip.state !== 'short';
        return (
          <span key={i} className={`fg-pip fg-pip-${pip.state}${gained ? ' fg-pip-gained' : ''}`} title={`${RESOURCE_LABEL[pip.resource]}: ${pip.state}`}>
            {RESOURCE_ICON[pip.resource]}
          </span>
        );
      })}
    </span>
  );
}

function shortLabel(progress: ParkProgress): string {
  const missing = new Map<string, number>();
  for (const pip of progress.pips) {
    if (pip.state === 'short') missing.set(pip.resource, (missing.get(pip.resource) ?? 0) + 1);
  }
  return `Short ${[...missing].map(([r, n]) => `${n} ${RESOURCE_ICON[r as keyof typeof RESOURCE_ICON]}`).join(' ')}`;
}

function Objectives({ state }: { state: GameState }) {
  const me: Player = state.players[0];
  return (
    <section className="fg-card fg-objectives" aria-label="Your bonus cards">
      <h3>
        Secret objectives <span>scored at the end</span>
      </h3>
      <ul>
        {bonusStanding(state, me).map(({ card, vp }) => (
          <li key={card.id}>
            <span>
              <b>{card.name}</b>
              <small>{card.text}</small>
            </span>
            <span className={`fg-objective-vp${vp > 0 ? ' scoring' : ''}`}>
              {vp}
              <small>VP now</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------- table */

function Shop({ state }: { state: GameState }) {
  const sun = state.players[0].resources.sun ?? 0;
  return (
    <section className="fg-card fg-shop" aria-label="Gear and campsites">
      <h3>
        Gear shop <span>bought at the Trail End</span>
      </h3>
      <ul>
        {state.gearRow.map((gear) => {
          const cost = gearCost(state, gear);
          return (
            <li key={gear.id} className={sun >= cost ? 'fg-affordable' : ''}>
              <span aria-hidden="true">{gear.icon}</span>
              <span>
                <b>{gear.name}</b>
                <small>{gear.text}</small>
              </span>
              <span className="fg-price">
                {cost} ☀️
                {cost !== gear.cost && <s>{gear.cost}</s>}
              </span>
            </li>
          );
        })}
      </ul>
      {state.campsites.length > 0 && (
        <>
          <h3>
            Campsites <span>from any tent site ⛺</span>
          </h3>
          <ul>
            {state.campsites.map((slot) => {
              const def = campsiteDef(slot.id);
              return (
                <li key={slot.id}>
                  <span aria-hidden="true">{def.icon}</span>
                  <span>
                    <b>{def.name}</b>
                    <small>{def.text}</small>
                  </span>
                  <span className="fg-tents">
                    {slot.tents.map((owner, i) => (
                      <span key={i} className="fg-dot" style={{ '--seat': state.players[owner].color } as CSSProperties} />
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function Log({ state }: { state: GameState }) {
  return (
    <section className="fg-card fg-log" aria-label="Trail log">
      <h3>Trail log</h3>
      <ol>
        {state.log
          .slice(-12)
          .reverse()
          .map((entry, i) => (
            <li key={state.log.length - i} style={{ '--seat': entry.player >= 0 ? state.players[entry.player].color : 'transparent' } as CSSProperties}>
              <span className="fg-dot" aria-hidden="true" />
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
