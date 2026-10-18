import { useEffect, useState } from 'react';
import { SoloBoard } from '../App';
import { useGame } from '../hooks/useGame';
import { Tabletop } from './Tabletop';
import { FieldGuide } from './FieldGuide';
import './concepts.css';

/**
 * Two redesigns of the single-device board, side by side with the current one.
 * All three draw the same running game, so switching mid-turn shows one
 * position three ways.
 */

type ViewId = 'current' | 'tabletop' | 'field-guide';

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
};

const ORDER: ViewId[] = ['current', 'tabletop', 'field-guide'];
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
    </div>
  );
}
