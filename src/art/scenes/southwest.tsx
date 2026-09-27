import type { ReactNode } from 'react';
import { Bird, Cloud, hills, land, Ripples, Sky, Sun } from '../kit';
import type { ParkScene } from './types';

/** A saguaro, arms raised, standing on `y`. */
function Saguaro({ x, y, h, fill }: { x: number; y: number; h: number; fill: string }) {
  const w = h * 0.12;
  return (
    <g fill="none" stroke={fill} strokeLinecap="round">
      <path d={`M${x} ${y} V${y - h}`} strokeWidth={w} />
      <path
        d={`M${x} ${y - h * 0.42} h${-h * 0.2} v${-h * 0.26} M${x} ${y - h * 0.55} h${h * 0.18} v${-h * 0.3}`}
        strokeWidth={w * 0.8}
        strokeLinejoin="round"
      />
    </g>
  );
}

/** A soaptree yucca: a pom-pom of blades on a stalk. */
function Yucca({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  const blades: ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + (i / 8) * Math.PI;
    blades.push(
      <line key={i} x1={0} y1={-6} x2={Math.cos(a) * 4} y2={-6 + Math.sin(a) * 4} stroke={fill} strokeWidth="0.7" />,
    );
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <line x1="0" y1="0" x2="0" y2="-6" stroke={fill} strokeWidth="0.9" />
      {blades}
      <line x1="0" y1="-9" x2="0" y2="-14" stroke={fill} strokeWidth="0.5" />
    </g>
  );
}

/** A row of hoodoos: capped spires, left to right. */
function Hoodoos({ from, to, y, h, fill, cap, step = 5 }: { from: number; to: number; y: number; h: number; fill: string; cap: string; step?: number }) {
  const out: ReactNode[] = [];
  let i = 0;
  for (let x = from; x <= to; x += step, i++) {
    const hh = h * [1, 0.75, 0.9, 0.62, 1.1, 0.8, 0.95][i % 7];
    const w = step * 0.78;
    out.push(
      <g key={i}>
        <path d={`M${x - w / 2} ${y} L${x - w * 0.3} ${y - hh} Q${x} ${y - hh - w * 0.5} ${x + w * 0.3} ${y - hh} L${x + w / 2} ${y}Z`} fill={fill} />
        <ellipse cx={x} cy={y - hh} rx={w * 0.4} ry={w * 0.22} fill={cap} />
      </g>,
    );
  }
  return <>{out}</>;
}

