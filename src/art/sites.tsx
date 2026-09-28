import type { SiteKind } from '../game/types';
import { Bird, Bison, Cloud, hills, land, Pine, Pines, Ripples, Sky, Sun } from './kit';
import type { ParkScene } from './scenes/types';

/*
 * Small scenes for the trail sites and the Nightfall campsites, in the same
 * flat poster style as the park cards. Tiles are close to square, so each
 * scene keeps its subject in the middle of the 160-wide board, where a square
 * crop still finds it.
 */

/** A tent, facing the viewer, standing on `y`. */
function Tent({ x, y, s = 1, fill, door = '#2a1d14' }: { x: number; y: number; s?: number; fill: string; door?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-12 0 L0 -16 L12 0Z" fill={fill} />
      <path d="M0 -16 L12 0 L4 0Z" fill="#000000" opacity="0.18" />
      <path d="M-3 0 L0 -8 L3 0Z" fill={door} />
    </g>
  );
}

/** A campfire: crossed logs and a two-tone flame. */
function Campfire({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="-4" r="10" fill="#ffb347" opacity="0.25" />
      <path d="M-6 0 L6 -2 M-6 -2 L6 0" stroke="#5a3a22" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M0 -12 C3 -8 4 -5 2 -2 L-2 -2 C-4 -5 -3 -8 0 -12Z" fill="#f28c28" />
      <path d="M0 -8 C1.5 -6 2 -4 1 -2 L-1 -2 C-2 -4 -1.5 -6 0 -8Z" fill="#fde28a" />
    </g>
  );
}

/** A plain figure in a flat-brimmed ranger hat. */
function Ranger({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <rect x="-2.4" y="-12" width="4.8" height="8" rx="1.2" />
      <rect x="-2" y="-4" width="1.6" height="4" />
      <rect x="0.4" y="-4" width="1.6" height="4" />
      <circle cx="0" cy="-14" r="2" />
      <path d="M-4.6 -15.4 H4.6 L4 -14.6 H-4Z M-1.8 -15.4 L0 -18.2 L1.8 -15.4Z" />
    </g>
  );
}

