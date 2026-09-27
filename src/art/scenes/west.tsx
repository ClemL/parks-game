import { Bird, Cloud, hills, land, Pine, Pines, poly, Reflection, Ripples, Sky, Sun } from '../kit';
import type { ParkScene } from './types';

/** A Joshua tree: a shaggy trunk that forks into arms tipped with spiky tufts. */
function JoshuaTree({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  const tuft = (cx: number, cy: number) => (
    <path
      d={`M${cx} ${cy} l-2.6 -1.4 l2 0.2 l-1.6 -2.2 l2.1 1.2 l0.1 -2.6 l1 2.4 l1.4 -2 l-0.3 2.5 l2.2 -0.9 l-1.6 1.8 l2.1 0.5 Z`}
      fill={fill}
    />
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M0 0 L0 -14 M0 -9 C-3 -11 -6 -13 -6 -18 M0 -14 C2 -16 5 -17 6 -22 M0 -12 C1 -15 0 -19 -1 -23 M5 -18 C8 -19 10 -21 10 -24"
        stroke={fill}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      {tuft(-6, -18)}
      {tuft(6, -22)}
      {tuft(-1, -23)}
      {tuft(10, -24)}
    </g>
  );
}

export const WEST: Record<string, ParkScene> = {
  yosemite: {
    view: 'Tunnel View — El Capitan, Half Dome and Bridalveil Fall',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#7fa6c4', '#b9cbd3', '#ecd9b0']} />
        <Cloud x={70} y={20} s={1.2} opacity={0.6} />
        <path d={hills([[40, 64], [70, 58], [95, 60], [130, 55], [160, 60]])} fill="#a7b4bf" />
        {/* Half Dome, its sheer face turned toward the valley. */}
        <path d="M98 66 L100 46 C102 40 108 38 113 41 C119 45 123 54 126 66Z" fill="#8f9dab" />
        <path d="M98 66 L100 46 C101 43 103 41 105 40 L103 66Z" fill="#7c8a99" />
        <path d={hills([[30, 72], [60, 66], [90, 68], [120, 64], [160, 70]])} fill="#6f8579" />
        {/* El Capitan. */}
        <path d="M0 100 L0 20 C10 15 27 15 36 20 C41 24 44 31 45 38 L50 80 L0 82Z" fill="#cfc6b4" />
        <path d="M36 20 C41 24 44 31 45 38 L50 80 L40 80 L38 40 C37 32 36 26 33 19Z" fill="#aca290" />
        {/* Cathedral Rocks and the fall. */}
        <path d="M160 100 L160 26 C150 26 140 30 134 38 L126 80 L160 82Z" fill="#bdb3a2" />
        <path d="M134 38 L126 80 L133 80 L137 42Z" fill="#9f9584" />
        <path d="M140.5 46 L142 46 L143 72 L140 72Z" fill="#f4f7f8" />
        <ellipse cx="141.5" cy="73" rx="5" ry="2.2" fill="#f4f7f8" opacity="0.7" />
        <rect x="0" y="70" width="160" height="10" fill="#e8e4d6" opacity="0.28" />
        <path d={hills([[0, 84], [30, 78], [60, 82], [95, 77], [130, 81], [160, 78]])} fill="#3e5a47" />
        <Pines from={2} to={158} y={100} h={20} fill="#223a2e" step={6} />
      </>
    ),
  },

  sequoia: {
    view: 'The General Sherman tree',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#9fb9a6', '#c8d5b8', '#e3dcc0']} />
        {/* Light falling between the trunks. */}
        <path d={poly([[95, 0], [112, 0], [70, 100], [48, 100]])} fill="#fff6d8" opacity="0.28" />
        <rect x="18" y="0" width="9" height="100" fill="#a2785f" opacity="0.55" />
        <rect x="128" y="0" width="12" height="100" fill="#a2785f" opacity="0.55" />
        <Pines from={0} to={40} y={86} h={30} fill="#5d7a5c" step={9} />
        <Pines from={112} to={160} y={86} h={30} fill="#5d7a5c" step={9} />
        {/* The giant: a cinnamon column flaring at the foot. */}
        <path d="M62 0 L100 0 L101 70 C102 80 108 86 116 90 L44 90 C52 86 58 80 59 70Z" fill="#9b4e2e" />
        <path d="M68 0 L72 0 L71 86 L66 86Z M82 0 L85 0 L86 88 L82 88Z M92 0 L94 0 L96 86 L93 84Z" fill="#7c3a20" />
        <path d="M62 0 L65 0 L64 70 C63 80 58 86 50 90 L44 90 C52 86 58 80 59 70Z" fill="#6d321c" />
        <path d="M76 40 C79 37 83 38 84 42 L84 56 C82 58 78 58 76 56Z" fill="#5a2814" opacity="0.6" />
        <path d={hills([[0, 90], [40, 87], [80, 91], [120, 86], [160, 90]])} fill="#557a3e" />
        {/* A person, for scale. */}
        <g fill="#1f2a24">
          <circle cx="122" cy="84.2" r="0.9" />
          <rect x="121.3" y="85" width="1.4" height="3.6" rx="0.5" />
        </g>
        <rect x="0" y="92" width="160" height="8" fill="#3e5c2f" />
        <path d="M10 100 q4 -8 8 0 M28 100 q5 -10 10 0 M130 100 q4 -8 8 0 M146 100 q5 -9 9 0" stroke="#2f4a25" strokeWidth="1.5" fill="none" />
      </>
    ),
  },

  'kings-canyon': {
    view: 'Zumwalt Meadow under the Grand Sentinel',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#6e9fd0', '#b6d0e2']} />
        <Cloud x={38} y={18} s={1.1} />
        {/* The glacier-cut U of the canyon. */}
        <path d="M0 100 L0 14 C14 18 30 30 42 52 L56 76 L0 80Z" fill="#b3aa9a" />
        <path d="M30 30 C36 38 40 46 42 52 L56 76 L46 76Z" fill="#958c7d" />
        <path d="M160 100 L160 20 C150 20 138 18 128 22 C120 26 114 38 110 52 L100 76 L160 80Z" fill="#c4bba9" />
        <path d="M128 22 C120 26 114 38 110 52 L100 76 L108 76 L116 48 C119 36 124 28 130 22Z" fill="#a19887" />
        <path d={hills([[20, 70], [60, 72], [80, 66], [110, 72], [140, 68]])} fill="#8ea3a8" />
        <Pines from={2} to={60} y={82} h={16} fill="#3f5c43" step={5} />
        <Pines from={104} to={158} y={82} h={16} fill="#3f5c43" step={5} />
        <rect x="0" y="80" width="160" height="20" fill="#9bb164" />
        {/* The Kings River winding through the meadow. */}
        <path d="M0 94 C30 90 50 98 80 92 C100 88 120 96 160 90 L160 96 C120 102 100 94 80 98 C50 104 30 96 0 100Z" fill="#5f97b8" />
        <Pines from={4} to={30} y={100} h={14} fill="#2c4430" step={7} />
        <Pines from={132} to={158} y={100} h={14} fill="#2c4430" step={7} />
      </>
    ),
  },

  'joshua-tree': {
    view: 'Joshua trees and the Jumbo Rocks at dusk',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#3b3f75', '#b5577a', '#f29a5c', '#f7c873']} />
        <Sun x={104} y={74} r={11} fill="#fcd98a" />
        <path d={land([[0, 72], [22, 66], [40, 70], [66, 64], [92, 70], [120, 66], [160, 71]])} fill="#6b4a6e" />
        {/* Boulder piles. */}
        <g fill="#4a2f45">
          <ellipse cx="118" cy="80" rx="18" ry="10" />
          <ellipse cx="132" cy="72" rx="11" ry="8" />
          <ellipse cx="146" cy="78" rx="14" ry="10" />
          <ellipse cx="124" cy="66" rx="7" ry="6" />
          <ellipse cx="20" cy="82" rx="16" ry="8" />
          <ellipse cx="10" cy="75" rx="8" ry="6" />
        </g>
        <rect x="0" y="84" width="160" height="16" fill="#2c1d2e" />
        <JoshuaTree x={52} y={86} s={2} fill="#1c1320" />
        <JoshuaTree x={86} y={86} s={1.1} fill="#1c1320" />
        <JoshuaTree x={30} y={85} s={0.8} fill="#1c1320" />
      </>
    ),
  },

  'death-valley': {
    view: 'Manly Beacon from Zabriskie Point at sunrise',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#7fa3c8', '#e7c7b5', '#f6dca9']} />
        {/* The Panamint Range across the valley. */}
        <path d={land([[0, 50], [20, 44], [38, 48], [60, 38], [80, 44], [104, 36], [128, 46], [160, 42]])} fill="#a291ae" />
        <rect x="0" y="52" width="160" height="6" fill="#e9dfd0" />
        {/* Manly Beacon and the badlands. */}
        <path d="M50 100 L58 70 L68 60 L74 44 L78 42 L84 58 L96 66 L104 100Z" fill="#b8742f" />
        <path d="M74 44 L78 42 L84 58 L96 66 L104 100 L86 100 L82 64Z" fill="#8a5220" />
        <path d={hills([[0, 70], [16, 62], [30, 70], [44, 64], [60, 76]])} fill="#dcb56b" />
        <path d={hills([[96, 76], [110, 64], [124, 70], [140, 60], [160, 68]])} fill="#dcb56b" />
        <path d={hills([[0, 84], [20, 74], [40, 84], [60, 76], [80, 86], [100, 76], [122, 84], [142, 74], [160, 82]])} fill="#c28e45" />
        {/* The dark bands of the old lakebed. */}
        <path d={hills([[0, 92], [26, 84], [52, 94], [80, 86], [108, 94], [134, 86], [160, 92]])} fill="#5e4632" />
        <path d="M0 100 C30 92 60 100 90 94 C120 90 140 98 160 94 L160 100Z" fill="#e3c483" />
      </>
    ),
  },

  redwood: {
    view: 'Coast redwoods in morning fog',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#c8d5c9', '#e8eadc']} />
        {/* Far trunks, lost in the fog. */}
        {[8, 30, 50, 96, 118, 150].map((x, i) => (
          <rect key={x} x={x} y="0" width={3 + (i % 3)} height="100" fill="#b69a8a" opacity="0.5" />
        ))}
        {[18, 72, 108, 140].map((x, i) => (
          <rect key={x} x={x} y="0" width={5 + (i % 2) * 2} height="100" fill="#955c44" opacity="0.8" />
        ))}
        {/* Sun beams slanting through. */}
        <path d={poly([[70, 0], [86, 0], [52, 100], [30, 100]])} fill="#fffbe0" opacity="0.35" />
        <path d={poly([[102, 0], [110, 0], [86, 100], [74, 100]])} fill="#fffbe0" opacity="0.25" />
        {/* The near giants. */}
        <path d="M38 0 L52 0 L54 90 L34 90Z" fill="#7a3a22" />
        <path d="M42 0 L44 0 L44 90 L41 90Z M48 0 L49 0 L50 90 L48 90Z" fill="#5d2915" />
        <path d="M122 0 L132 0 L134 90 L119 90Z" fill="#6d3320" />
        <path d="M0 0 L8 0 L9 90 L0 90Z" fill="#5d2915" />
        {/* Ferns and sorrel on the floor. */}
        <path d={hills([[0, 88], [20, 82], [40, 90], [60, 84], [80, 90], [100, 82], [120, 88], [140, 82], [160, 88]])} fill="#5f8a3e" />
        {[6, 24, 62, 88, 104, 146].map((x) => (
          <path key={x} d={`M${x} 100 q-6 -10 -12 -8 M${x} 100 q0 -12 2 -14 M${x} 100 q6 -10 12 -8`} stroke="#355f26" strokeWidth="1.6" fill="none" />
        ))}
        <rect x="0" y="96" width="160" height="4" fill="#355f26" />
      </>
    ),
  },

  pinnacles: {
    view: 'The High Peaks, with a condor overhead',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#7fb1dd', '#dbe8ee']} />
        <path d={hills([[0, 70], [40, 62], [80, 68], [120, 60], [160, 66]])} fill="#a9b597" />
        {/* The volcanic spires. */}
        <path d="M30 100 L34 66 L38 54 L42 50 L44 40 L48 38 L50 48 L54 44 L56 30 L60 28 L62 38 L66 36 L68 50 L74 46 L76 58 L82 54 L86 66 L92 62 L96 76 L104 100Z" fill="#b8683c" />
        <path d="M56 30 L60 28 L62 38 L66 36 L68 50 L74 46 L76 58 L82 54 L86 66 L92 62 L96 76 L104 100 L80 100 L72 62 L64 44Z" fill="#8d4a2a" />
        <path d="M104 100 L110 72 L114 66 L118 70 L124 60 L128 64 L134 100Z" fill="#a95d36" />
        <path d={hills([[0, 86], [26, 80], [50, 90], [80, 84], [110, 90], [136, 82], [160, 88]])} fill="#6d7e46" />
        <g fill="#4e5f34">
          {[10, 22, 40, 112, 128, 150].map((x, i) => (
            <circle key={x} cx={x} cy={92 + (i % 2) * 2} r={5 + (i % 3)} />
          ))}
        </g>
        <rect x="0" y="95" width="160" height="5" fill="#4e5f34" />
        {/* A California condor, wings spread flat. */}
        <path d="M112 22 C118 20 124 18 130 20 C134 19 138 19 142 21 C138 22 134 24 130 23 C126 25 118 25 112 22Z" fill="#1d1d1d" />
        <circle cx="130" cy="20.4" r="1.1" fill="#e07a5f" />
      </>
    ),
  },

  'channel-islands': {
    view: 'Arch Rock off Anacapa Island',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#8ec3e6', '#e0eef2']} />
        <path d={hills([[60, 62], [90, 56], [120, 58], [160, 54]], 66)} fill="#9aa9a4" />
        <rect x="0" y="64" width="160" height="36" fill="#2f7ea6" />
        <Ripples y={70} rows={6} gap={4.5} opacity={0.3} />
        {/* The arch: a rock with a hole the sea runs through. */}
        <path
          fillRule="evenodd"
          d="M22 76 L26 50 C30 42 46 40 60 44 C70 46 76 52 78 60 L80 76Z M40 76 C40 66 46 60 52 60 C58 60 62 66 62 76Z"
          fill="#6b5a4a"
        />
        <path d="M26 50 C30 42 46 40 60 44 C70 46 76 52 78 60 C66 54 44 50 26 52Z" fill="#8f8a5c" />
        <path d="M60 44 C70 46 76 52 78 60 L80 76 L72 76 L70 58Z" fill="#524436" />
        <ellipse cx="51" cy="77" rx="30" ry="2" fill="#e8f4f7" opacity="0.6" />
        <Bird x={112} y={30} s={1.4} />
        <Bird x={124} y={36} s={1.1} />
        <Bird x={100} y={38} s={0.9} />
      </>
    ),
  },

  lassen: {
    view: 'Lassen Peak over Manzanita Lake',
    draw: (k) => {
      const above = (
        <>
          <path d="M40 60 L62 34 L70 26 L78 24 L88 28 L96 36 L120 60Z" fill="#8a8c93" />
          <path d="M62 34 L70 26 L74 30 L66 40Z M78 24 L88 28 L84 34 L80 30Z M90 32 L96 36 L92 40Z" fill="#f3f5f7" />
          <path d="M78 24 L88 28 L96 36 L120 60 L96 60 L86 36Z" fill="#6c6e76" />
          <path d={hills([[0, 60], [30, 54], [50, 60]], 64)} fill="#476a50" />
          <path d={hills([[110, 60], [134, 52], [160, 58]], 64)} fill="#476a50" />
          <Pines from={0} to={48} y={64} h={14} fill="#2c4a35" step={5} />
          <Pines from={112} to={160} y={64} h={14} fill="#2c4a35" step={5} />
        </>
      );
      return (
        <>
          <Sky k={k} stops={['#6c97c9', '#f0c9a2']} />
          <path d="M100 26 q2 -4 0 -8 q-2 -4 1 -8" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.5" />
          {above}
          <rect x="0" y="64" width="160" height="36" fill="#557ea0" />
          <Reflection k={k} y={64} opacity={0.5}>
            {above}
          </Reflection>
          <Ripples y={80} rows={4} gap={4} opacity={0.3} />
          <path d={hills([[0, 96], [30, 92], [60, 97], [100, 93], [160, 96]])} fill="#2a3a2c" />
        </>
      );
    },
  },

  'crater-lake': {
    view: 'Wizard Island in the caldera, from the rim',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#5b8fc9', '#c7dcea']} />
        <Cloud x={120} y={18} />
        {/* The far wall of the caldera. */}
        <path d={land([[0, 44], [22, 40], [44, 44], [70, 38], [96, 42], [122, 36], [140, 40], [160, 38]])} fill="#8e8274" />
        <path d="M10 44 l6 -3 l4 3Z M70 40 l6 -3 l6 3Z M122 38 l6 -3 l6 3Z" fill="#f2f4f6" />
        <path d={land([[0, 50], [40, 48], [80, 50], [120, 48], [160, 50]])} fill="#6c6358" />
        <rect x="0" y="52" width="160" height="48" fill="#1b4f95" />
        <rect x="0" y="52" width="160" height="4" fill="#2c67ad" />
        {/* Wizard Island, a cinder cone inside the cone. */}
        <path d="M28 64 C34 60 38 54 44 50 C48 50 52 54 56 60 C60 62 66 64 70 64Z" fill="#3c4b35" />
        <path d="M42 51 L46 51 L45 53 L43 53Z" fill="#2a2f25" />
        <Ripples y={70} rows={4} gap={5} opacity={0.18} />
        {/* The near rim, with a mountain hemlock. */}
        <path d="M0 100 L0 80 C20 84 40 92 70 96 L90 100Z" fill="#5a4d42" />
        <path d="M160 100 L160 76 C140 80 124 90 104 100Z" fill="#6e5f50" />
        <Pine x={144} y={92} h={40} fill="#233b2b" />
        <Pine x={152} y={90} h={26} fill="#2e4a36" />
      </>
    ),
  },

  rainier: {
    view: 'The mountain over the wildflower meadows at Paradise',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#4f86c6', '#b8d3ea']} />
        {/* Rainier: a broad glaciated dome. */}
        <path d="M18 70 C40 56 56 40 70 28 C76 22 84 20 92 24 C104 32 120 50 142 70Z" fill="#eef3f7" />
        <path d="M92 24 C104 32 120 50 142 70 L112 70 C104 56 96 40 88 26Z" fill="#b9c9d8" />
        <path d="M54 50 L62 58 L50 64Z M78 34 L84 48 L74 52Z M100 42 L106 58 L98 60Z" fill="#9aa6b2" opacity="0.7" />
        <path d={hills([[0, 72], [30, 64], [60, 72], [100, 66], [130, 72], [160, 64]])} fill="#5f8664" />
        <path d={hills([[0, 84], [40, 76], [80, 82], [120, 76], [160, 82]])} fill="#8bb05a" />
        {/* The flower meadow. */}
        {Array.from({ length: 44 }, (_, i) => {
          const x = (i * 37) % 160;
          const y = 84 + ((i * 13) % 15);
          const fill = ['#d9485f', '#8a5cc7', '#f2c94c', '#ffffff'][i % 4];
          return <circle key={i} cx={x} cy={y} r={1 + (y - 84) / 12} fill={fill} />;
        })}
        <Pine x={12} y={96} h={36} fill="#223a2c" />
        <Pine x={22} y={94} h={24} fill="#2d4a36" />
        <Pine x={148} y={96} h={32} fill="#223a2c" />
      </>
    ),
  },

  olympic: {
    view: 'Sea stacks on Ruby Beach',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#9aa9b8', '#e5cfc6', '#f0dcc4']} />
        <rect x="0" y="58" width="160" height="16" fill="#8b9fb0" />
        {/* The stacks, capped with spruce. */}
        <path d="M70 74 L72 50 C74 44 82 42 88 46 L92 52 L94 74Z" fill="#3d3a3b" />
        <Pines from={72} to={90} y={48} h={10} fill="#243528" step={3} />
        <path d="M112 74 L114 56 C116 52 122 52 124 56 L126 74Z" fill="#4a4647" />
        <Pines from={114} to={124} y={55} h={7} fill="#243528" step={3} />
        <path d="M40 74 L42 64 L48 62 L52 74Z" fill="#524e4f" />
        <path d="M0 74 L0 36 C10 38 18 44 22 52 L28 74Z" fill="#2f2c2d" />
        <Pines from={0} to={20} y={42} h={14} fill="#1c2a20" step={4} />
        {/* Surf and wet sand. */}
        <path d="M0 74 C40 72 80 76 120 72 C140 71 150 73 160 72 L160 78 L0 78Z" fill="#eef1f2" />
        <rect x="0" y="78" width="160" height="22" fill="#9a8f84" />
        <rect x="0" y="78" width="160" height="6" fill="#c7bdb3" opacity="0.6" />
        <Reflection k={k} y={78} opacity={0.2}>
          <path d="M70 78 L72 54 C74 48 82 46 88 50 L92 56 L94 78Z" fill="#3d3a3b" />
        </Reflection>
        {/* Driftwood. */}
        <g fill="#d8cbb8">
          <rect x="8" y="90" width="52" height="3.2" rx="1.6" transform="rotate(-6 34 91)" />
          <rect x="30" y="94" width="40" height="2.6" rx="1.3" transform="rotate(4 50 95)" />
          <rect x="104" y="92" width="48" height="3" rx="1.5" transform="rotate(5 128 93)" />
        </g>
      </>
    ),
  },

  'north-cascades': {
    view: 'Diablo Lake under Colonial Peak',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#5f93cf', '#cfe0ec']} />
        <path d={land([[0, 50], [16, 30], [26, 38], [40, 18], [52, 30], [64, 22], [78, 40], [94, 26], [110, 36], [126, 16], [140, 30], [160, 24]], 64)} fill="#6b7482" />
        <path d="M40 18 L46 24 L44 30 L38 24Z M64 22 L68 28 L60 30Z M126 16 L132 24 L128 30 L122 24Z M94 26 L100 32 L90 32Z" fill="#f4f6f8" />
        <path d={hills([[0, 58], [20, 46], [44, 56], [70, 44], [96, 56], [124, 44], [160, 54]], 72)} fill="#2f5a3f" />
        <Pines from={0} to={160} y={70} h={12} fill="#1f4230" step={4} />
        {/* The glacial flour turns the lake turquoise. */}
        <path d="M0 70 C40 68 80 72 120 69 C140 68 150 70 160 70 L160 100 L0 100Z" fill="#2fb3b0" />
        <Ripples y={78} rows={5} gap={4} opacity={0.3} />
        <path d={hills([[0, 92], [20, 86], [40, 94]], 100)} fill="#1a3326" />
        <path d={hills([[110, 94], [140, 84], [160, 90]], 100)} fill="#1a3326" />
        <Pine x={146} y={92} h={26} fill="#15291e" />
        <Pine x={10} y={94} h={22} fill="#15291e" />
      </>
    ),
  },

  'great-basin': {
    view: 'A bristlecone pine below Wheeler Peak',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#40689e', '#a6c2df', '#f0d7b0']} />
        <path d={land([[20, 70], [50, 50], [70, 32], [82, 22], [92, 26], [110, 40], [140, 58], [160, 64]], 78)} fill="#8a8a92" />
        <path d="M70 32 L82 22 L92 26 L86 34 L80 30 L74 38Z M110 40 L118 46 L108 48Z" fill="#f2f4f6" />
        <path d="M82 22 L92 26 L110 40 L140 58 L160 64 L160 78 L120 78 L96 36Z" fill="#6c6d76" />
        <path d={land([[0, 80], [30, 72], [70, 78], [110, 70], [160, 76]])} fill="#8c7a63" />
        {/* The bristlecone: twisted, bleached, and still alive. */}
        <path d="M34 100 C30 90 36 84 32 76 C28 68 22 66 18 58 M32 76 C38 70 44 70 48 62 M33 84 C40 82 46 78 52 80" stroke="#d9c6a4" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M34 100 C30 90 36 84 32 76" stroke="#8a5a36" strokeWidth="2" fill="none" />
        <g fill="#34503a">
          <ellipse cx="18" cy="56" rx="6" ry="3" />
          <ellipse cx="48" cy="60" rx="7" ry="3" />
          <ellipse cx="54" cy="79" rx="5" ry="2.4" />
        </g>
        <path d="M0 100 L0 90 C20 88 40 94 60 96 L64 100Z" fill="#5c4d3e" />
      </>
    ),
  },
};
