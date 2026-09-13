import { Modal } from './Modals';
import { GEAR } from '../game/data/gear';
import { BONUS_CARDS } from '../game/data/bonuses';
import { SITES } from '../game/data/sites';
import type { SiteKind } from '../game/types';

const SITE_ORDER: SiteKind[] = [
  'sun',
  'water',
  'forest',
  'mountain',
  'animal',
  'double-water',
  'double-forest',
  'double-mountain',
  'double-sun',
  'water-forest',
  'mountain-sun',
  'animal-forest',
  'vista',
  'campfire',
  'photo',
  'canteen',
  'reservation',
  'trail-end',
];

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play" onClose={onClose} wide>
      <h3>The hike</h3>
      <ul>
        <li>
          Four seasons. Each season a fresh trail is laid out, one site longer than the last (6 sites in spring, 9 in
          winter, plus the trailhead and the Trail End).
        </li>
        <li>
          You have <b>two hikers</b>. On your turn you move <b>one hiker forward</b> any distance along the trail and take
          that site&rsquo;s action. Hikers never move backwards.
        </li>
        <li>
          <b>Hikers cannot share a site.</b> The only way onto an occupied site is to spend a <b>campfire token</b> (gained
          at Campfire sites) — or to own the Trail Map, which waives the cost. The trailhead and Trail End hold everyone.
        </li>
        <li>
          Reaching the <b>Trail End</b> retires that hiker for the season: claim one park by paying its cost, take a photo
          for 1 sun, or rest for 1 sun. When all hikers are home, the season ends.
        </li>
      </ul>

      <h3>Resources</h3>
      <ul>
        <li>Sun ☀️, water 💧, forest 🌲, mountain ⛰️ and wildlife 🐾 are collected along the trail and spent on parks.</li>
        <li>
          Your <b>water bottle</b> 🧴 is one wild resource per season. It empties when used and refills at a Spring site or
          at the start of the next season.
        </li>
        <li>
          <b>Sun does not keep between seasons.</b> Spend it on gear and photos before the season ends. Everything else
          carries over.
        </li>
      </ul>

      <h3>Scoring</h3>
      <ul>
        <li>Each park card scores its printed VP.</li>
        <li>Each photo scores 1 VP, or 2 VP with the Photo Album.</li>
        <li>Your two hidden <b>bonus cards</b> score at the end of the game.</li>
        <li>Leftover resources score 1 VP per 3 (house rule).</li>
        <li>Ties go to the most parks, then the most photos.</li>
      </ul>

      <h3>Trail sites</h3>
      <table className="rules-table">
        <tbody>
          {SITE_ORDER.map((kind) => (
            <tr key={kind}>
              <td className="rules-icon">{SITES[kind].icon}</td>
              <td>
                <b>{SITES[kind].name}</b>
              </td>
              <td>{SITES[kind].text}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Gear (bought with sun, before you move)</h3>
      <table className="rules-table">
        <tbody>
          {GEAR.map((g) => (
            <tr key={g.id}>
              <td className="rules-icon">{g.icon}</td>
              <td>
                <b>{g.name}</b>
              </td>
              <td>{g.cost} ☀️</td>
              <td>{g.text}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Bonus cards in the deck</h3>
      <table className="rules-table">
        <tbody>
          {BONUS_CARDS.map((b) => (
            <tr key={b.id}>
              <td>
                <b>{b.name}</b>
              </td>
              <td>{b.text}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Your opponents</h3>
      <ul>
        <li>
          <b>Ranger Ada</b> banks resources and converts them into the highest-value parks she can reach.
        </li>
        <li>
          <b>Scout Bo</b> builds a gear and photo engine, then picks off cheap parks.
        </li>
        <li>
          <b>Blazer Cy</b> plays for tempo: campfires, contested sites, and the site you were about to take.
        </li>
      </ul>
      <p className="modal-note">
        All three evaluate every legal move each turn and take the one with the best immediate value, so they punish a
        greedy detour and will step onto the site you left open.
      </p>
    </Modal>
  );
}

export function CreditsModal({
  onClose,
  credits,
}: {
  onClose: () => void;
  credits: { park: string; artist?: string; license?: string; filePage?: string }[];
}) {
  return (
    <Modal title="Art credits" onClose={onClose} wide>
      <p className="modal-note">
        Park photographs are fetched from the English Wikipedia at runtime (the lead image of each park&rsquo;s article) and
        cached in your browser. Many are works of the U.S. National Park Service and in the public domain; others carry the
        Creative Commons license shown below. Parks without a resolvable photo use generated vector scenery instead.
      </p>
      <table className="rules-table">
        <tbody>
          {credits.map((c) => (
            <tr key={c.park}>
              <td>
                <b>{c.park}</b>
              </td>
              <td>{c.artist ?? 'unknown author'}</td>
              <td>{c.license ?? '—'}</td>
              <td>
                {c.filePage && (
                  <a href={c.filePage} target="_blank" rel="noreferrer noopener">
                    file page
                  </a>
                )}
              </td>
            </tr>
          ))}
          {credits.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No photographs loaded — every card is showing generated artwork.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Modal>
  );
}