export const SITE_SCENES: Record<SiteKind, ParkScene> = {
  trailhead: {
    view: 'a signpost where the trail begins',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#f2c39a', '#f7e3c4']} />
        <Sun x={110} y={40} r={9} fill="#fff1d0" glow="#f9d9a8" />
        <path d={hills([[0, 58], [40, 50], [80, 56], [120, 48], [160, 56]])} fill="#8fa888" />
        <path d={hills([[0, 70], [50, 62], [100, 70], [160, 62]])} fill="#5f7d56" />
        <path d="M70 100 C74 88 84 80 96 74 C100 72 104 70 108 70 L112 71 C104 74 96 80 90 88 C86 94 86 98 88 100Z" fill="#d9c49a" />
        <Pines from={2} to={40} y={90} h={22} fill="#2f4a36" step={7} />
        <Pines from={124} to={160} y={88} h={20} fill="#2f4a36" step={7} />
        {/* The signpost. */}
        <rect x="58" y="44" width="3" height="50" fill="#6b4a2d" />
        <path d="M60 50 H84 L88 54 L84 58 H60Z" fill="#9a6a3c" />
        <path d="M60 62 H38 L34 66 L38 70 H60Z" fill="#8a5c32" />
        <path d="M64 54 H80 M42 66 H56" stroke="#f2e2c0" strokeWidth="1.2" />
      </>
    ),
  },
  'trail-end': {
    view: 'a tent and a campfire at dusk',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#26305a', '#6a4a7a', '#d98a6a']} />
        {Array.from({ length: 14 }, (_, i) => (
          <circle key={i} cx={(i * 37) % 160} cy={(i * 13) % 34} r="0.6" fill="#fff" opacity="0.8" />
        ))}
        <path d={land([[0, 64], [30, 50], [56, 60], [86, 44], [116, 58], [140, 50], [160, 58]])} fill="#3e3a5a" />
        <path d={hills([[0, 80], [50, 74], [110, 80], [160, 74]])} fill="#2e3b30" />
        <Pines from={0} to={36} y={84} h={24} fill="#1a2620" step={7} />
        <Pines from={128} to={160} y={84} h={24} fill="#1a2620" step={7} />
        <rect x="0" y="84" width="160" height="16" fill="#27332a" />
        <Tent x={70} y={88} s={1.6} fill="#e07a3a" />
        <Campfire x={100} y={90} s={1.1} />
      </>
    ),
  },
  forest: {
    view: 'a stand of pines',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#bcd8c4', '#e8efd8']} />
        <Pines from={0} to={160} y={60} h={26} fill="#8fb094" step={6} />
        <Pines from={2} to={160} y={78} h={34} fill="#4f7d56" step={9} />
        <Pines from={-2} to={166} y={100} h={46} fill="#2a4d33" step={13} />
        <rect x="0" y="96" width="160" height="4" fill="#2a4d33" />
      </>
    ),
  },
  mountain: {
    view: 'a rocky ridge line',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#5a8ed0', '#cfe0ee']} />
        <Cloud x={120} y={20} />
        <path d={land([[0, 70], [30, 50], [50, 56], [74, 22], [86, 30], [98, 26], [124, 54], [160, 44]])} fill="#8a8a96" />
        <path d="M74 22 L86 30 L98 26 L102 34 L86 38 L70 32Z" fill="#f2f4f7" />
        <path d="M86 30 L98 26 L124 54 L160 44 L160 100 L96 100 L90 40Z" fill="#6c6c78" />
        <path d={hills([[0, 84], [50, 76], [110, 84], [160, 76]])} fill="#6a7a52" />
        <rect x="0" y="92" width="160" height="8" fill="#56663f" />
      </>
    ),
  },
  valley: {
    view: 'a river winding down a green valley',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#7fb0dc', '#e2eef2']} />
        <path d={land([[0, 30], [30, 38], [60, 56], [80, 60]], 100)} fill="#6a8a5a" />
        <path d={land([[80, 60], [100, 56], [130, 36], [160, 28]], 100)} fill="#5a7a4c" />
        <path d={hills([[20, 64], [80, 60], [140, 64]])} fill="#8fb468" />
        {/* The river, widening toward us. */}
        <path d="M78 60 C82 66 70 72 76 80 C82 88 64 94 60 100 L100 100 C96 94 104 88 96 80 C90 72 96 66 82 60Z" fill="#4f9ac4" />
        <Ripples y={84} x1={64} x2={100} rows={3} gap={4} opacity={0.4} />
        <Pines from={4} to={44} y={82} h={16} fill="#2e5034" step={8} />
        <Pines from={116} to={156} y={82} h={16} fill="#2e5034" step={8} />
      </>
    ),
  },
  basin: {
    view: 'a sun-baked basin under a big sun',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#f2b25a', '#f8dca0']} />
        <Sun x={80} y={40} r={16} fill="#fff4c8" glow="#ffd97a" />
        <path d={land([[0, 64], [20, 64], [26, 56], [48, 56], [54, 64], [106, 64], [112, 54], [136, 54], [142, 64], [160, 64]], 72)} fill="#c07a4a" />
        <rect x="0" y="70" width="160" height="30" fill="#e8d2a0" />
        <path d="M10 80 H60 M80 86 H150 M20 94 H90" stroke="#f6ead0" strokeWidth="1.4" />
        <path d="M0 70 H160" stroke="#d8b880" strokeWidth="2" />
      </>
    ),
  },
  waterfall: {
    view: 'a falls dropping into a pool',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#8fbede', '#e2eef2']} />
        <path d="M0 100 L0 20 C20 18 40 22 56 26 L60 82 L0 86Z" fill="#6a6258" />
        <path d="M160 100 L160 18 C140 18 120 22 104 26 L100 82 L160 86Z" fill="#5a5248" />
        <Pines from={0} to={50} y={26} h={14} fill="#2e5034" step={7} />
        <Pines from={110} to={160} y={26} h={14} fill="#2e5034" step={7} />
        <path d="M56 26 H104 L100 82 H60Z" fill="#eaf5f8" />
        <path d="M64 28 V80 M72 28 V80 M80 28 V80 M88 28 V80 M96 28 V80" stroke="#a9d0e0" strokeWidth="1" />
        <ellipse cx="80" cy="84" rx="30" ry="5" fill="#ffffff" opacity="0.85" />
        <rect x="0" y="86" width="160" height="14" fill="#3f86a8" />
        <Ripples y={90} rows={3} gap={3} opacity={0.35} />
      </>
    ),
  },
  camera: {
    view: 'a camera on its tripod at a viewpoint',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#6a98d0', '#f0d6b8']} />
        <path d={land([[0, 58], [24, 40], [44, 50], [70, 30], [94, 46], [120, 34], [146, 48], [160, 44]], 70)} fill="#8a86a0" />
        <path d="M70 30 l6 7 l-11 2Z M120 34 l5 6 l-10 1Z" fill="#f2f4f7" />
        <path d={hills([[0, 72], [60, 64], [120, 72], [160, 66]])} fill="#5f7d56" />
        <rect x="0" y="80" width="160" height="20" fill="#8a7458" />
        {/* The railing, and the camera on its tripod. */}
        <path d="M0 80 H160 M0 86 H160" stroke="#5a4636" strokeWidth="1.6" />
        <path d="M20 80 V100 M60 80 V100 M100 80 V100 M140 80 V100" stroke="#5a4636" strokeWidth="2" />
        <path d="M80 70 L72 96 M80 70 L88 96 M80 70 V96" stroke="#2a2a2a" strokeWidth="1.4" />
        <rect x="72" y="60" width="16" height="10" rx="1.5" fill="#2a2a2a" />
        <circle cx="80" cy="65" r="3.4" fill="#5a6a7a" />
        <circle cx="80" cy="65" r="1.6" fill="#9ab0c4" />
        <rect x="74" y="58" width="5" height="2.4" fill="#2a2a2a" />
      </>
    ),
  },
  'adv-wildcard': {
    view: 'a wildlife hide in the reeds',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#a8c8d8', '#eef0e0']} />
        <Bird x={44} y={24} s={1.2} />
        <Bird x={58} y={18} />
        <Bird x={118} y={26} s={1.1} />
        <path d={hills([[0, 60], [80, 54], [160, 60]])} fill="#8faa84" />
        <rect x="0" y="66" width="160" height="34" fill="#6a9ab0" />
        {/* The hide: a plank hut with a long slot to watch from. */}
        <path d="M54 74 V48 L80 40 L106 48 V74Z" fill="#7a5a3a" />
        <path d="M50 49 L80 38 L110 49" stroke="#4a3422" strokeWidth="2.4" fill="none" />
        <rect x="62" y="54" width="36" height="5" fill="#1e1612" />
        <path d="M58 74 V80 M102 74 V80" stroke="#4a3422" strokeWidth="2" />
        {Array.from({ length: 20 }, (_, i) => (
          <path key={i} d={`M${i * 8 + 2} 100 q${(i % 3) - 1} -12 ${2 - (i % 2) * 4} -${16 + (i % 4) * 3}`} stroke="#8a7a3a" strokeWidth="1.2" fill="none" />
        ))}
      </>
    ),
  },
  'adv-swap': {
    view: 'a log trading post',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#88b4dc', '#e6eef0']} />
        <Pines from={0} to={160} y={60} h={22} fill="#4f7456" step={8} />
        <rect x="0" y="70" width="160" height="30" fill="#9a8a5a" />
        {/* The cabin, its sign, and barrels on the porch. */}
        <path d="M44 76 V48 H116 V76Z" fill="#8a5a34" />
        <path d="M44 54 H116 M44 60 H116 M44 66 H116 M44 72 H116" stroke="#6a4222" strokeWidth="1" />
        <path d="M38 50 L80 32 L122 50Z" fill="#5a3a22" />
        <rect x="58" y="38" width="44" height="9" rx="1" fill="#e8d6aa" />
        <path d="M64 42.5 H96" stroke="#5a3a22" strokeWidth="1.4" strokeDasharray="4 2" />
        <rect x="74" y="58" width="12" height="18" fill="#3a2414" />
        <g fill="#6a4222">
          <rect x="120" y="66" width="8" height="10" rx="2" />
          <rect x="130" y="68" width="7" height="8" rx="2" />
        </g>
      </>
    ),
  },
  'adv-park': {
    view: 'a ranger station under its flag',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#6a9ed8', '#e2ecf2']} />
        <Cloud x={40} y={20} />
        <Pines from={0} to={40} y={78} h={32} fill="#2f5236" step={8} />
        <Pines from={122} to={160} y={78} h={32} fill="#2f5236" step={8} />
        <rect x="0" y="76" width="160" height="24" fill="#7a9a54" />
        <path d="M50 80 V56 H110 V80Z" fill="#6e4a30" />
        <path d="M44 58 L80 40 L116 58Z" fill="#3e5a3e" />
        <rect x="58" y="62" width="10" height="8" fill="#e8d8a8" />
        <rect x="92" y="62" width="10" height="8" fill="#e8d8a8" />
        <rect x="74" y="64" width="12" height="16" fill="#3a2414" />
        {/* The flag. */}
        <rect x="124" y="30" width="1.6" height="48" fill="#8a8a8a" />
        <rect x="125.6" y="30" width="16" height="10" fill="#b8382a" />
        <rect x="125.6" y="30" width="7" height="5" fill="#2a4a8a" />
      </>
    ),
  },
  'adv-copy': {
    view: 'binoculars on the rail of an overlook',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#5e8ed0', '#d8e6f0']} />
        <path d={land([[0, 50], [20, 42], [44, 48], [68, 36], [92, 46], [116, 38], [140, 48], [160, 42]], 60)} fill="#9aa0b8" />
        <path d={hills([[0, 60], [40, 56], [80, 62], [120, 56], [160, 60]], 70)} fill="#7a9a74" />
        <path d="M40 70 C60 66 100 66 120 70" stroke="#6aaad0" strokeWidth="2" fill="none" />
        <rect x="0" y="80" width="160" height="20" fill="#7a6a58" />
        <path d="M0 80 H160" stroke="#4a3a2e" strokeWidth="2" />
        {/* Coin-op binoculars on a post. */}
        <rect x="78" y="66" width="4" height="30" fill="#3a4a5a" />
        <rect x="68" y="54" width="24" height="12" rx="4" fill="#4a6a8a" />
        <circle cx="72" cy="60" r="3" fill="#2a3a4a" />
        <circle cx="88" cy="60" r="3" fill="#2a3a4a" />
      </>
    ),
  },
  'adv-memory': {
    view: 'a photograph pinned to a cliff at sunset',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#6a5a9a', '#e88a7a', '#f6c88a']} />
        <Sun x={120} y={62} r={10} fill="#ffe0a0" />
        <path d="M0 100 L0 20 L40 24 L60 40 L64 100Z" fill="#6a4a4a" />
        <path d="M160 100 L160 30 L130 36 L112 56 L108 100Z" fill="#5a3e3e" />
        <rect x="64" y="80" width="44" height="20" fill="#4a5a7a" />
        {/* The photo, tilted. */}
        <g transform="translate(78 50) rotate(-8)">
          <rect x="-14" y="-12" width="28" height="30" fill="#f8f4ea" />
          <rect x="-11" y="-9" width="22" height="18" fill="#6a98c8" />
          <path d="M-11 9 L-4 0 L2 5 L6 1 L11 9Z" fill="#4a6a4a" />
          <circle cx="0" cy="-15" r="1.6" fill="#b8382a" />
        </g>
      </>
    ),
  },
  'adv-bison': {
    view: 'bison grazing a meadow',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#7aaede', '#e2ecf0']} />
        <Cloud x={120} y={18} s={1.2} />
        <path d={hills([[0, 56], [50, 48], [110, 56], [160, 48]])} fill="#8faa6a" />
        <path d={hills([[0, 70], [60, 64], [120, 72], [160, 66]])} fill="#a8bc70" />
        <rect x="0" y="80" width="160" height="20" fill="#94a85c" />
        <Bison x={60} y={86} s={2} />
        <Bison x={104} y={80} s={1.2} />
        <Bison x={126} y={92} s={1.6} />
      </>
    ),
  },
  'adv-lookout': {
    view: 'a fire lookout tower above the forest',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#8ab4de', '#eef0e8']} />
        <path d={land([[0, 70], [40, 60], [80, 66], [120, 58], [160, 66]])} fill="#8a9a8a" />
        {/* The tower: splayed legs, a cab with windows all round. */}
        <path d="M68 90 L76 40 M92 90 L84 40 M70 76 H90 M72 62 H88 M74 50 H86 M70 76 L88 62 M90 76 L72 62" stroke="#5a4a3a" strokeWidth="1.6" fill="none" />
        <rect x="70" y="26" width="20" height="14" fill="#8a6a4a" />
        <rect x="72" y="29" width="16" height="6" fill="#dfeef4" />
        <path d="M66 27 L80 18 L94 27Z" fill="#5a3a2a" />
        <Pines from={0} to={160} y={100} h={30} fill="#2f5236" step={9} />
      </>
    ),
  },
  'adv-talk': {
    view: 'a ranger talk by the campfire',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#3a3a6a', '#b86a6a', '#f2b27a']} />
        <Pines from={0} to={160} y={66} h={26} fill="#2a2f30" step={9} />
        <rect x="0" y="64" width="160" height="36" fill="#4a3e30" />
        {/* Log benches in a half ring, the fire, the ranger. */}
        <path d="M24 90 H60 M100 90 H136 M34 80 H70 M90 80 H126" stroke="#8a6a44" strokeWidth="4" strokeLinecap="round" />
        <Campfire x={80} y={92} s={1.4} />
        <Ranger x={80} y={74} s={1.6} fill="#1e1a18" />
      </>
    ),
  },
};

