import { Bird, Broadleaf, Cloud, Heron, hills, Palm, Pines, Reflection, Ripples, Sky, Sun } from '../kit';
import type { ParkScene } from './types';

/** A small fish, facing right. */
function Fish({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return <path d={`M${x} ${y} q${3 * s} ${-2.2 * s} ${6 * s} 0 q${-3 * s} ${2.2 * s} ${-6 * s} 0 l${-2 * s} ${-1.6 * s} v${3.2 * s}Z`} fill={fill} />;
}

export const EAST: Record<string, ParkScene> = {
  acadia: {
    view: 'Bass Harbor Head Light on its granite ledge',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#5c6fa6', '#e59a86', '#f7cf97']} />
        <Sun x={40} y={64} r={7} fill="#fde3ae" glow="#f9c98a" />
        <rect x="0" y="66" width="160" height="34" fill="#4f6a8e" />
        <Ripples y={70} x1={0} x2={100} rows={6} gap={4} fill="#f7cf97" opacity={0.4} />
        {/* Pink granite, stepping down to the sea. */}
        <path d="M80 100 L84 82 L96 74 L108 70 L122 60 L140 56 L160 54 L160 100Z" fill="#c68a78" />
        <path d="M84 82 L96 74 L108 70 L122 60 L126 66 L112 76 L100 82 L90 90Z" fill="#a3685a" />
        <path d="M90 100 L96 90 L110 84 L130 80 L160 80 L160 100Z" fill="#8f5a4c" />
        <Pines from={140} to={160} y={56} h={18} fill="#243a2c" step={5} />
        {/* The light and the keeper's house. */}
        <rect x="126" y="44" width="16" height="12" fill="#f4f1ea" />
        <path d="M124 44 L134 38 L144 44Z" fill="#6b3a30" />
        <rect x="118" y="36" width="6" height="20" fill="#f7f4ee" />
        <rect x="117" y="30" width="8" height="6" fill="#2a2a2a" />
        <rect x="118.4" y="31" width="5.2" height="4" fill="#fbe6a0" />
        <path d="M116.6 30 L121 26 L125.4 30Z" fill="#b8382a" />
        <path d="M121 32 L96 26 L96 38Z" fill="#fff3c0" opacity="0.35" />
      </>
    ),
  },

  smokies: {
    view: 'Ridge after ridge in the blue haze',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#e9c9b0', '#f3dcc0', '#dfe4e6']} />
        <Sun x={110} y={30} r={9} fill="#fff1d6" glow="#fbe1c0" />
        <path d={hills([[0, 42], [20, 38], [44, 44], [70, 34], [96, 42], [120, 36], [146, 44], [160, 40]])} fill="#b8c3d6" />
        <path d={hills([[0, 52], [26, 44], [52, 52], [80, 44], [104, 54], [130, 46], [160, 52]])} fill="#98a8c4" />
        <path d={hills([[0, 62], [30, 54], [58, 64], [86, 56], [114, 64], [140, 54], [160, 60]])} fill="#7689ad" />
        <path d={hills([[0, 72], [24, 64], [52, 74], [80, 66], [110, 74], [136, 64], [160, 70]])} fill="#566c92" />
        <rect x="0" y="62" width="160" height="12" fill="#ffffff" opacity="0.18" />
        <path d={hills([[0, 84], [30, 76], [60, 86], [96, 78], [128, 86], [160, 78]])} fill="#3a4e6e" />
        <path d={hills([[0, 96], [40, 88], [80, 96], [120, 90], [160, 96]])} fill="#26344c" />
        <Pines from={2} to={30} y={98} h={16} fill="#1a2436" step={6} />
      </>
    ),
  },

  shenandoah: {
    view: 'Skyline Drive winding through autumn color',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#7fa8d6', '#e2ebef']} />
        <Cloud x={38} y={16} />
        <path d={hills([[0, 40], [40, 34], [80, 40], [120, 32], [160, 38]])} fill="#9fb1c6" />
        <path d={hills([[0, 50], [30, 44], [70, 50], [110, 42], [160, 48]])} fill="#7f94b0" />
        {/* Three ridges of October canopy, each a band of treetops. */}
        {[
          { y: 54, fill: '#c9772e', tops: ['#d98a34', '#b85a2a', '#e0a23c'] },
          { y: 66, fill: '#b04a26', tops: ['#c4582a', '#9a3a22', '#d9782e'] },
          { y: 80, fill: '#c98a2a', tops: ['#e3a33a', '#b8702a', '#f0c24a', '#8a8a34'] },
        ].map((band, b) => (
          <g key={b}>
            <rect x="0" y={band.y} width="160" height={100 - band.y} fill={band.fill} />
            {Array.from({ length: 34 }, (_, i) => {
              const x = i * 5 - 2;
              const cy = band.y + Math.sin(x * 0.05 + b * 2) * 4;
              return <circle key={i} cx={x} cy={cy} r={3.6 + ((i * 7 + b) % 3) * 0.7} fill={band.tops[(i + b) % band.tops.length]} />;
            })}
          </g>
        ))}
        {/* The road, and the stone wall of an overlook. */}
        <path d="M-4 80 C30 70 60 72 90 66 C120 60 140 62 170 56 L170 62 C140 68 120 66 90 72 C60 78 30 78 -4 88Z" fill="#5a5a60" />
        <path d="M-4 84 C30 74 60 75 90 69 C120 63 140 65 170 59" stroke="#f2e2a0" strokeWidth="0.5" strokeDasharray="3 3" fill="none" />
        <path d="M0 92 C30 86 60 88 100 84 L100 88 C60 92 30 92 0 98Z" fill="#9a8a78" />
        <path d="M10 91 V96 M24 89 V94 M40 88 V92 M56 87 V91 M72 86 V90 M88 85 V89" stroke="#7a6a58" strokeWidth="1" />
      </>
    ),
  },

  everglades: {
    view: 'A great egret in the sawgrass at sunset',
    draw: (k) => {
      const skyline = (
        <>
          <path d={hills([[14, 60], [26, 54], [40, 55], [52, 60]], 60)} fill="#2a2a2e" />
          <path d={hills([[90, 60], [104, 52], [126, 53], [146, 60]], 60)} fill="#2a2a2e" />
          <Palm x={112} y={52} h={16} fill="#2a2a2e" lean={2} />
          <Palm x={120} y={52} h={11} fill="#2a2a2e" lean={-2} />
          <Palm x={34} y={54} h={10} fill="#2a2a2e" lean={1} />
        </>
      );
      return (
        <>
          <Sky k={k} stops={['#4b4f86', '#d3677a', '#f39a5a', '#f8c775']} />
          <Sun x={70} y={54} r={9} fill="#ffe0a0" />
          {skyline}
          <rect x="0" y="60" width="160" height="40" fill="#e2946a" />
          <Reflection k={k} y={60} opacity={0.35}>
            <circle cx="70" cy="54" r="9" fill="#ffe0a0" />
            {skyline}
          </Reflection>
          {/* Sawgrass, a river of it. */}
          <path d="M0 74 C40 70 80 76 120 70 C140 68 150 72 160 70 L160 80 L0 80Z" fill="#8a6a3a" opacity="0.8" />
          {Array.from({ length: 60 }, (_, i) => {
            const x = (i * 2.7) % 160;
            const y = 82 + (i % 5) * 3.6;
            return <path key={i} d={`M${x} ${y + 6} l${-1 + (i % 3)} -8`} stroke="#5a4a28" strokeWidth="0.7" />;
          })}
          <rect x="0" y="94" width="160" height="6" fill="#4a3a20" />
          <Heron x={110} y={88} s={2.2} fill="#fbf7ef" />
        </>
      );
    },
  },

  'mammoth-cave': {
    view: 'The Historic Entrance in the Kentucky woods',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#8fb8d8', '#dfeae6']} />
        <path d={hills([[0, 30], [40, 22], [80, 28], [120, 20], [160, 28]])} fill="#5e8a4a" />
        {/* The limestone ledge and the dark mouth beneath it. */}
        <path d="M20 100 L24 58 C30 44 56 38 80 38 C104 38 130 44 136 58 L140 100Z" fill="#a8a08a" />
        <path d="M30 100 L34 66 C40 54 60 50 80 50 C100 50 120 54 126 66 L130 100Z" fill="#1a1612" />
        <path d="M34 66 C40 54 60 50 80 50 C100 50 120 54 126 66 C110 60 96 58 80 58 C64 58 50 60 34 66Z" fill="#3a3228" />
        <path d="M24 58 C30 44 56 38 80 38 C104 38 130 44 136 58" stroke="#8a826c" strokeWidth="2" fill="none" />
        {/* A thin fall off the ledge, and steps down into the dark. */}
        <path d="M100 40 L101 40 L102 90 L99 90Z" fill="#dfeef3" opacity="0.8" />
        <g fill="#8a8272">
          <rect x="60" y="92" width="40" height="3" />
          <rect x="64" y="86" width="32" height="3" />
          <rect x="68" y="80" width="24" height="3" />
          <rect x="72" y="74" width="16" height="2.4" />
        </g>
        <circle cx="80" cy="68" r="1.4" fill="#f7d98a" />
        <circle cx="80" cy="68" r="4" fill="#f7d98a" opacity="0.2" />
        <Broadleaf x={10} y={100} h={60} fill="#3f6a34" trunk="#3a2a1e" />
        <Broadleaf x={152} y={100} h={56} fill="#4a7a3c" trunk="#3a2a1e" />
        <path d={hills([[0, 96], [30, 92], [60, 98]], 100)} fill="#355a2c" />
        <path d={hills([[100, 98], [130, 92], [160, 96]], 100)} fill="#355a2c" />
      </>
    ),
  },

  'new-river-gorge': {
    view: 'The New River Gorge Bridge in fall',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#7aa6d4', '#e4ecee']} />
        <path d={hills([[0, 40], [40, 36], [80, 40], [120, 34], [160, 40]])} fill="#a8a888" />
        {/* The gorge walls, blazing. */}
        <path d="M0 100 L0 44 C20 44 40 52 56 76 L64 100Z" fill="#c4632a" />
        <path d="M160 100 L160 42 C140 44 118 52 102 76 L96 100Z" fill="#d88a2a" />
        {Array.from({ length: 24 }, (_, i) => {
          const left = i % 2 === 0;
          const t = (i * 0.37) % 1;
          const x = left ? 4 + t * 48 : 156 - t * 50;
          const y = 50 + t * 44 + (i % 3) * 2;
          return <circle key={i} cx={x} cy={y} r={3.4} fill={['#e3a33a', '#9a3a22', '#b8a03a', '#e87a3a'][i % 4]} />;
        })}
        <path d="M60 100 C70 94 90 94 100 100Z" fill="#4a7a8a" />
        {/* The steel arch and its deck. */}
        <rect x="0" y="40" width="160" height="2.4" fill="#5a3a2a" />
        <path d="M18 76 C40 44 120 44 142 76" stroke="#6a3a26" strokeWidth="2.6" fill="none" />
        <path d="M22 76 C44 50 116 50 138 76" stroke="#6a3a26" strokeWidth="1.2" fill="none" />
        {[30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130].map((x) => {
          const t = (x - 18) / 124;
          const y = 76 - 4 * 32 * t * (1 - t) * 0.94;
          return <rect key={x} x={x - 0.4} y="42" width="0.8" height={y - 42} fill="#6a3a26" />;
        })}
        <path d="M0 42 L16 76 M160 42 L144 76" stroke="#6a3a26" strokeWidth="1" />
      </>
    ),
  },

  congaree: {
    view: 'Bald cypress knees in the blackwater swamp',
    draw: (k) => {
      const trunks = (
        <>
          {[
            [24, 10],
            [66, 14],
            [112, 12],
            [146, 9],
          ].map(([x, w]) => (
            <path key={x} d={`M${x - w / 2} 0 L${x - w / 2 + 1} 60 C${x - w / 2} 68 ${x - w} 72 ${x - w * 1.3} 74 L${x + w * 1.3} 74 C${x + w} 72 ${x + w / 2} 68 ${x + w / 2 - 1} 60 L${x + w / 2} 0Z`} fill="#5a4a3a" />
          ))}
          {[8, 40, 48, 88, 96, 128, 136].map((x, i) => (
            <path key={x} d={`M${x - 1.6} 74 L${x - 0.6} ${66 - (i % 3) * 2} L${x + 0.6} ${66 - (i % 3) * 2} L${x + 1.6} 74Z`} fill="#6a5a48" />
          ))}
        </>
      );
      return (
        <>
          <Sky k={k} stops={['#9ab88a', '#d6e2b8']} />
          <path d="M0 0 H160 V26 C120 34 80 22 40 30 C20 34 10 28 0 30Z" fill="#4f7a3a" />
          <path d="M0 0 H160 V14 C120 20 80 10 40 18 C20 20 10 16 0 18Z" fill="#3a6a2c" />
          {[10, 36, 52, 84, 100, 130, 156].map((x, i) => (
            <rect key={x} x={x} y="20" width={2 + (i % 2)} height="54" fill="#8a9a78" opacity="0.6" />
          ))}
          {trunks}
          <rect x="0" y="74" width="160" height="26" fill="#2a2a1e" />
          <Reflection k={k} y={74} opacity={0.45}>
            {trunks}
          </Reflection>
          <Ripples y={80} rows={5} gap={4} fill="#d6e2b8" opacity={0.2} />
          {/* The boardwalk. */}
          <path d="M0 90 L160 84 L160 88 L0 95Z" fill="#8a7458" />
          <path d="M0 95 L160 88" stroke="#5a4a38" strokeWidth="0.8" />
        </>
      );
    },
  },

  'hot-springs': {
    view: 'Bathhouse Row under Hot Springs Mountain',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#7aa8d8', '#e4ecef']} />
        <path d={hills([[0, 52], [40, 36], [80, 30], [120, 36], [160, 48]])} fill="#4f7a44" />
        <rect x="78" y="14" width="4" height="18" fill="#8a8a8a" />
        <rect x="76" y="12" width="8" height="3" fill="#6a6a6a" />
        {Array.from({ length: 14 }, (_, i) => (
          <circle key={i} cx={6 + i * 11} cy={52 + (i % 2) * 4} r={6} fill="#3a6436" />
        ))}
        {/* The bathhouses: stucco, brick, tile and arches. */}
        <g>
          <rect x="4" y="60" width="30" height="24" fill="#e8d8b8" />
          <path d="M2 60 L19 52 L36 60Z" fill="#b8563a" />
          <rect x="36" y="56" width="34" height="28" fill="#f2ead8" />
          <rect x="36" y="54" width="34" height="3" fill="#b8a888" />
          <rect x="72" y="62" width="24" height="22" fill="#c88a5a" />
          <rect x="98" y="58" width="30" height="26" fill="#efe2c8" />
          <path d="M98 58 C104 50 122 50 128 58Z" fill="#8aa8a0" />
          <rect x="130" y="62" width="28" height="22" fill="#e0c8a0" />
          <path d="M128 62 L144 56 L160 62Z" fill="#a84a32" />
        </g>
        <g fill="#6a5a48">
          {[8, 16, 24, 40, 48, 56, 64, 76, 84, 102, 110, 118, 134, 142, 150].map((x) => (
            <path key={x} d={`M${x} 82 V74 C${x} 71 ${x + 5} 71 ${x + 5} 74 V82Z`} />
          ))}
        </g>
        <rect x="0" y="84" width="160" height="16" fill="#b8b0a0" />
        <rect x="0" y="92" width="160" height="8" fill="#6a8a4a" />
        {/* Steam from the display spring. */}
        <path d="M20 90 q-2 -4 0 -8 q2 -4 0 -8" stroke="#ffffff" strokeWidth="1.6" fill="none" opacity="0.6" />
      </>
    ),
  },

  'dry-tortugas': {
    view: 'Fort Jefferson in a turquoise sea',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#4f94d4', '#cfe6f0']} />
        <Cloud x={120} y={18} s={1.2} />
        <rect x="0" y="44" width="160" height="56" fill="#1f8fb0" />
        <path d="M0 58 C40 54 120 54 160 58 L160 100 L0 100Z" fill="#3cc4c8" />
        <Ripples y={48} rows={3} gap={3} opacity={0.3} />
        {/* The fort: a brick hexagon behind its moat wall. */}
        <path d="M20 76 L40 58 L120 58 L140 76 L120 90 L40 90Z" fill="#e8f4f2" />
        <path d="M26 76 L44 61 L116 61 L134 76 L116 87 L44 87Z" fill="#6ad4d0" />
        <path d="M34 74 L50 62 L110 62 L126 74 L110 84 L50 84Z" fill="#b8573a" />
        <path d="M34 74 L50 62 L110 62 L126 74Z" fill="#c96a48" />
        <path d="M50 70 H110" stroke="#8a3a24" strokeWidth="0.6" strokeDasharray="1.6 1.6" />
        <path d="M44 78 H116" stroke="#8a3a24" strokeWidth="0.6" strokeDasharray="1.6 1.6" />
        <path d="M54 66 L106 66 L114 74 L106 80 L54 80 L46 74Z" fill="#8aa85a" />
        {/* The harbor light. */}
        <rect x="96" y="58" width="3" height="8" fill="#2a2a2a" />
        <rect x="95.4" y="56" width="4.2" height="2.4" fill="#2a2a2a" />
        <Bird x={40} y={30} s={1.2} />
        <Bird x={52} y={26} />
      </>
    ),
  },

  biscayne: {
    view: 'Boca Chita Key above, the coral reef below',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#5aa0dc', '#d8ecf4']} />
        <Cloud x={44} y={16} s={1.1} />
        {/* Above the waterline: the key, its lighthouse, its palms. */}
        <path d={hills([[70, 42], [90, 38], [120, 38], [140, 42]], 44)} fill="#e8dcb8" />
        <rect x="100" y="22" width="5" height="18" fill="#e0d8c8" />
        <path d="M99 22 L102.5 18 L106 22Z" fill="#6a6a6a" />
        <rect x="100.6" y="23" width="3.8" height="2" fill="#2a2a2a" />
        <Palm x={84} y={40} h={16} fill="#2e5a34" lean={-3} />
        <Palm x={122} y={40} h={14} fill="#2e5a34" />
        {/* Below the waterline: blue light, coral, fish. */}
        <defs>
          <linearGradient id={k.id('sea')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3cb4c8" />
            <stop offset="100%" stopColor="#0e4a78" />
          </linearGradient>
        </defs>
        <rect x="0" y="44" width="160" height="56" fill={k.url('sea')} />
        <path d="M0 44 C20 42 40 46 60 44 C80 42 100 46 120 44 C140 42 150 45 160 44" stroke="#e8f8fa" strokeWidth="1.2" fill="none" />
        <path d="M30 48 L50 100 M80 48 L90 100 M120 48 L110 100" stroke="#ffffff" strokeWidth="6" opacity="0.06" />
        <g>
          <path d="M0 100 L0 88 C10 84 18 90 26 86 C34 82 40 88 50 86 L56 100Z" fill="#6a4a8a" />
          <path d="M60 100 C62 92 70 86 78 88 C84 90 88 84 96 86 C104 88 106 96 108 100Z" fill="#d4705a" />
          <path d="M112 100 C114 90 126 86 136 90 C144 86 154 88 160 92 L160 100Z" fill="#e8a83a" />
          <path d="M18 88 V76 M18 80 l-4 -4 M18 82 l5 -5 M136 90 V74 M136 78 l-4 -4 M136 80 l4 -5" stroke="#e86a8a" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M84 88 C82 80 84 74 86 70 C88 74 90 80 88 88Z" fill="#6aa84a" />
        </g>
        <Fish x={40} y={64} s={1.3} fill="#f2c94c" />
        <Fish x={52} y={70} fill="#f2c94c" />
        <Fish x={104} y={60} s={1.1} fill="#4ad0e0" />
        <Fish x={116} y={66} s={0.9} fill="#4ad0e0" />
      </>
    ),
  },

  'virgin-islands': {
    view: 'Trunk Bay and Trunk Cay',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#4a96da', '#d2eaf4']} />
        <Cloud x={120} y={16} s={1.3} />
        <path d={hills([[80, 46], [110, 40], [140, 44], [160, 42]], 48)} fill="#6a9a7a" />
        {/* The bay: deep blue out, turquoise over the sand. */}
        <rect x="0" y="46" width="160" height="54" fill="#1f7fb8" />
        <path d="M0 62 C40 58 80 60 120 62 C140 64 150 66 160 70 L160 100 L0 100Z" fill="#2fc0c8" />
        <path d="M0 80 C30 78 60 82 100 86 C130 90 150 92 160 92 L160 100 L0 100Z" fill="#8ae2d8" />
        {/* The cay. */}
        <path d={hills([[92, 58], [100, 52], [112, 52], [120, 58]], 60)} fill="#3e7a44" />
        <path d="M90 60 L122 60 L118 62 L94 62Z" fill="#f2e8cc" />
        {/* The green headland and the white beach. */}
        <path d="M0 100 L0 30 C20 28 40 40 50 54 C56 62 60 70 70 76 L60 100Z" fill="#3e7a3c" />
        <path d="M0 30 C20 28 40 40 50 54 L40 56 C30 46 16 38 0 40Z" fill="#5a9a4a" />
        <path d="M60 100 C70 86 90 90 110 94 C130 98 150 96 160 96 L160 100Z" fill="#f7efd8" />
        <path d="M62 96 C74 88 92 91 110 95 C130 98 150 96 160 96" stroke="#ffffff" strokeWidth="1.2" fill="none" />
        <Palm x={60} y={92} h={30} fill="#2a4a2a" lean={8} />
        <Palm x={48} y={96} h={22} fill="#2a4a2a" lean={5} />
      </>
    ),
  },
};
