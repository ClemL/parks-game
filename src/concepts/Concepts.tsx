import { useEffect, useState } from 'react';
import { SoloBoard } from '../App';
import { useGame } from '../hooks/useGame';
import { Tabletop } from './Tabletop';
import { FieldGuide } from './FieldGuide';
import { TrailMap } from './TrailMap';
import { Passport } from './Passport';
import { Broadcast } from './Broadcast';
import './concepts.css';

/**
 * Five redesigns of the single-device board, side by side with the current
 * one. All of them draw the same running game, so switching mid-turn shows one
 * position six ways.
 */

type ViewId = 'current' | 'tabletop' | 'field-guide' | 'trail-map' | 'passport' | 'broadcast';

interface Note {
  label: string;
  title: string;
  thesis: string;
  changes: string[];
  costs: string[];
}

const NOTES: Record<ViewId, Note> = {
  current: {
    label: 'Current',
    title: 'The board as it ships',
    thesis: 'Eight folding panels of equal weight, stacked down the page.',
    changes: [
      'The trail, where every turn happens, is a 124px strip; the film below it is taller than the trail, park row and campsites together.',
      'Resources sit in the top bar, parks two panels down: comparing them is arithmetic across the screen.',
      'At 1440×900 the page is 2.6 screens tall, and on a phone 2.4; the Trail End is already clipped in spring.',
    ],
    costs: [],
  },
  tabletop: {
    label: 'A · Tabletop',
    title: 'The screen is the board',
    thesis:
      'Lay the game out the way it sits on a table, so every piece has a fixed place and the whole state reads at a glance, with no scrolling on a laptop or tablet.',
    changes: [
      'The trail is the hero: a winding path across a panorama that changes with the season. Tiles have 2.2 times the current area in spring, and all twelve winter stops fit on screen where the current strip scrolls.',
      'Opponents sit across the top as seats; your backpack is a tray along the bottom, the way your pieces sit in front of you.',
      'The parks are dealt large in the middle, and each cost pip lights up as you collect that resource.',
      'Gear, campsites and the log share one tabbed side board; the film moves into the menu.',
      'On a phone the trail becomes a swipe strip and the tray pins to the bottom edge.',
    ],
    costs: [
      'Strongest on a laptop or tablet in landscape; a phone gets a reflow, not the full picture.',
      'Leaves the planning to you: it shows the state more clearly but explains no consequences.',
      'Needs more art: a seasonal panorama and larger site illustrations.',
    ],
  },
  'field-guide': {
    label: 'B · Field Guide',
    title: 'Every move shows its consequences',
    thesis:
      'Organize the screen around the one question a turn asks — where should this hiker go — and answer it with what each choice pays and which parks it brings within reach.',
    changes: [
      'The trail becomes a list of your legal moves; each row says what you gain, whether it opens a decision, and which parks it unlocks.',
      'Point at a move and the pack and the park goals preview the result before you commit.',
      'Parks become goals with progress pips: held, covered by a wildcard, or still short, sorted closest first, with a warning when a rival can already take one.',
      'Your hidden bonus cards show what they would score right now; a standings bar replaces four player panels.',
      'On a phone a bottom tab bar splits Move, Goals and Table, so a turn needs no scrolling.',
    ],
    costs: [
      'Less atmosphere: it reads as a planning tool more than a board game.',
      'The previews make strong play easier, which lowers the skill ceiling; a setting could turn them off.',
      'The map of the trail shrinks to a route line, so spatial memory of the trail is weaker.',
    ],
  },
  'trail-map': {
    label: 'C · Trail Map',
    title: 'Built for a phone in one hand',
    thesis:
      'Most phone play is one-handed. Run the trail down the screen so it scrolls the way a phone scrolls, and put everything the thumb touches in a dock along the bottom edge.',
    changes: [
      'The trail is a switchback map running top to bottom. Each stop is a full-width row, 366×74px on a 390px phone: 2.9 times the area of a current trail tile (104×90).',
      'A tap aims and a second tap, or Go, walks. While a stop is aimed the dock says what it pays, season token included, whether it opens a decision and which parks it puts within reach, so a slip of the thumb costs nothing.',
      'The hiker switch, Go, your pack, the token meter and any flask you can empty sit in a 149px dock on the bottom edge. Nothing you touch during a turn is above it.',
      'Parks, kit, shop and log open one at a time as a drawer from the dock; on a desktop they stand beside the map.',
      'Mid-game on a phone the page is 1.5 screens tall against 2.7 for the current board, and the map scrolls itself to your nearest open stop.',
      'Dressed after the Park Service’s Unigrid brochures: a black title band, a plain grotesque, a red dotted trail on sand.',
    ],
    costs: [
      'Two taps a move instead of one: slower for an expert, and on a desktop the confirmation is mostly overhead.',
      'Opponents shrink to one line of chips with their points and park counts; their resources are not shown at all.',
      'A winter trail of twelve stops is about 900px of map, so its far end is a scroll away.',
    ],
  },
  passport: {
    label: 'D · Passport',
    title: 'The year is the story',
    thesis:
      'A game is four seasons long, but the current board and the first two concepts are built around the turn in front of you; the year shows up only as a row of park cards and a score. Frame the board as a park passport filled in over the year, so progress is something you collect and watch grow.',
    changes: [
      'Each park you visit is inked as a stamp, ringed with its name and dated by the season you visited it. Reservations are pencilled in, with how many resources they are still short.',
      'Four pages across the top show the park points every player banked in each season, so a strong spring or a stalled summer reads at a glance; a fifth column ranks everyone by points showing.',
      'The parks on offer are perforated stamps with their points as the denomination and your cost pips beneath; bonus cards become endorsements with what they would score now.',
      'The trail becomes an itinerary of numbered stops that wraps instead of scrolling, so all twelve winter stops show at once. Opponents are fellow travellers with their own stamps.',
      'Typed entries are set in Courier Prime; headings keep the board’s own slab serif.',
    ],
    costs: [
      'The longest layout here: 1.7 screens on a desktop mid-game and 3.8 on a phone, against 2.7 for the current board on a phone.',
      'Nothing about a single turn gets easier; the itinerary is the current trail with less art.',
      'Tilted stamps and ring lettering are decoration and lose legibility when small, so a tap opens each one as plain text.',
    ],
  },
  broadcast: {
    label: 'E · Broadcast',
    title: 'Worth watching',
    thesis:
      'With four seats, about three turns in four belong to someone else, and the current board reports them as a log line and a flash on the trail. Treat those turns as the main event: a race you can read, a play-by-play you can catch up on, and a plain call on who threatens which park.',
    changes: [
      'The trail is a race grid: one lane per player, one column per site. Who is ahead, who is bunched up and which sites are taken (hatched) read in one look, and your open moves light up in your own lane.',
      'A scorebug puts the turn order across the top (on the clock, next, then) beside a CPU speed switch, since watching is the point.',
      'The play-by-play marks where your last move was and opens with a recap of what changed hands while you waited: parks visited or reserved, gear bought, the camera.',
      'In contention lists each park with everyone who can already pay for it; one a rival can take is flagged Contested.',
      'Your pack is a lower third pinned to the bottom edge. At 1440×900 the whole board fits one screen mid-game.',
    ],
    costs: [
      'Dense and dark by design: a lot of chrome for a casual game, and the grid is wider than a phone, so it scrolls sideways there.',
      'The grid shows positions, not places: each site shrinks to an icon and a name.',
      'It spells out public information a physical table leaves you to count, which makes denial play easier.',
    ],
  },
};

