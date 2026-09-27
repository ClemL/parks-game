import { Bird, Cloud, hills, land, Palm, Pines, Reflection, Ripples, Sky, Sun } from '../kit';
import type { ParkScene } from './types';

/** A caribou in side view, facing left, standing on `y`. */
function Caribou({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <path d="M-5 -6 C-5 -7.6 -3 -8 0 -7.8 L4 -7.8 C5.4 -7.8 6 -6.8 6 -5.6 L5.6 -4 L5.4 0 L4.6 0 L4.4 -3.8 L-3 -3.8 L-3.4 0 L-4.2 0 L-4.4 -4.2 C-5 -4.6 -5 -5.4 -5 -6Z" />
      <path d="M-4.4 -7 L-6.4 -10 L-8.4 -10 L-8.6 -9 L-6.6 -8.6 L-5 -6Z" />
      <path d="M-6.4 -10 C-7 -12 -6 -14 -4 -15 M-6.4 -10 C-8 -12 -9 -13 -8 -15 M-5.6 -13 l-1.4 -1 M-7.6 -12.6 l1 -1.2" stroke={fill} strokeWidth="0.5" fill="none" />
    </g>
  );
}

/** A brown bear standing at the lip of a falls, facing right, mouth open. */
function Bear({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <path d="M-8 0 L-8 -6 C-8 -10 -4 -12 0 -12 C3 -12 5 -11 6 -9.6 L9 -9.4 L10.6 -8 L9 -7.6 L10 -6.4 L7.6 -6.4 C6.6 -5.6 6.6 -4 6.6 0 L4.6 0 L4.4 -4 L-4 -4 L-4.4 0 L-6.4 0 L-6.6 -3Z" />
      <circle cx="4.6" cy="-11.4" r="1.1" />
    </g>
  );
}