export const CAMPSITE_SCENES: Record<string, ParkScene> = {
  stargazing: {
    view: 'a telescope under the Milky Way',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#0b1330', '#1e2a54', '#34406a']} />
        <path d="M-10 70 C30 50 70 30 170 10 L170 26 C80 44 40 62 -10 84Z" fill="#c8c8ee" opacity="0.14" />
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={(i * 41) % 160} cy={(i * 23) % 70} r={i % 6 === 0 ? 0.9 : 0.45} fill="#fff" opacity="0.85" />
        ))}
        <path d={hills([[0, 84], [60, 78], [120, 84], [160, 78]])} fill="#141a24" />
        <path d="M72 84 L80 72 L88 84 M80 72 V84" stroke="#b8c0d0" strokeWidth="1.2" />
        <rect x="74" y="62" width="22" height="6" rx="2" fill="#d8dce8" transform="rotate(-30 80 70)" />
        <Tent x={126} y={86} s={1.1} fill="#3a4a6a" />
      </>
    ),
  },
  'nightfall-camp': {
    view: 'a lantern-lit tent at nightfall',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#2a2450', '#6a4a7a', '#c07a7a']} />
        <circle cx="120" cy="24" r="7" fill="#f4ecd0" />
        <path d={land([[0, 60], [40, 46], [80, 56], [120, 44], [160, 56]])} fill="#3a3456" />
        <rect x="0" y="80" width="160" height="20" fill="#2a3028" />
        <Pines from={0} to={36} y={84} h={26} fill="#161c18" step={7} />
        <Pines from={126} to={160} y={84} h={26} fill="#161c18" step={7} />
        <Tent x={80} y={88} s={2} fill="#d8a04a" door="#f8e0a0" />
        <circle cx="80" cy="80" r="9" fill="#ffe0a0" opacity="0.25" />
      </>
    ),
  },
  'forest-clearing': {
    view: 'sunlight in a forest clearing',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#cfe4c8', '#f2f0d8']} />
        <path d="M60 0 L100 0 L130 100 L30 100Z" fill="#fff6c8" opacity="0.4" />
        <Pines from={0} to={48} y={80} h={50} fill="#2e5034" step={10} />
        <Pines from={112} to={160} y={80} h={50} fill="#2e5034" step={10} />
        <path d={hills([[0, 80], [80, 74], [160, 80]])} fill="#8ab45a" />
        <g fill="#f2d24a">
          {[56, 70, 84, 96, 108, 64, 90].map((x, i) => (
            <circle key={i} cx={x} cy={86 + (i % 3) * 4} r="1.4" />
          ))}
        </g>
      </>
    ),
  },
  'alpine-bivouac': {
    view: 'a bivouac on a high rock ledge',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#3e70b8', '#cfe0f0']} />
        <path d={land([[0, 60], [30, 30], [50, 42], [74, 14], [96, 34], [120, 22], [146, 44], [160, 38]], 70)} fill="#9aa2b4" />
        <path d="M74 14 l8 10 l-14 3Z M30 30 l6 8 l-11 2Z M120 22 l6 8 l-11 2Z" fill="#f4f6f9" />
        <path d="M0 100 L0 78 L50 70 L92 76 L110 100Z" fill="#6a6058" />
        <Tent x={60} y={72} s={1.3} fill="#e8582a" />
        <path d="M110 100 L130 82 L160 80 L160 100Z" fill="#54504a" />
      </>
    ),
  },
  'riverside-camp': {
    view: 'a tent by a river, a canoe pulled up',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#8ab8de', '#eaf0ec']} />
        <Pines from={0} to={160} y={56} h={20} fill="#4f7456" step={7} />
        <rect x="0" y="56" width="160" height="22" fill="#4f98c0" />
        <Ripples y={60} rows={4} gap={4} opacity={0.35} />
        <path d="M0 76 C40 72 100 74 160 72 L160 100 L0 100Z" fill="#9aaa6a" />
        <Tent x={100} y={86} s={1.5} fill="#2a8a6a" />
        <path d="M34 80 Q52 86 70 80 Q52 83 34 80Z" fill="#c8562a" stroke="#c8562a" strokeWidth="1.6" />
      </>
    ),
  },
  'outfitter-camp': {
    view: "an outfitter's tent hung with packs",
    draw: (k) => (
      <>
        <Sky k={k} stops={['#88b4dc', '#eeeede']} />
        <Pine x={20} y={84} h={50} fill="#2f5236" />
        <Pine x={142} y={84} h={46} fill="#2f5236" />
        <rect x="0" y="80" width="160" height="20" fill="#9a8a5a" />
        {/* A wall tent with its flap up, packs hung along the front. */}
        <path d="M40 86 V56 L80 40 L120 56 V86Z" fill="#e8dcc0" />
        <path d="M40 56 L80 40 L120 56" stroke="#8a7a5a" strokeWidth="1.6" fill="none" />
        <path d="M64 86 V62 H96 V86Z" fill="#6a5a44" />
        <path d="M60 60 L100 60 L96 54 L64 54Z" fill="#c8b890" />
        {[
          [48, '#c8562a'],
          [106, '#2a6a8a'],
          [114, '#6a8a2a'],
        ].map(([x, fill]) => (
          <rect key={x} x={Number(x) - 4} y="62" width="8" height="12" rx="2" fill={String(fill)} />
        ))}
        <Sun x={140} y={20} r={6} />
      </>
    ),
  },
};
