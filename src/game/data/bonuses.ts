import type { BonusCard, ParkTag } from '../types';

const countTag = (tag: ParkTag) => (v: { parks: { tags: ParkTag[] }[] }) =>
  v.parks.filter((p) => p.tags.includes(tag)).length;

/** Each player is dealt two of these at setup. They stay hidden until scoring. */
export const BONUS_CARDS: BonusCard[] = [
  {
    id: 'shutterbug',
    name: 'Shutterbug',
    text: '2 VP for every photo you took.',
    score: (v) => v.photos * 2,
  },
  {
    id: 'completionist',
    name: 'Completionist',
    text: '10 VP for 4+ parks, 5 VP for exactly 3.',
    score: (v) => (v.parks.length >= 4 ? 10 : v.parks.length === 3 ? 5 : 0),
  },
  {
    id: 'mountaineer',
    name: 'Mountaineer',
    text: '3 VP per mountain park.',
    score: (v) => countTag('mountain')(v) * 3,
  },
  {
    id: 'forest-bather',
    name: 'Forest Bather',
    text: '3 VP per forest park.',
    score: (v) => countTag('forest')(v) * 3,
  },
  {
    id: 'river-runner',
    name: 'River Runner',
    text: '3 VP per water park.',
    score: (v) => countTag('water')(v) * 3,
  },
  {
    id: 'desert-wanderer',
    name: 'Desert Wanderer',
    text: '3 VP per desert park.',
    score: (v) => countTag('desert')(v) * 3,
  },
  {
    id: 'canyoneer',
    name: 'Canyoneer',
    text: '3 VP per canyon park.',
    score: (v) => countTag('canyon')(v) * 3,
  },
  {
    id: 'wildlife-watcher',
    name: 'Wildlife Watcher',
    text: '3 VP per wildlife park.',
    score: (v) => countTag('wildlife')(v) * 3,
  },
  {
    id: 'gear-head',
    name: 'Gear Head',
    text: '3 VP per gear card you own.',
    score: (v) => v.gear.length * 3,
  },
  {
    id: 'provisioner',
    name: 'Provisioner',
    text: '1 VP per 2 leftover resources.',
    score: (v) =>
      Math.floor(Object.values(v.resources).reduce((a, b) => a + (b ?? 0), 0) / 2),
  },
  {
    id: 'coast-to-coast',
    name: 'Coast to Coast',
    text: '6 VP if your parks cover 3+ regions.',
    score: (v) => (new Set(v.parks.map((p) => p.region)).size >= 3 ? 6 : 0),
  },
  {
    id: 'early-bird',
    name: 'Early Bird',
    text: '5 VP if you claimed a park in season 1 or 2.',
    score: (v) => (v.claimedInSeason.some((s) => s <= 2) ? 5 : 0),
  },
  {
    id: 'big-ticket',
    name: 'Big Ticket',
    text: '4 VP per park worth 5 or more VP.',
    score: (v) => v.parks.filter((p) => p.vp >= 5).length * 4,
  },
  {
    id: 'firekeeper',
    name: 'Firekeeper',
    text: '2 VP per unused campfire token.',
    score: (v) => v.campfires * 2,
  },
];