export const NORTH_PACIFIC: Record<string, ParkScene> = {
  denali: {
    view: 'The mountain over Wonder Lake in autumn',
    draw: (k) => {
      const mountain = (
        <>
          <path d={land([[0, 58], [16, 50], [30, 44], [44, 30], [58, 20], [70, 14], [80, 18], [92, 12], [104, 20], [118, 32], [134, 42], [160, 52]], 62)} fill="#f1f4f8" />
          <path d="M70 14 L80 18 L92 12 L104 20 L118 32 L134 42 L160 52 L160 62 L100 62 L88 28Z" fill="#c2cfdd" />
          <path d="M44 30 L50 40 L38 44Z M58 20 L64 34 L52 38Z M104 20 L108 36 L98 40Z" fill="#9aaabd" opacity="0.6" />
          <path d={hills([[0, 60], [30, 54], [70, 60], [110, 54], [160, 60]], 66)} fill="#7a8a8a" />
          <path d={hills([[0, 66], [40, 62], [90, 66], [130, 60], [160, 64]], 70)} fill="#6a7a52" />
        </>
      );
      return (
        <>
          <Sky k={k} stops={['#5c8fcf', '#d4e4f0']} />
          {mountain}
          <rect x="0" y="70" width="160" height="30" fill="#4a6f96" />
          <Reflection k={k} y={70} opacity={0.4}>
            {mountain}
          </Reflection>
          <Ripples y={80} rows={3} gap={4} opacity={0.25} />
          {/* Tundra gone red and gold. */}
          <path d={hills([[0, 88], [30, 84], [60, 90], [100, 86], [140, 92], [160, 88]])} fill="#b8452e" />
          <path d={hills([[0, 94], [40, 90], [80, 96], [120, 92], [160, 96]])} fill="#d99a3a" />
          <Pines from={130} to={160} y={92} h={14} fill="#2e4a34" step={5} w={0.3} />
        </>
      );
    },
  },

  katmai: {
    view: 'A brown bear fishing at Brooks Falls',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#8fb0c8', '#dfe6e0']} />
        <path d={hills([[0, 40], [40, 34], [80, 40], [120, 32], [160, 38]], 48)} fill="#8a9aa0" />
        <Pines from={0} to={160} y={52} h={16} fill="#3a5a44" step={4} w={0.34} />
        <rect x="0" y="50" width="160" height="16" fill="#4a7488" />
        {/* The falls: a low ledge the salmon have to leap. */}
        <path d="M0 66 L160 62 L160 66 L0 70Z" fill="#5a5448" />
        <path d="M0 70 L160 66 L160 84 L0 88Z" fill="#e6f0f2" />
        <path d="M10 70 V86 M30 69 V86 M50 69 V85 M70 68 V85 M90 68 V84 M110 67 V84 M130 67 V84 M150 66 V83" stroke="#a9c6d2" strokeWidth="0.8" />
        <rect x="0" y="84" width="160" height="16" fill="#3a6478" />
        <ellipse cx="80" cy="86" rx="90" ry="3" fill="#ffffff" opacity="0.7" />
        <Ripples y={90} rows={3} gap={3} opacity={0.3} />
        <Bear x={60} y={67} s={1.7} fill="#4a3020" />
        {/* The salmon, mid-leap, straight for its jaws. */}
        <path d="M84 60 q3 -3 7 -2 q-2 3 -7 2Z" fill="#c9563a" />
        <path d="M84 60 l-2 -1 v2Z" fill="#c9563a" />
        <path d="M112 64 q3 -4 7 -3 q-2 3 -7 3Z" fill="#c9563a" />
      </>
    ),
  },

  'kenai-fjords': {
    view: 'A puffin on the rocks of a glacier-cut fjord',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#6a90bf', '#d7e2ec']} />
        {/* Fjord walls closing on a tidewater glacier. */}
        <path d="M0 100 L0 20 L20 16 L40 30 L56 50 L64 68 L66 74Z" fill="#3c4450" />
        <path d="M160 100 L160 14 L140 18 L116 34 L102 52 L96 68 L94 74Z" fill="#48505c" />
        <path d="M20 16 L28 22 L22 26Z M140 18 L148 22 L140 26Z M40 30 L46 36 L38 36Z" fill="#f2f4f6" />
        <path d="M64 52 L80 44 L96 52 L100 70 L60 70Z" fill="#dfeef6" />
        <path d="M68 70 L68 58 M76 70 L76 54 M84 70 L84 54 M92 70 L92 58" stroke="#8ec0da" strokeWidth="0.8" />
        <rect x="0" y="70" width="160" height="30" fill="#1f4a66" />
        <Ripples y={74} rows={5} gap={4} opacity={0.2} />
        {/* A small ice floe, and a puffin on its rock. */}
        <path d="M100 80 L112 78 L116 81 L102 82Z" fill="#eef6fa" />
        <path d="M0 100 L0 86 C10 80 24 80 34 86 L40 100Z" fill="#2a2a2e" />
        <g transform="translate(20 81) scale(1.6)">
          <path d="M-3 0 C-3.6 -2 -2.6 -5 0 -5.6 C2.4 -5.6 3 -3 2.4 0Z" fill="#141414" />
          <path d="M-0.4 0 C-0.6 -2 0.2 -3.8 1.6 -3.8 C2.6 -3.4 2.6 -1.6 2.2 0Z" fill="#ffffff" />
          <circle cx="0.8" cy="-6.4" r="2" fill="#141414" />
          <ellipse cx="1.3" cy="-6.3" rx="1.3" ry="1.2" fill="#ffffff" />
          <path d="M2.4 -7.8 C4.6 -7.6 5.6 -6.6 5.4 -5.8 C4.6 -5 3.4 -4.8 2.4 -5Z" fill="#e8582a" />
          <path d="M2.8 -7.6 L2.8 -5" stroke="#f2c94c" strokeWidth="0.5" />
          <path d="M-1 0 l-0.8 0.8 h1.6Z M1 0 l-0.8 0.8 h1.6Z" fill="#e8582a" />
        </g>
        <Bird x={120} y={40} />
      </>
    ),
  },

  'glacier-bay': {
    view: 'A humpback fluke before a tidewater glacier',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#7a9cc6', '#e2eaf2']} />
        <path d={land([[0, 40], [20, 24], [40, 34], [60, 20], [84, 32], [104, 18], [128, 30], [148, 22], [160, 28]], 50)} fill="#8a92a2" />
        <path d="M20 24 l6 6 l-10 2Z M60 20 l6 6 l-10 2Z M104 18 l6 6 l-10 2Z M148 22 l5 5 l-9 2Z" fill="#f2f4f6" />
        {/* The ice face: blue in its cracks, white on its seracs. */}
        <path d="M0 64 L0 46 L8 42 L14 46 L22 40 L30 44 L38 38 L48 44 L56 40 L66 46 L74 38 L84 44 L94 40 L104 46 L114 38 L124 44 L134 40 L144 46 L152 42 L160 44 L160 64Z" fill="#eaf4fa" />
        <path d="M8 44 L6 64 M22 42 L24 64 M38 40 L36 64 M56 42 L58 64 M74 40 L72 64 M94 42 L96 64 M114 40 L112 64 M134 42 L136 64 M152 44 L150 64" stroke="#7fb6d8" strokeWidth="1.4" />
        <path d="M60 50 L70 48 L72 64 L58 64Z" fill="#9fcfe8" />
        <rect x="0" y="64" width="160" height="36" fill="#2e5a72" />
        <Ripples y={70} rows={6} gap={4} opacity={0.2} />
        {/* Floating ice, and the whale's tail. */}
        <g fill="#eef6fa">
          <path d="M18 74 L28 72 L30 75 L16 76Z" />
          <path d="M124 78 L136 76 L140 79 L122 80Z" />
          <path d="M60 70 L66 69 L67 71 L59 71Z" />
        </g>
        <path d="M80 92 C80 86 78 82 76 80 C70 78 62 80 58 76 C64 76 72 74 80 78 C88 74 96 76 102 76 C98 80 90 78 84 80 C82 82 80 86 80 92Z" fill="#1a1e24" />
        <path d="M62 77 C68 77 74 76 80 79 C86 76 92 77 98 77" stroke="#e6ecf0" strokeWidth="0.6" fill="none" />
        <ellipse cx="80" cy="93" rx="10" ry="1.6" fill="#ffffff" opacity="0.6" />
      </>
    ),
  },

  wrangell: {
    view: 'The Kennecott mill above the Root Glacier',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#6a98d0', '#dfe8f0']} />
        <path d={land([[0, 40], [24, 20], [40, 28], [62, 12], [84, 26], [104, 16], [126, 30], [146, 20], [160, 26]], 56)} fill="#9aa0ac" />
        <path d="M24 20 l6 6 l-10 2Z M62 12 l7 8 l-12 2Z M104 16 l6 7 l-10 2Z M146 20 l5 6 l-9 1Z" fill="#f2f4f6" />
        {/* The glacier: ice under a skin of grey moraine rubble. */}
        <path d="M0 70 C40 60 90 58 160 56 L160 76 C100 78 40 80 0 86Z" fill="#8a8680" />
        <path d="M0 76 C40 68 100 66 160 64" stroke="#b8b4ae" strokeWidth="1.4" fill="none" />
        <path d="M100 58 C120 57 140 56 160 56 L160 62 C140 62 120 62 100 64Z" fill="#dfe8ee" />
        {/* The mill: red, white-trimmed, stepping down the slope. */}
        <path d={hills([[0, 60], [30, 58], [60, 70], [80, 84]], 100)} fill="#5a6a44" />
        <path d="M14 82 L14 50 L22 44 L30 50 L30 58 L38 58 L38 66 L46 66 L46 74 L54 74 L54 82Z" fill="#a83a26" />
        <path d="M12 50 L22 42 L32 50" stroke="#f2ede4" strokeWidth="1.2" fill="none" />
        <path d="M30 58 H38 M38 66 H46 M46 74 H54" stroke="#f2ede4" strokeWidth="1" />
        <g fill="#f2ede4">
          {[
            [17, 54],
            [24, 54],
            [17, 62],
            [24, 62],
            [33, 62],
            [17, 70],
            [24, 70],
            [33, 70],
            [41, 70],
            [49, 78],
          ].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="2.4" height="3" />
          ))}
        </g>
        <Pines from={60} to={100} y={100} h={16} fill="#2e4a34" step={6} w={0.3} />
        <path d={hills([[0, 96], [40, 90], [80, 98], [160, 92]])} fill="#3a4e30" />
      </>
    ),
  },

  'gates-of-the-arctic': {
    view: 'The Arrigetch Peaks above a braided river',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#8a9fc8', '#f0d9c0']} />
        {/* Granite fingers: "outstretched hands". */}
        <path d={land([[0, 60], [10, 44], [16, 50], [24, 28], [30, 40], [36, 22], [42, 36], [50, 18], [56, 34], [64, 26], [72, 44], [84, 30], [92, 16], [98, 30], [106, 24], [114, 40], [124, 30], [134, 46], [146, 38], [160, 50]], 66)} fill="#7a7a86" />
        <path d="M36 22 L42 36 L38 38Z M50 18 L56 34 L52 36Z M92 16 L98 30 L94 32Z" fill="#5a5a66" />
        <path d="M24 28 l3 5 l-5 1Z M50 18 l3 6 l-5 0Z M92 16 l3 6 l-5 0Z" fill="#f0f2f4" />
        <path d={hills([[0, 66], [40, 62], [80, 68], [120, 60], [160, 66]], 72)} fill="#7a8a5a" />
        {/* The valley floor, the river braiding across gravel. */}
        <rect x="0" y="72" width="160" height="28" fill="#a89a5a" />
        <path d="M0 80 C30 78 50 84 80 82 C110 80 130 86 160 84" stroke="#8fb8d0" strokeWidth="2" fill="none" />
        <path d="M20 79 C40 76 60 80 70 82 M90 81 C110 84 130 82 150 86" stroke="#8fb8d0" strokeWidth="1" fill="none" />
        <path d="M0 90 C40 86 80 92 120 88 C140 86 150 88 160 88 L160 100 L0 100Z" fill="#8a6a3a" />
        <Caribou x={40} y={94} s={1.4} fill="#4a3a2a" />
        <Caribou x={62} y={92} s={1.1} fill="#4a3a2a" />
        <Caribou x={118} y={95} s={1.3} fill="#4a3a2a" />
      </>
    ),
  },

  'lake-clark': {
    view: 'A floatplane on Turquoise Lake',
    draw: (k) => {
      const range = (
        <>
          <path d={land([[0, 50], [20, 30], [36, 40], [54, 24], [70, 36], [90, 20], [110, 34], [128, 26], [144, 38], [160, 32]], 60)} fill="#7a8290" />
          <path d="M20 30 l6 6 l-10 2Z M54 24 l6 7 l-10 1Z M90 20 l6 7 l-10 1Z M128 26 l6 6 l-10 2Z" fill="#f2f4f6" />
          <path d={hills([[0, 58], [40, 52], [80, 60], [120, 52], [160, 58]], 62)} fill="#5a7a54" />
        </>
      );
      return (
        <>
          <Sky k={k} stops={['#5a90cf', '#d8e6f0']} />
          <Cloud x={34} y={16} />
          {range}
          <rect x="0" y="62" width="160" height="38" fill="#3cb4b0" />
          <Reflection k={k} y={62} opacity={0.18}>
            {range}
          </Reflection>
          <Ripples y={72} rows={4} gap={4} opacity={0.25} />
          {/* The floatplane. */}
          <g transform="translate(96 76)">
            <path d="M-14 0 L14 0 L12 1.6 L-12 1.6Z" fill="#f2f2f2" />
            <path d="M-4 0 L-4 -3 M6 0 L6 -3" stroke="#3a3a3a" strokeWidth="0.6" />
            <path d="M-10 -3 C-10 -6 -6 -7 0 -7 L10 -6 C12 -5.4 12 -3.4 10 -3Z" fill="#e8a02a" />
            <path d="M-12 -7.6 L16 -7.6 L16 -6.6 L-12 -6.6Z" fill="#c4581e" />
            <path d="M-10 -3 L-16 -8 L-13 -8 L-8 -4Z" fill="#e8a02a" />
            <rect x="4" y="-6.2" width="4" height="2" fill="#6a9ab8" />
          </g>
          {/* Fireweed on the shore. */}
          <path d={hills([[0, 96], [30, 90], [60, 98]], 100)} fill="#3a5a34" />
          {[4, 10, 16, 22, 28, 34, 40].map((x, i) => (
            <path key={x} d={`M${x} ${96 - (i % 2)} V${86 - (i % 3) * 2}`} stroke="#d94a8a" strokeWidth="1.6" strokeLinecap="round" />
          ))}
        </>
      );
    },
  },

  'kobuk-valley': {
    view: 'Caribou crossing the Great Kobuk Sand Dunes',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#6a86b8', '#f0c8a0', '#f6dcb0']} />
        <Sun x={130} y={50} r={6} fill="#fff0c8" glow="#f8d8a0" />
        <path d={hills([[0, 52], [40, 46], [80, 52], [120, 48], [160, 52]], 58)} fill="#7a869a" />
        <Pines from={0} to={40} y={60} h={10} fill="#3a4a3a" step={3} w={0.3} />
        <Pines from={120} to={160} y={60} h={10} fill="#3a4a3a" step={3} w={0.3} />
        {/* Dunes in the Arctic, lit low and gold. */}
        <path d="M0 100 L0 66 C20 60 40 56 60 60 C76 52 90 50 104 56 C120 60 140 62 160 60 L160 100Z" fill="#e2b87a" />
        <path d="M60 60 C76 52 90 50 104 56 L104 70 C90 66 76 64 60 68Z" fill="#b88a50" />
        <path d="M0 100 L0 82 C30 76 60 74 90 78 C110 80 130 76 160 78 L160 100Z" fill="#d6a86a" />
        <path d="M10 90 C30 88 50 92 70 90 M90 94 C110 92 130 95 150 93" stroke="#c09258" strokeWidth="0.8" fill="none" />
        {/* The herd, strung out along the ridge. */}
        {[20, 34, 46, 58, 72, 84, 96].map((x, i) => (
          <Caribou key={x} x={x} y={76 - (i % 2) * 1.2 - Math.max(0, 4 - Math.abs(x - 60) / 10)} s={0.8} fill="#3a2a1e" />
        ))}
      </>
    ),
  },

  'hawaii-volcanoes': {
    view: 'Lava meeting the sea at night',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#140e24', '#3a1a30', '#7a2a2a']} />
        {Array.from({ length: 22 }, (_, i) => (
          <circle key={i} cx={(i * 53) % 160} cy={(i * 17) % 30} r="0.4" fill="#ffffff" opacity="0.7" />
        ))}
        {/* The shield volcano's long slope, and the glow on its steam. */}
        <path d="M0 50 C40 44 90 40 160 52 L160 70 L0 70Z" fill="#1a1414" />
        <ellipse cx="96" cy="46" rx="30" ry="12" fill="#e2582a" opacity="0.2" />
        {/* The plume where lava hits water: billows lit orange from below. */}
        <defs>
          <filter id={k.id('soft')} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <path
          d="M108 70 C104 60 108 54 104 46 C100 38 104 30 96 22 C90 16 92 10 88 6 C98 8 106 16 110 26 C114 36 112 44 118 52 C122 58 124 64 124 70Z"
          fill="#e8c0b0"
          opacity="0.6"
          filter={k.url('soft')}
        />
        <circle cx="116" cy="64" r="6" fill="#ff9a5a" opacity="0.5" />
        {/* Rivers of lava down the pali. */}
        <path d="M40 50 C44 56 50 58 56 62 C66 66 80 64 92 68 C100 70 108 70 116 72" stroke="#ff7a2a" strokeWidth="2.4" fill="none" />
        <path d="M60 48 C66 54 74 58 84 62 C96 66 104 68 114 72" stroke="#ffb03a" strokeWidth="1.2" fill="none" />
        <path d="M0 70 L160 70 L160 100 L0 100Z" fill="#141c2e" />
        <path d="M106 70 L126 70 L124 74 L108 74Z" fill="#ff8a3a" />
        <ellipse cx="116" cy="76" rx="20" ry="4" fill="#ff7a2a" opacity="0.35" />
        <Ripples y={76} rows={5} gap={4} fill="#ff9a5a" opacity={0.3} />
        <path d="M0 100 L0 86 C20 84 40 90 56 100Z" fill="#0a0a0e" />
      </>
    ),
  },

  haleakala: {
    view: 'Sunrise above the clouds from the summit',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#2e3e7a', '#c46a7a', '#f5a860', '#fbd88e']} />
        <Sun x={80} y={48} r={9} fill="#fff2c8" glow="#fbd88e" />
        {/* The cloud sea, lit from below. */}
        <path d={hills([[0, 52], [20, 48], [44, 54], [70, 48], [96, 54], [120, 48], [146, 54], [160, 50]], 62)} fill="#f6d0b8" />
        <path d={hills([[0, 58], [30, 54], [60, 60], [90, 54], [120, 60], [160, 56]], 64)} fill="#e8b8a8" />
        {/* The crater: red and black cinder cones. */}
        <path d="M0 100 L0 64 C30 60 60 66 100 64 C130 62 150 64 160 62 L160 100Z" fill="#6a3a2e" />
        <path d={hills([[20, 80], [34, 70], [48, 80]], 82)} fill="#b8563a" />
        <path d={hills([[70, 82], [90, 72], [110, 82]], 84)} fill="#9a4a36" />
        <path d={hills([[120, 78], [132, 70], [144, 78]], 80)} fill="#c4643e" />
        <path d="M0 100 L0 86 C40 82 80 90 120 86 C140 84 150 86 160 86 L160 100Z" fill="#3a2420" />
        {/* A silversword: a silver globe of leaves. */}
        <g transform="translate(30 94)">
          {Array.from({ length: 11 }, (_, i) => {
            const a = Math.PI + (i / 10) * Math.PI;
            return <line key={i} x1="0" y1="0" x2={Math.cos(a) * 5} y2={Math.sin(a) * 4.2} stroke="#d8dfe6" strokeWidth="1.1" strokeLinecap="round" />;
          })}
        </g>
      </>
    ),
  },

  'american-samoa': {
    view: 'Pola Island off the north shore of Tutuila',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#3f8ad2', '#cfe6f2']} />
        <Cloud x={36} y={18} s={1.2} />
        <Cloud x={130} y={24} />
        <rect x="0" y="62" width="160" height="38" fill="#1f6fa8" />
        <path d="M0 74 C40 72 80 76 120 72 C140 71 150 73 160 72 L160 100 L0 100Z" fill="#2aa8c0" />
        {/* The Pola: a sheer volcanic stack, green only where it can hold on. */}
        <path d="M82 72 L84 40 C86 30 92 24 98 24 C104 26 108 34 110 44 L114 72Z" fill="#4a3e36" />
        <path d="M86 40 C88 30 92 26 98 26 C104 28 106 34 108 42 C102 36 92 36 86 40Z" fill="#3e7a3c" />
        <path d="M98 26 C104 28 108 36 110 44 L114 72 L106 72 L104 40Z" fill="#35302a" />
        <ellipse cx="98" cy="72.5" rx="20" ry="1.4" fill="#ffffff" opacity="0.7" />
        {/* The headland and its rainforest. */}
        <path d="M0 100 L0 22 C20 20 40 30 52 48 C58 58 62 68 66 76 L70 100Z" fill="#2e6a34" />
        <path d="M0 22 C20 20 40 30 52 48 L44 50 C34 38 20 30 0 32Z" fill="#4a8a44" />
        <path d="M52 48 C58 58 62 68 66 76 L70 100 L58 100 L56 74Z" fill="#4a3e36" />
        <path d="M60 100 C80 94 100 96 130 98 L160 100Z" fill="#e8dcb8" />
        <Palm x={20} y={40} h={18} fill="#234a28" lean={5} />
        <Palm x={36} y={48} h={14} fill="#234a28" lean={4} />
      </>
    ),
  },
};