const ORDER: ViewId[] = ['current', 'tabletop', 'field-guide', 'trail-map', 'passport', 'broadcast'];
const KEY = 'parks-concept-v1';

function initialView(): ViewId {
  const fromHash = window.location.hash.replace(/^#\/concepts\/?/, '').split('?')[0];
  if (ORDER.includes(fromHash as ViewId)) return fromHash as ViewId;
  try {
    const saved = localStorage.getItem(KEY);
    if (ORDER.includes(saved as ViewId)) return saved as ViewId;
  } catch {
    /* private mode */
  }
  return 'tabletop';
}

export default function Concepts() {
  const game = useGame();
  const [view, setView] = useState<ViewId>(initialView);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, view);
    } catch {
      /* the choice just will not be remembered */
    }
    // Only rewrite a hash that already points here: an embedded build opens
    // with no hash, and its frame may not let it change.
    if (window.location.hash.startsWith('#/concepts')) {
      try {
        history.replaceState(null, '', `#/concepts/${view}`);
      } catch {
        /* sandboxed frame */
      }
    }
    window.scrollTo(0, 0);
  }, [view]);

  const note = NOTES[view];

  return (
    <div className={`cx cx-${view}`}>
      <nav className="cx-bar" aria-label="Redesign concepts">
        <span className="cx-bar-label">Redesign concepts</span>
        <div className="cx-switch" role="tablist">
          {ORDER.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              className={view === id ? 'on' : ''}
              onClick={() => setView(id)}
            >
              {NOTES[id].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`cx-notes-toggle${notesOpen ? ' on' : ''}`}
          aria-expanded={notesOpen}
          aria-controls="cx-notes"
          onClick={() => setNotesOpen((open) => !open)}
        >
          {notesOpen ? 'Hide notes' : 'Design notes'}
        </button>
      </nav>

      {notesOpen && (
        <section id="cx-notes" className="cx-notes" aria-label={`${note.label} design notes`}>
          <div className="cx-notes-inner">
            <div className="cx-notes-lead">
              <h2>{note.title}</h2>
              <p>{note.thesis}</p>
              <p className="cx-notes-same">Same game, same save: switch views mid-turn to compare one position.</p>
            </div>
            <div>
              <h3>{view === 'current' ? 'What the redesigns answer' : 'What changes'}</h3>
              <ul>
                {note.changes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            {note.costs.length > 0 && (
              <div>
                <h3>What it costs</h3>
                <ul>
                  {note.costs.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {view === 'current' && <SoloBoard game={game} />}
      {view === 'tabletop' && <Tabletop game={game} />}
      {view === 'field-guide' && <FieldGuide game={game} />}
      {view === 'trail-map' && <TrailMap game={game} />}
      {view === 'passport' && <Passport game={game} />}
      {view === 'broadcast' && <Broadcast game={game} />}
    </div>
  );
}