export const SOUTHWEST: Record<string, ParkScene> = {
  'grand-canyon': {
    view: 'Buttes of the South Rim at sunset',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#6d7fb3', '#e69a7a', '#f6c98b']} />
        <Sun x={120} y={40} r={7} fill="#fde7b0" glow="#fbd38d" />
        <path d={land([[0, 46], [30, 45], [34, 42], [60, 42], [64, 46], [100, 45], [104, 41], [140, 41], [144, 45], [160, 45]], 60)} fill="#b89bb8" />
        <path d={land([[0, 54], [14, 54], [18, 48], [40, 48], [46, 55], [80, 56], [86, 50], [96, 50], [100, 44], [112, 44], [116, 52], [160, 53]], 70)} fill="#cf8f78" />
        <path d={land([[0, 64], [22, 62], [28, 56], [52, 56], [58, 63], [110, 64], [118, 56], [130, 56], [136, 63], [160, 62]], 80)} fill="#b86446" />
        <path d="M0 62 H160 M0 67 H160" stroke="#9d4f37" strokeWidth="1.2" />
        <path d={land([[0, 76], [40, 74], [48, 68], [70, 68], [76, 75], [160, 74]], 90)} fill="#8f3f28" />
        <path d="M60 86 C80 82 100 88 120 84" stroke="#6ba0a8" strokeWidth="1" fill="none" />
        {/* The rim, with a pinyon. */}
        <path d="M0 100 L0 84 C20 82 40 86 56 92 C70 96 90 98 100 100Z" fill="#5a3b2a" />
        <path d="M14 86 C12 80 16 74 22 72 C26 70 32 72 34 76 C36 80 30 84 24 84 C20 86 16 88 14 86Z" fill="#2e3b25" />
        <rect x="21" y="82" width="1.6" height="6" fill="#3a2a1d" />
      </>
    ),
  },

  zion: {
    view: 'The Watchman over the Virgin River',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#5c7fb8', '#e6a88a', '#f5cf9a']} />
        {/* The Watchman: a stepped tower of Navajo sandstone. */}
        <path d="M34 72 L42 56 L48 54 L52 40 L58 36 L60 26 L66 22 L70 30 L74 32 L78 44 L86 48 L92 60 L104 72Z" fill="#d66a3a" />
        <path d="M66 22 L70 30 L74 32 L78 44 L86 48 L92 60 L104 72 L80 72 L72 40Z" fill="#a8482a" />
        <path d="M34 60 H104" stroke="#b9532e" strokeWidth="1" opacity="0.6" />
        <path d={land([[0, 52], [10, 40], [20, 44], [28, 60], [40, 74]], 80)} fill="#b85a35" />
        <path d={land([[108, 74], [120, 50], [130, 46], [140, 36], [160, 34]], 80)} fill="#9c4a2c" />
        <path d={hills([[0, 80], [30, 74], [60, 80], [100, 74], [140, 80], [160, 76]], 86)} fill="#6a7a45" />
        {/* The river, and cottonwoods on its banks. */}
        <path d="M60 100 C70 94 80 90 100 86 L118 86 C102 90 92 96 90 100Z" fill="#7aa3b8" />
        <path d="M100 86 L118 86" stroke="#f5cf9a" strokeWidth="0.8" />
        <g fill="#8d9e3c">
          <circle cx="20" cy="84" r="8" />
          <circle cx="32" cy="86" r="6" />
          <circle cx="132" cy="84" r="7" />
          <circle cx="146" cy="82" r="9" />
        </g>
        <path d={hills([[0, 94], [30, 90], [56, 96]], 100)} fill="#4a5a30" />
        <path d={hills([[96, 96], [130, 90], [160, 94]], 100)} fill="#4a5a30" />
      </>
    ),
  },

  arches: {
    view: 'Delicate Arch against the La Sal Mountains',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#3f5f99', '#9fb2d0', '#f2c9a0']} />
        <path d={land([[0, 64], [20, 58], [34, 50], [44, 54], [58, 46], [72, 52], [92, 48], [110, 56], [140, 54], [160, 60]], 70)} fill="#6d7ba6" />
        <path d="M34 50 l4 3 l-6 1Z M58 46 l5 3 l-8 2Z M92 48 l5 3 l-8 1Z" fill="#eef1f6" />
        {/* The slickrock bowl. */}
        <path d={hills([[0, 74], [40, 70], [80, 76], [120, 70], [160, 74]])} fill="#d28b58" />
        <path d="M0 100 C30 80 60 78 80 82 C100 86 130 80 160 88 L160 100Z" fill="#b8693e" />
        {/* The arch, thick at the top and pinched at its left foot. */}
        <path
          fillRule="evenodd"
          d="M60 80 C57 66 56 50 62 38 C66 30 76 27 86 29 C96 31 102 38 104 50 C106 62 104 72 107 80Z M63 80 C61 66 62 52 66 44 C70 36 78 34 84 35 C91 37 95 44 97 54 C99 64 97 72 99 80Z"
          fill="#d6743e"
        />
        <path d="M86 28 C96 30 102 38 104 50 C106 62 104 72 106 80 L98 80 C96 72 98 64 96 54 C95 46 92 40 88 38Z" fill="#a8532a" />
        <ellipse cx="82" cy="81" rx="30" ry="2.5" fill="#8f4a28" opacity="0.5" />
      </>
    ),
  },

  bryce: {
    view: 'The hoodoos of Bryce Amphitheater',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#4f8bd0', '#c6dcef']} />
        <Cloud x={44} y={16} />
        <path d={land([[0, 40], [60, 38], [100, 40], [160, 36]], 50)} fill="#9fb0c4" />
        <path d={land([[0, 46], [160, 44]], 56)} fill="#f0d6c2" />
        <path d={hills([[0, 60], [40, 64], [80, 66], [120, 64], [160, 60]])} fill="#e7b89a" />
        <path d={hills([[0, 58], [20, 54], [40, 58], [60, 53], [80, 57], [100, 52], [120, 57], [140, 53], [160, 58]])} fill="#f0cdb4" />
        <Hoodoos from={2} to={160} y={76} h={16} fill="#de8a5b" cap="#f3d0b6" step={10} />
        <Hoodoos from={6} to={160} y={90} h={22} fill="#c4613a" cap="#eab394" step={13} />
        <Hoodoos from={-4} to={170} y={104} h={30} fill="#9f4626" cap="#d98a62" step={19} />
        <g fill="#355b3c">
          <path d="M140 100 L146 72 L152 100Z" />
          <path d="M6 100 L12 76 L18 100Z" />
        </g>
      </>
    ),
  },

  canyonlands: {
    view: 'Sunrise through Mesa Arch',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#9ab3cf', '#f3c38e', '#f7dca6']} />
        <Sun x={36} y={58} r={6} fill="#fff4d0" glow="#ffe39a" />
        <path d={land([[0, 64], [30, 64], [34, 60], [70, 60], [74, 66], [110, 66], [116, 58], [150, 58], [156, 64], [160, 64]], 76)} fill="#b3899a" />
        <path d={land([[0, 76], [50, 76], [56, 70], [90, 70], [96, 78], [160, 78]], 90)} fill="#c9825a" />
        <path d="M0 84 C40 82 80 86 120 82 C140 80 150 84 160 84" stroke="#8d5a3e" strokeWidth="1" fill="none" />
        {/* The arch: a thin span on the cliff edge, its underside lit orange by
            the sunrise bouncing up out of the canyon. */}
        <path d="M0 100 L0 20 C30 10 60 8 80 8 C100 8 130 10 160 20 L160 100 L146 100 L144 70 C140 44 120 26 80 24 C40 26 20 44 16 70 L14 100Z" fill="#3e271a" />
        <path d="M16 70 C20 44 40 26 80 24 C120 26 140 44 144 70 L138 70 C134 48 116 32 80 30 C44 32 26 48 22 70Z" fill="#e8733a" />
        <path d="M22 70 C26 48 44 32 80 30 C116 32 134 48 138 70 L134 70 C130 52 114 36 80 35 C46 36 30 52 26 70Z" fill="#f7a45a" opacity="0.7" />
        <path d="M0 100 L0 86 C40 84 120 84 160 86 L160 100Z" fill="#2a1a12" />
      </>
    ),
  },

  'capitol-reef': {
    view: 'Capitol Dome over the Fruita orchards',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#4d84c8', '#bcd5ea']} />
        {/* White Navajo sandstone domes on red Wingate cliffs. */}
        {[
          [18, 18, 14],
          [52, 24, 20],
          [84, 14, 16],
          [120, 20, 22],
          [152, 16, 14],
        ].map(([x, rx, top], i) => (
          <g key={i}>
            <path d={`M${x - rx} 50 C${x - rx} ${top + 8} ${x - rx * 0.4} ${top} ${x} ${top} C${x + rx * 0.4} ${top} ${x + rx} ${top + 8} ${x + rx} 50Z`} fill="#efe2c8" />
            <path d={`M${x} ${top} C${x + rx * 0.4} ${top} ${x + rx} ${top + 8} ${x + rx} 50 L${x + rx * 0.3} 50 C${x + rx * 0.4} ${top + 12} ${x + rx * 0.2} ${top + 4} ${x} ${top}Z`} fill="#cdbd9f" />
          </g>
        ))}
        <path d={land([[0, 48], [30, 47], [60, 49], [100, 46], [160, 48]], 72)} fill="#b24a2c" />
        <path d="M6 48 L5 72 M19 47 L21 70 M37 48 L35 72 M52 48 L54 66 M71 48 L70 72 M88 47 L90 70 M107 46 L105 72 M121 47 L123 68 M140 47 L138 72 M154 48 L155 70" stroke="#8a321c" strokeWidth="1.1" />
        <path d={hills([[0, 72], [40, 68], [80, 72], [120, 68], [160, 72]], 80)} fill="#c77a4a" />
        {/* The orchard and the old barn. */}
        <rect x="0" y="80" width="160" height="20" fill="#7e9a44" />
        <g fill="#4f6d2b">
          {Array.from({ length: 16 }, (_, i) => (
            <circle key={i} cx={6 + (i % 8) * 12 + (i >= 8 ? 6 : 0)} cy={i >= 8 ? 94 : 86} r={i >= 8 ? 5 : 4} />
          ))}
        </g>
        <path d="M112 90 L112 80 L122 74 L132 80 L132 90Z" fill="#8a3b22" />
        <path d="M110 80 L122 72 L134 80" stroke="#5a2a18" strokeWidth="1.4" fill="none" />
        <rect x="119" y="83" width="6" height="7" fill="#3a1d12" />
      </>
    ),
  },

  'mesa-verde': {
    view: 'Cliff Palace in its alcove',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#5d8fcf', '#cfe0ee']} />
        <path d={hills([[0, 22], [40, 18], [80, 22], [120, 16], [160, 20]], 30)} fill="#6b7b44" />
        <rect x="0" y="24" width="160" height="76" fill="#d9b88a" />
        {/* The alcove: a deep shadowed overhang. */}
        <path d="M14 66 C18 44 50 34 80 34 C112 34 140 44 146 66Z" fill="#5a3b24" />
        <path d="M0 24 H160" stroke="#b89568" strokeWidth="2" />
        {/* The pueblo: rooms, a round tower, doorways. */}
        <g fill="#e6caa0">
          <rect x="26" y="56" width="16" height="10" />
          <rect x="42" y="50" width="12" height="16" />
          <rect x="54" y="54" width="18" height="12" />
          <rect x="72" y="44" width="8" height="22" />
          <rect x="80" y="52" width="20" height="14" />
          <rect x="100" y="48" width="12" height="18" />
          <rect x="112" y="56" width="20" height="10" />
          <rect x="89" y="42" width="7" height="10" rx="3.5" />
        </g>
        <g fill="#6b4a2d">
          <rect x="45" y="56" width="2" height="3" />
          <rect x="58" y="58" width="2" height="3" />
          <rect x="75" y="50" width="2" height="3" />
          <rect x="86" y="56" width="2" height="3" />
          <rect x="104" y="54" width="2" height="3" />
          <rect x="118" y="59" width="2" height="3" />
          <rect x="30" y="59" width="2" height="3" />
        </g>
        <path d="M14 66 H146" stroke="#b89568" strokeWidth="1.5" />
        <path d={hills([[0, 80], [30, 74], [70, 82], [110, 76], [160, 82]])} fill="#8a6a44" />
        <g fill="#4d5e2c">
          <circle cx="12" cy="86" r="6" />
          <circle cx="36" cy="90" r="5" />
          <circle cx="126" cy="88" r="6" />
          <circle cx="150" cy="84" r="7" />
        </g>
      </>
    ),
  },

  'great-sand-dunes': {
    view: 'The dunes under the Sangre de Cristo range',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#4b7fc3', '#bad2e8']} />
        <path d={land([[0, 46], [20, 30], [34, 36], [52, 20], [70, 34], [88, 26], [106, 38], [126, 22], [144, 34], [160, 30]], 56)} fill="#6f7c96" />
        <path d="M52 20 l5 6 l-9 2Z M126 22 l5 6 l-9 1Z M20 30 l4 5 l-7 1Z M88 26 l4 5 l-7 1Z" fill="#f2f4f8" />
        <path d={hills([[0, 56], [40, 52], [80, 56], [120, 52], [160, 56]], 60)} fill="#56683e" />
        {/* Sharp-crested dunes, sunlit on one face. */}
        <path d="M0 80 L0 64 C14 60 24 56 34 50 C44 56 60 62 80 64 C94 58 104 48 116 42 C130 50 146 58 160 60 L160 80Z" fill="#e4bf86" />
        <path d="M34 50 C44 56 60 62 80 64 L80 80 L40 80Z M116 42 C130 50 146 58 160 60 L160 80 L120 80Z" fill="#b98a55" />
        <path d="M0 80 C20 74 40 70 60 74 C70 70 80 66 92 70 C110 74 130 76 160 72 L160 88 L0 88Z" fill="#d9ad72" />
        {/* Medano Creek, a sheet of water over sand. */}
        <rect x="0" y="88" width="160" height="12" fill="#c9a877" />
        <path d="M0 92 C40 90 80 94 120 91 C140 90 150 92 160 92 L160 97 C120 96 80 99 40 96 C20 95 10 97 0 97Z" fill="#8fb6c9" />
      </>
    ),
  },

  'black-canyon': {
    view: 'The Painted Wall above the Gunnison',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#6f9ad0', '#d6e3ee']} />
        {/* Walls so steep the floor is barely lit. */}
        <path d="M0 100 L0 18 L30 22 L50 30 L64 60 L74 100Z" fill="#4c4652" />
        <path d="M160 100 L160 16 L120 20 L100 28 L90 62 L84 100Z" fill="#5f5866" />
        <path d="M100 28 L90 62 L84 100 L94 100 L100 64 L108 30Z" fill="#403a46" />
        {/* The pink pegmatite dikes that paint the wall. */}
        <path d="M110 30 L118 44 L112 52 L124 66 L116 80 M130 22 L126 38 L138 50 L130 64 L142 78 M146 20 L152 34 L144 46 L156 58" stroke="#e6a9b3" strokeWidth="1.4" fill="none" />
        <path d="M20 26 L28 40 L22 54 M40 30 L44 44 L38 58" stroke="#c89aa6" strokeWidth="1" fill="none" opacity="0.7" />
        <path d="M74 100 L78 80 L80 100Z" fill="#2c2830" />
        <path d="M76 100 C77 94 79 90 80 86" stroke="#6fa38c" strokeWidth="1.4" fill="none" />
        <path d={hills([[0, 20], [20, 16], [40, 22]], 26)} fill="#6d7a45" />
        <path d={hills([[118, 20], [140, 14], [160, 18]], 24)} fill="#6d7a45" />
      </>
    ),
  },

  'petrified-forest': {
    view: 'Petrified logs below the banded badlands',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#5f93d1', '#d3e4f0']} />
        {/* The Painted Desert: rounded hills in bands of colour. */}
        <path d={hills([[0, 60], [20, 44], [44, 54], [66, 40], [92, 52], [118, 38], [140, 50], [160, 44]], 74)} fill="#b8a3c7" />
        <path d={hills([[0, 58], [20, 48], [44, 58], [66, 46], [92, 56], [118, 44], [140, 54], [160, 50]], 74)} fill="#c97f6e" />
        <path d={hills([[0, 64], [20, 56], [44, 64], [66, 54], [92, 62], [118, 54], [140, 60], [160, 58]], 74)} fill="#e7d4c0" />
        <path d={hills([[0, 70], [20, 64], [44, 70], [66, 62], [92, 68], [118, 62], [140, 68], [160, 64]], 74)} fill="#8a6aa0" />
        <rect x="0" y="72" width="160" height="28" fill="#c9a882" />
        {/* The logs, broken into rounds, rainbow-grained at the breaks. */}
        {[
          [20, 88, 22],
          [44, 90, 18],
          [66, 86, 20],
          [100, 92, 26],
          [128, 90, 20],
        ].map(([x, y, w], i) => (
          <g key={i}>
            <rect x={x} y={y - 4} width={w} height="8" rx="1" fill="#8a5a4a" />
            <path d={`M${x} ${y - 4} h${w} v2 h${-w}Z`} fill="#b07a5f" />
            <ellipse cx={x + w} cy={y} rx="3" ry="4" fill="#e39a5c" />
            <ellipse cx={x + w} cy={y} rx="1.8" ry="2.6" fill="#c9566b" />
            <ellipse cx={x + w} cy={y} rx="0.8" ry="1.2" fill="#f2d27a" />
          </g>
        ))}
      </>
    ),
  },

  saguaro: {
    view: 'Saguaros at sunset in the Tucson Mountains',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#4a3c7a', '#d45f5c', '#f4a259', '#f9d58a']} />
        <Sun x={96} y={70} r={10} fill="#ffe3a0" />
        <path d={land([[0, 70], [16, 62], [30, 66], [48, 56], [64, 64], [84, 60], [110, 68], [130, 58], [150, 64], [160, 62]], 78)} fill="#6d3f63" />
        <path d={hills([[0, 80], [40, 76], [80, 80], [120, 76], [160, 80]])} fill="#3c2240" />
        <rect x="0" y="86" width="160" height="14" fill="#241428" />
        <Saguaro x={38} y={96} h={60} fill="#1a0f1c" />
        <Saguaro x={118} y={94} h={38} fill="#1a0f1c" />
        <Saguaro x={72} y={90} h={18} fill="#1a0f1c" />
        <Saguaro x={146} y={92} h={24} fill="#1a0f1c" />
        {/* An ocotillo. */}
        <path d="M96 94 l-6 -18 M96 94 l-2 -20 M96 94 l3 -19 M96 94 l7 -16" stroke="#1a0f1c" strokeWidth="0.8" />
        <Bird x={60} y={30} />
      </>
    ),
  },

  'big-bend': {
    view: 'Santa Elena Canyon on the Rio Grande',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#6b93cf', '#f0c79c']} />
        {/* Sheer limestone walls, cut through by the river. */}
        <path d={land([[0, 30], [30, 26], [60, 28], [70, 30], [74, 90]], 90)} fill="#c49a6c" />
        <path d={land([[82, 90], [86, 28], [110, 24], [140, 28], [160, 26]], 90)} fill="#a8794e" />
        <path d="M60 28 L70 30 L74 90 L66 90Z" fill="#9a6a44" />
        <path d="M86 28 L82 90 L90 90 L92 30Z" fill="#8a5c3a" />
        <path d="M0 40 H72 M0 52 H73 M84 38 H160 M84 50 H160" stroke="#9a7048" strokeWidth="0.8" opacity="0.6" />
        <path d="M74 90 L74 34 L86 32 L82 90Z" fill="#7d6a8c" opacity="0.5" />
        {/* The river, and a desert flat of creosote. */}
        <path d="M60 90 C70 88 80 88 96 90 C110 92 120 96 140 100 L40 100 C48 96 54 92 60 90Z" fill="#7a9e8f" />
        <path d="M0 90 H60 C54 92 48 96 40 100 H0Z" fill="#8a7a4e" />
        <path d="M96 90 H160 V100 H140 C120 96 110 92 96 90Z" fill="#8a7a4e" />
        <g fill="#5a6a34">
          <circle cx="10" cy="94" r="3" />
          <circle cx="24" cy="96" r="2.4" />
          <circle cx="134" cy="94" r="2.6" />
          <circle cx="150" cy="96" r="3.2" />
        </g>
      </>
    ),
  },

  guadalupe: {
    view: 'El Capitan, the prow of an ancient reef',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#5d8ed0', '#e6d2b4']} />
        <Cloud x={120} y={20} s={1.2} />
        {/* Guadalupe Peak behind, El Capitan's sheer prow in front. */}
        <path d={land([[20, 56], [50, 30], [60, 22], [70, 26], [90, 40]], 60)} fill="#9c8e84" />
        <path d="M40 100 L44 60 L52 38 L60 30 L66 30 L70 36 L74 70 L82 100Z" fill="#e3d6c3" />
        <path d="M66 30 L70 36 L74 70 L82 100 L72 100 L68 40Z" fill="#b5a794" />
        <path d={land([[74, 70], [90, 56], [110, 52], [140, 56], [160, 54]], 100)} fill="#b59e82" />
        <path d="M44 60 H70 M46 50 H69" stroke="#c2b3a0" strokeWidth="0.8" />
        {/* The Chihuahuan Desert floor. */}
        <path d={hills([[0, 84], [40, 80], [80, 86], [120, 80], [160, 84]])} fill="#c7a878" />
        <rect x="0" y="92" width="160" height="8" fill="#a88a5e" />
        <Yucca x={20} y={96} s={1.4} fill="#4d5a2c" />
        <Yucca x={128} y={94} s={1.1} fill="#4d5a2c" />
        <g fill="#6a7a3c">
          <circle cx="100" cy="92" r="2.4" />
          <circle cx="46" cy="94" r="2" />
          <circle cx="150" cy="90" r="2.6" />
        </g>
      </>
    ),
  },

  'white-sands': {
    view: 'Gypsum dunes and a soaptree yucca at dusk',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#6b6aa8', '#e7a5b3', '#f6d2b8']} />
        <path d={land([[0, 58], [20, 50], [40, 54], [60, 44], [84, 52], [110, 46], [134, 54], [160, 50]], 62)} fill="#7a6a9a" />
        {/* White sand, shadowed blue-violet on the lee sides. */}
        <path d="M0 100 L0 66 C20 62 40 58 56 60 C70 62 90 66 110 62 C130 58 146 60 160 62 L160 100Z" fill="#f6f1f4" />
        <path d="M56 60 C70 62 90 66 110 62 L110 70 C90 72 70 70 56 68Z" fill="#c9c3dc" />
        <path d="M0 100 L0 82 C30 74 60 72 90 78 C110 82 130 80 160 76 L160 100Z" fill="#fbf7f8" />
        <path d="M90 78 C110 82 130 80 160 76 L160 86 C130 90 110 90 90 86Z" fill="#d6d0e6" />
        <path d="M10 92 C30 90 50 94 70 92 M90 96 C110 94 130 97 150 95" stroke="#dcd6e9" strokeWidth="0.8" fill="none" />
        <Yucca x={44} y={86} s={1.8} fill="#3a3a52" />
        <Yucca x={120} y={74} s={0.9} fill="#4a4a66" />
      </>
    ),
  },

  carlsbad: {
    view: 'Stalagmites in the Big Room',
    draw: () => (
      <>
        <rect width="160" height="100" fill="#1c140f" />
        {/* Warm light pooled on the formations. */}
        <ellipse cx="80" cy="72" rx="70" ry="34" fill="#4a3322" />
        <ellipse cx="80" cy="74" rx="44" ry="20" fill="#6e4c30" />
        {/* Stalactites from the ceiling. */}
        <path d="M0 0 H160 V10 L152 22 L148 10 L140 28 L134 12 L124 20 L118 8 L108 30 L102 10 L92 18 L86 6 L78 24 L72 8 L64 16 L56 6 L48 26 L42 10 L34 18 L26 8 L18 24 L12 10 L6 16 L0 8Z" fill="#3a2a1e" />
        {/* Stalagmites rising to meet them. */}
        <path d="M20 100 L26 70 L30 64 L34 72 L40 100Z" fill="#c99a68" />
        <path d="M44 100 L50 54 L54 48 L58 56 L64 100Z" fill="#dab07c" />
        <path d="M98 100 L104 60 L108 52 L112 62 L118 100Z" fill="#d4a674" />
        <path d="M124 100 L128 76 L132 72 L136 80 L140 100Z" fill="#b88a5c" />
        <path d="M66 100 L70 80 L74 76 L78 84 L80 100Z" fill="#a67a4e" />
        <path d="M54 48 L58 56 L64 100 L58 100Z M108 52 L112 62 L118 100 L112 100Z" fill="#9a6e44" />
        {/* A still pool, and the handrail of the path. */}
        <ellipse cx="86" cy="94" rx="22" ry="3" fill="#6a8a8a" opacity="0.7" />
        <path d="M0 88 H160" stroke="#8a6a4a" strokeWidth="0.8" />
        <path d="M10 88 V96 M40 88 V96 M140 88 V96" stroke="#8a6a4a" strokeWidth="0.8" />
        {/* One of the cave's bats. */}
        <Bird x={130} y={40} s={0.8} stroke="#6e4c30" />
        <Ripples y={93} x1={70} x2={100} rows={2} gap={2} opacity={0.3} />
      </>
    ),
  },
};
