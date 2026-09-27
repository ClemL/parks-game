import { Bison, Broadleaf, Cloud, hills, land, Pine, Pines, Reflection, Ripples, Sky } from '../kit';
import type { ParkScene } from './types';

/** A bull moose standing in water to its knees, facing left. */
function Moose({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <path d="M-8 -9 C-8 -12 -5 -13 -2 -12.6 L4 -13.4 C6 -13.4 7 -12 7 -10 L7 -6 L6 -6 L6 -1 L5 -1 L5 -6 L-5 -6 L-5 -1 L-6 -1 L-6 -6 L-7.4 -6.4 C-8 -7 -8 -8 -8 -9Z" />
      <path d="M-7 -11.6 L-11 -10.4 C-12.6 -10 -13.4 -8.6 -12.4 -7.6 L-10.6 -7.6 L-9 -9Z" />
      <path d="M-9 -12 C-12 -15 -14 -15 -15 -17 L-13 -16 L-13.4 -18 L-11.8 -16.4 L-11 -18.4 L-10.4 -16 C-9.6 -15 -8.6 -13.6 -8 -12.4Z" />
      <path d="M-6.6 -12.6 C-5 -15 -3 -15.4 -1 -17 L-1.6 -15 L0.2 -15.6 L-1.4 -14 C-3 -13.6 -4.6 -13 -5.6 -12Z" />
    </g>
  );
}

/** A catenary arch, as a filled band between two curves. */
function catenary(cx: number, base: number, halfWidth: number, height: number, a: number): string {
  const steps = 24;
  const cosh = (v: number) => (Math.exp(v) + Math.exp(-v)) / 2;
  const scale = height / (cosh(halfWidth / a) - 1);
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = -halfWidth + (2 * halfWidth * i) / steps;
    const y = base - height + scale * (cosh(t / a) - 1);
    pts.push(`${(cx + t).toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' L');
}

export const HEARTLAND: Record<string, ParkScene> = {
  yellowstone: {
    view: 'Grand Prismatic Spring, steaming',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#5a92d0', '#cfe2ee']} />
        <path d={hills([[0, 42], [40, 36], [80, 40], [120, 34], [160, 40]], 50)} fill="#7f8f9a" />
        <Pines from={0} to={160} y={50} h={10} fill="#34503f" step={3} />
        <rect x="0" y="48" width="160" height="52" fill="#d9cfb4" />
        {/* The rings: bacterial mats in rust and gold, then the deep blue eye. */}
        <ellipse cx="80" cy="74" rx="78" ry="22" fill="#c8662c" />
        <path d="M2 74 L-10 64 M20 88 L4 98 M140 88 L160 98 M158 72 L170 64 M40 94 L34 100 M120 94 L128 100" stroke="#b5561f" strokeWidth="3" />
        <ellipse cx="80" cy="73" rx="62" ry="17" fill="#e39a33" />
        <ellipse cx="80" cy="72" rx="50" ry="13.5" fill="#efcf52" />
        <ellipse cx="80" cy="71.5" rx="42" ry="11" fill="#8dbb6e" />
        <ellipse cx="80" cy="71" rx="35" ry="9" fill="#2a9bb9" />
        <ellipse cx="80" cy="70.6" rx="24" ry="6" fill="#1b6f9e" />
        {/* Steam rolling off. */}
        <g fill="#ffffff">
          <ellipse cx="60" cy="58" rx="22" ry="7" opacity="0.5" />
          <ellipse cx="90" cy="52" rx="28" ry="8" opacity="0.45" />
          <ellipse cx="116" cy="44" rx="20" ry="6" opacity="0.35" />
          <ellipse cx="72" cy="46" rx="14" ry="5" opacity="0.3" />
        </g>
        {/* The boardwalk, with visitors for scale. */}
        <rect x="0" y="95" width="160" height="2.2" fill="#8a6a48" />
        <g fill="#2a2a2a">
          <rect x="40" y="91" width="1.2" height="4" />
          <rect x="44" y="91.4" width="1.2" height="3.6" />
          <rect x="112" y="91" width="1.2" height="4" />
        </g>
      </>
    ),
  },

  'grand-teton': {
    view: 'The Moulton barn on Mormon Row',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#7c9fcf', '#f2c6b4', '#f7ddc0']} />
        {/* The Tetons: all spire and no foothills. */}
        <path d={land([[0, 64], [14, 52], [24, 56], [36, 40], [46, 44], [58, 22], [64, 28], [70, 16], [76, 26], [84, 30], [92, 44], [104, 40], [118, 54], [134, 50], [160, 60]], 70)} fill="#7a7d9a" />
        <path d="M58 22 L64 28 L60 34Z M70 16 L76 26 L72 30 L66 26Z M36 40 L42 44 L36 48Z M92 44 L98 44 L94 48Z" fill="#f7e8e4" />
        <path d="M70 16 L76 26 L84 30 L92 44 L104 40 L118 54 L134 50 L160 60 L160 70 L90 70 L78 32Z" fill="#5e6180" />
        <path d={hills([[0, 70], [60, 68], [120, 70], [160, 68]], 76)} fill="#4f6a48" />
        {/* Sage flats. */}
        <rect x="0" y="74" width="160" height="26" fill="#a9ac7c" />
        <path d="M0 84 H160 M0 92 H160" stroke="#8e9166" strokeWidth="1.4" strokeDasharray="3 2" />
        {/* The barn, with its pitched roof and lean-to wings. */}
        <path d="M86 82 L86 70 L98 58 L110 70 L110 82Z" fill="#6e4a32" />
        <path d="M84 70 L98 56 L112 70" stroke="#4a2e1e" strokeWidth="2" fill="none" />
        <path d="M74 82 L74 74 L86 70 L86 82Z M110 82 L110 70 L122 74 L122 82Z" fill="#5a3a26" />
        <path d="M72 74 L86 69 M110 69 L124 74" stroke="#3d2618" strokeWidth="1.4" />
        <rect x="95" y="72" width="6" height="10" fill="#3d2618" />
        <path d="M90 64 H106" stroke="#8a6448" strokeWidth="0.6" />
      </>
    ),
  },

  glacier: {
    view: 'Wild Goose Island in St. Mary Lake',
    draw: (k) => {
      const peaks = (
        <>
          <path d={land([[0, 52], [14, 34], [26, 40], [40, 18], [52, 30], [66, 26], [78, 42], [92, 28], [104, 20], [116, 32], [132, 24], [146, 38], [160, 30]], 62)} fill="#7d7f96" />
          <path d="M40 18 L46 26 L36 28Z M104 20 L110 28 L100 28Z M132 24 L138 30 L128 30Z" fill="#f2f3f7" />
          <path d={hills([[0, 58], [30, 50], [60, 58], [100, 52], [130, 58], [160, 52]], 64)} fill="#3e6150" />
        </>
      );
      return (
        <>
          <Sky k={k} stops={['#8aa8d4', '#f4d7b8']} />
          <Cloud x={60} y={14} s={1.1} opacity={0.7} />
          {peaks}
          <rect x="0" y="64" width="160" height="36" fill="#3f7aa6" />
          <Reflection k={k} y={64} opacity={0.35}>
            {peaks}
          </Reflection>
          {/* The island: a scrap of rock and a handful of firs. */}
          <ellipse cx="78" cy="78" rx="16" ry="3" fill="#4a4436" />
          <Pines from={68} to={88} y={78} h={10} fill="#1f3a2a" step={3.5} />
          <Ripples y={84} rows={4} gap={4} opacity={0.3} />
          <path d={hills([[0, 94], [30, 88], [60, 96]], 100)} fill="#2d4a36" />
          <Pine x={10} y={96} h={24} fill="#1a3024" />
        </>
      );
    },
  },

  'rocky-mountain': {
    view: 'Hallett Peak over Dream Lake',
    draw: (k) => {
      const above = (
        <>
          {/* Hallett Peak: a broad summit and a sheer north face. */}
          <path d={land([[0, 56], [20, 40], [40, 34], [56, 22], [74, 18], [92, 24], [104, 34], [120, 30], [140, 40], [160, 38]], 64)} fill="#8a8894" />
          <path d="M56 22 L74 18 L92 24 L82 28 L66 26Z M120 30 L128 34 L118 36Z" fill="#f1f3f6" />
          <path d="M92 24 L104 34 L120 30 L140 40 L160 38 L160 64 L96 64 L98 34Z" fill="#6c6a78" />
          <path d="M60 30 L58 60 M70 28 L70 60 M80 28 L82 58" stroke="#76747f" strokeWidth="1" />
          <Pines from={0} to={160} y={64} h={12} fill="#274534" step={4} />
        </>
      );
      return (
        <>
          <Sky k={k} stops={['#3e76bd', '#a9c7e3', '#f4e0c2']} />
          {above}
          <rect x="0" y="64" width="160" height="36" fill="#3a6d8c" />
          <Reflection k={k} y={64} opacity={0.5}>
            {above}
          </Reflection>
          <Ripples y={82} rows={3} gap={4} opacity={0.25} />
          {/* A limber pine leaning over the shore, and granite boulders. */}
          <g fill="#6d6a66">
            <ellipse cx="128" cy="96" rx="14" ry="6" />
            <ellipse cx="146" cy="92" rx="10" ry="6" />
          </g>
          <path d="M20 100 C16 90 22 82 18 70 C16 64 10 60 6 56" stroke="#4a3a2a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <g fill="#2a4a32">
            <ellipse cx="8" cy="56" rx="8" ry="4" />
            <ellipse cx="18" cy="68" rx="7" ry="3.4" />
            <ellipse cx="22" cy="80" rx="6" ry="3" />
          </g>
        </>
      );
    },
  },

  badlands: {
    view: 'The banded spires of the Wall, with a bighorn',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#5b8fcf', '#e0e8ef']} />
        <Cloud x={120} y={20} s={1.3} />
        {/* Two ranks of spires, striped in the colours of buried soils. */}
        <defs>
          <clipPath id={k.id('back')}>
            <path d="M0 80 L0 46 L6 40 L10 46 L16 30 L22 42 L28 34 L34 44 L42 28 L48 40 L54 36 L60 46 L68 32 L74 44 L82 38 L90 48 L98 30 L104 42 L112 36 L120 46 L128 28 L134 40 L142 34 L150 44 L156 38 L160 42 L160 80Z" />
          </clipPath>
          <clipPath id={k.id('front')}>
            <path d="M0 84 L0 58 L8 50 L14 60 L22 46 L30 58 L38 52 L46 62 L54 48 L60 58 L70 54 L78 64 L88 50 L96 60 L104 56 L114 64 L122 52 L130 60 L140 48 L148 58 L160 54 L160 84Z" />
          </clipPath>
        </defs>
        <path d="M0 80 L0 46 L6 40 L10 46 L16 30 L22 42 L28 34 L34 44 L42 28 L48 40 L54 36 L60 46 L68 32 L74 44 L82 38 L90 48 L98 30 L104 42 L112 36 L120 46 L128 28 L134 40 L142 34 L150 44 L156 38 L160 42 L160 80Z" fill="#eddccb" />
        <g clipPath={k.url('back')}>
          <rect x="0" y="44" width="160" height="3" fill="#d9a48c" />
          <rect x="0" y="52" width="160" height="2" fill="#c98a6e" />
          <path d="M16 30 L22 42 L20 80 L12 80Z M42 28 L48 40 L46 80 L38 80Z M98 30 L104 42 L102 80 L94 80Z M128 28 L134 40 L132 80 L124 80Z" fill="#c9b2a0" opacity="0.6" />
        </g>
        <path d="M0 84 L0 58 L8 50 L14 60 L22 46 L30 58 L38 52 L46 62 L54 48 L60 58 L70 54 L78 64 L88 50 L96 60 L104 56 L114 64 L122 52 L130 60 L140 48 L148 58 L160 54 L160 84Z" fill="#dcc0a4" />
        <g clipPath={k.url('front')}>
          <rect x="0" y="60" width="160" height="3" fill="#b8705a" />
          <rect x="0" y="66" width="160" height="2" fill="#f2e6d6" />
          <rect x="0" y="70" width="160" height="4" fill="#9a6a58" />
          <path d="M22 46 L30 58 L28 84 L20 84Z M54 48 L60 58 L58 84 L50 84Z M88 50 L96 60 L94 84 L86 84Z M140 48 L148 58 L146 84 L138 84Z" fill="#a88a74" opacity="0.5" />
        </g>
        {/* The mixed-grass prairie. */}
        <path d={hills([[0, 80], [40, 76], [80, 82], [120, 76], [160, 80]])} fill="#b4a468" />
        <rect x="0" y="90" width="160" height="10" fill="#958a4e" />
        {/* A bighorn ram on a ledge. */}
        <g fill="#5a4636" transform="translate(116 80)">
          <path d="M-6 -4 C-6 -6 -3 -7 0 -6.6 L4 -6.6 C5.6 -6.6 6 -5 6 -4 L6 0 L5 0 L5 -3 L-4 -3 L-4 0 L-5 0 L-5 -3.4Z" />
          <path d="M-6 -5 L-8.4 -7 C-9 -8 -8 -9 -7 -8.6 L-5.4 -7Z" />
          <path d="M-7.4 -8.6 C-6 -10.6 -3.6 -10 -4 -7.6 C-4.6 -6.4 -6 -6.8 -5.8 -7.8" fill="none" stroke="#c9b08a" strokeWidth="1.1" />
        </g>
      </>
    ),
  },

  'theodore-roosevelt': {
    view: 'Painted Canyon, with bison on the flats',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#6a9bd6', '#dfe9ef']} />
        <Cloud x={40} y={18} />
        <path d={land([[0, 44], [160, 42]], 52)} fill="#9aa27a" />
        {/* Rounded badlands: red scoria caps, a black coal seam, grey clay. */}
        <defs>
          <clipPath id={k.id('back')}>
            <path d={hills([[0, 44], [18, 30], [36, 42], [58, 28], [80, 40], [104, 30], [126, 42], [146, 32], [160, 38]], 72)} />
          </clipPath>
          <clipPath id={k.id('front')}>
            <path d={hills([[0, 58], [24, 48], [48, 60], [70, 50], [96, 62], [120, 48], [144, 58], [160, 52]], 72)} />
          </clipPath>
        </defs>
        <path d={hills([[0, 44], [18, 30], [36, 42], [58, 28], [80, 40], [104, 30], [126, 42], [146, 32], [160, 38]], 72)} fill="#c9a784" />
        <g clipPath={k.url('back')}>
          <rect x="0" y="26" width="160" height="9" fill="#b4472e" />
          <rect x="0" y="42" width="160" height="1.6" fill="#2e2a2a" />
          <rect x="0" y="48" width="160" height="4" fill="#a8a096" />
        </g>
        <path d={hills([[0, 58], [24, 48], [48, 60], [70, 50], [96, 62], [120, 48], [144, 58], [160, 52]], 72)} fill="#b99474" />
        <g clipPath={k.url('front')}>
          <rect x="0" y="46" width="160" height="6" fill="#a23f28" />
          <rect x="0" y="58" width="160" height="1.8" fill="#2e2a2a" />
          <rect x="0" y="64" width="160" height="4" fill="#9a9288" />
        </g>
        {/* Junipers scattered down the slopes. */}
        <g fill="#3f5a3a">
          {[8, 30, 46, 74, 90, 118, 132, 156].map((x, i) => (
            <circle key={x} cx={x} cy={62 + (i % 3) * 3} r="2.2" />
          ))}
        </g>
        <path d={hills([[0, 76], [50, 72], [100, 78], [160, 72]])} fill="#8ea05c" />
        <rect x="0" y="88" width="160" height="12" fill="#77894a" />
        <Bison x={52} y={92} s={1.3} />
        <Bison x={80} y={88} s={0.9} />
        <Bison x={124} y={94} s={1.5} />
      </>
    ),
  },

  'wind-cave': {
    view: 'Bison grazing the prairie above the cave',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#4f86c9', '#c8dcec']} />
        <Cloud x={34} y={20} s={1.4} />
        <Cloud x={118} y={14} s={1.1} />
        {/* Black Hills ponderosas on the ridge. */}
        <path d={hills([[0, 54], [40, 46], [80, 52], [120, 44], [160, 50]], 60)} fill="#4b6448" />
        <Pines from={50} to={130} y={52} h={10} fill="#2e4632" step={4} />
        <path d={hills([[0, 60], [30, 56], [70, 62], [110, 56], [160, 62]])} fill="#8fae5c" />
        <path d={hills([[0, 76], [40, 70], [90, 78], [130, 70], [160, 74]])} fill="#a5bd68" />
        {/* A prairie dog town: mounds and a sentry. */}
        <g fill="#b39a6a">
          <ellipse cx="26" cy="90" rx="4" ry="1.4" />
          <ellipse cx="44" cy="94" rx="4" ry="1.4" />
          <ellipse cx="138" cy="92" rx="4" ry="1.4" />
        </g>
        <path d="M44 93 C44 90 45 88.4 46 88.4 C47 88.4 47.4 90 47 93Z" fill="#8a6a44" />
        <Bison x={70} y={74} s={0.7} />
        <Bison x={88} y={76} s={0.8} />
        <Bison x={104} y={78} s={1} />
        <Bison x={84} y={88} s={1.5} />
        <Bison x={122} y={86} s={1.2} />
      </>
    ),
  },

  voyageurs: {
    view: 'Northern lights over Kabetogama Lake',
    draw: (k) => {
      const shore = (
        <>
          <path d={hills([[0, 66], [20, 62], [40, 66]], 70)} fill="#0e1a1c" />
          <Pines from={0} to={40} y={68} h={12} fill="#0b1416" step={3.4} />
          <path d={hills([[96, 66], [120, 60], [160, 64]], 70)} fill="#0e1a1c" />
          <Pines from={96} to={160} y={68} h={14} fill="#0b1416" step={3.6} />
        </>
      );
      return (
        <>
          <Sky k={k} stops={['#0b1330', '#16294a', '#1f3f55']} />
          {Array.from({ length: 36 }, (_, i) => (
            <circle key={i} cx={(i * 47) % 160} cy={(i * 23) % 56} r={i % 5 === 0 ? 0.6 : 0.35} fill="#ffffff" opacity="0.8" />
          ))}
          {/* The aurora: ribbons of green fading to violet. */}
          <path d="M-10 40 C20 20 50 44 80 26 C110 8 130 30 170 16 L170 26 C130 40 110 20 80 36 C50 54 20 30 -10 50Z" fill="#5ef2a1" opacity="0.4" />
          <path d="M-10 30 C30 14 60 34 90 18 C120 4 140 20 170 8 L170 14 C140 26 120 12 90 26 C60 42 30 22 -10 38Z" fill="#8a7af2" opacity="0.25" />
          <path d="M20 34 V56 M40 30 V56 M60 34 V56 M80 28 V56 M100 22 V56 M120 20 V56" stroke="#5ef2a1" strokeWidth="1.4" opacity="0.15" />
          {shore}
          <rect x="0" y="68" width="160" height="32" fill="#0f2233" />
          <Reflection k={k} y={68} opacity={0.3}>
            <path d="M-10 40 C20 20 50 44 80 26 C110 8 130 30 170 16 L170 26 C130 40 110 20 80 36 C50 54 20 30 -10 50Z" fill="#5ef2a1" />
            {shore}
          </Reflection>
          {/* A canoe drifting. */}
          <path d="M60 86 Q76 90 92 86 Q76 88 60 86Z" fill="#0b1416" stroke="#0b1416" strokeWidth="1.2" />
          <rect x="70" y="82" width="1.4" height="4" fill="#0b1416" />
          <circle cx="70.7" cy="81.4" r="1" fill="#0b1416" />
        </>
      );
    },
  },

  'isle-royale': {
    view: 'A bull moose feeding in a misty lake',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#b8c6c8', '#e6e2d4']} />
        <path d={hills([[0, 54], [40, 48], [80, 54], [120, 46], [160, 52]], 60)} fill="#9aaba6" />
        <Pines from={0} to={160} y={60} h={14} fill="#6d837c" step={4} w={0.34} />
        <Pines from={0} to={70} y={64} h={20} fill="#3e544b" step={5} w={0.3} />
        <Pines from={110} to={160} y={64} h={22} fill="#3e544b" step={5} w={0.3} />
        <rect x="0" y="64" width="160" height="36" fill="#7d9aa0" />
        <rect x="0" y="64" width="160" height="8" fill="#e8ecea" opacity="0.4" />
        <Moose x={84} y={84} s={2.4} fill="#2e2620" />
        <Reflection k={k} y={84} opacity={0.3}>
          <Moose x={84} y={84} s={2.4} fill="#2e2620" />
        </Reflection>
        <Ripples y={86} x1={50} x2={120} rows={3} gap={3} opacity={0.35} />
        {/* Water lilies. */}
        <g fill="#4a6a3a">
          <ellipse cx="30" cy="92" rx="4" ry="1.2" />
          <ellipse cx="42" cy="96" rx="3" ry="1" />
          <ellipse cx="130" cy="94" rx="4" ry="1.2" />
        </g>
      </>
    ),
  },

  'indiana-dunes': {
    view: 'Lake Michigan from the dunes, Chicago on the horizon',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#6aa2d8', '#dbe9f2']} />
        <Cloud x={110} y={18} s={1.2} />
        <rect x="0" y="52" width="160" height="30" fill="#3f86b8" />
        {/* The skyline, thirty miles off across the water. */}
        <g fill="#9cb0c0">
          <rect x="112" y="40" width="3" height="12" />
          <rect x="116" y="34" width="3.4" height="18" />
          <rect x="116.8" y="31" width="0.5" height="3" />
          <rect x="118.4" y="31" width="0.5" height="3" />
          <rect x="120" y="44" width="4" height="8" />
          <rect x="125" y="38" width="3" height="14" />
          <rect x="129" y="42" width="2.4" height="10" />
          <rect x="132" y="46" width="4" height="6" />
          <rect x="108" y="46" width="3" height="6" />
        </g>
        <Ripples y={58} rows={5} gap={4} opacity={0.25} />
        <path d="M0 80 C40 78 80 82 120 78 C140 77 150 79 160 78 L160 84 L0 84Z" fill="#f1f4f4" />
        {/* The dune, and the marram grass that holds it. */}
        <path d="M0 100 L0 70 C20 66 40 72 60 82 C80 88 110 90 160 86 L160 100Z" fill="#e6cf9f" />
        <path d="M0 70 C20 66 40 72 60 82 L50 84 C36 78 20 74 0 76Z" fill="#cfb582" />
        {[4, 10, 16, 22, 30, 38].map((x, i) => (
          <path key={x} d={`M${x} ${72 + i} q-3 -8 -6 -10 M${x} ${72 + i} q0 -9 2 -12 M${x} ${72 + i} q3 -7 7 -9`} stroke="#7a8a44" strokeWidth="0.8" fill="none" />
        ))}
      </>
    ),
  },

  'gateway-arch': {
    view: 'The Arch over the Mississippi at dusk',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#2e3f78', '#b86b8a', '#f2b27a']} />
        <defs>
          <linearGradient id={k.id('steel')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8a8fa8" />
            <stop offset="45%" stopColor="#f4efe8" />
            <stop offset="100%" stopColor="#6a6f88" />
          </linearGradient>
        </defs>
        {/* The Arch: a weighted catenary, as wide as it is tall. */}
        <path d={`M${catenary(80, 74, 36, 62, 20)} L${catenary(80, 74, 31, 57.5, 17.8).split(' L').reverse().join(' L')}Z`} fill={k.url('steel')} />
        {/* Downtown and the Old Courthouse dome. */}
        <g fill="#2a2440">
          <rect x="0" y="58" width="10" height="16" />
          <rect x="10" y="50" width="8" height="24" />
          <rect x="18" y="62" width="10" height="12" />
          <rect x="120" y="56" width="10" height="18" />
          <rect x="130" y="46" width="8" height="28" />
          <rect x="138" y="60" width="12" height="14" />
          <rect x="150" y="54" width="10" height="20" />
          <path d="M28 74 V64 H40 V74Z M31 64 C31 58 37 58 37 64Z" />
        </g>
        <rect x="0" y="72" width="160" height="4" fill="#3a3a4a" />
        {/* The river. */}
        <rect x="0" y="76" width="160" height="24" fill="#4a4a6e" />
        <Ripples y={80} rows={5} gap={4} fill="#f2b27a" opacity={0.35} />
        <path d="M100 90 h20 l-2 3 h-16Z" fill="#1c1830" />
        <rect x="106" y="87" width="6" height="3" fill="#1c1830" />
      </>
    ),
  },

  cuyahoga: {
    view: 'Brandywine Falls in October',
    draw: (k) => (
      <>
        <Sky k={k} stops={['#88b0d8', '#e6eef0']} />
        {/* Autumn woods. */}
        <g>
          {([
            [8, 40, '#d4702c'],
            [24, 36, '#e3a33a'],
            [40, 42, '#b8462a'],
            [120, 38, '#e3a33a'],
            [136, 42, '#d4702c'],
            [152, 36, '#b8462a'],
          ] as const).map(([x, y, fill]) => (
            <circle key={x} cx={x} cy={y} r="12" fill={fill} />
          ))}
        </g>
        {/* Sandstone ledges, stepping down. */}
        <path d="M0 100 L0 44 L56 44 L56 56 L50 56 L50 70 L44 70 L44 100Z" fill="#7a6a58" />
        <path d="M160 100 L160 44 L104 44 L104 56 L110 56 L110 70 L116 70 L116 100Z" fill="#6a5a4a" />
        <path d="M0 50 H56 M104 50 H160 M0 62 H50 M110 62 H160" stroke="#5a4a3a" strokeWidth="1" />
        {/* The falls: a veil fanning over each step. */}
        <path d="M56 44 L104 44 L110 56 L50 56Z" fill="#eaf3f6" />
        <path d="M50 56 L110 56 L116 70 L44 70Z" fill="#dfeef3" />
        <path d="M44 70 L116 70 L120 90 L40 90Z" fill="#eaf3f6" />
        <path d="M60 46 V56 M72 46 V56 M86 46 V56 M98 46 V56 M56 58 V70 M68 58 V70 M82 58 V70 M96 58 V70 M106 58 V70 M50 72 V90 M64 72 V90 M78 72 V90 M92 72 V90 M108 72 V90" stroke="#a9c8d6" strokeWidth="0.6" />
        <ellipse cx="80" cy="92" rx="46" ry="5" fill="#ffffff" opacity="0.8" />
        <rect x="0" y="94" width="160" height="6" fill="#4a6a7a" />
        <Broadleaf x={20} y={100} h={30} fill="#c55a2a" trunk="#3a2a1e" />
        <Broadleaf x={146} y={100} h={34} fill="#e0a23a" trunk="#3a2a1e" />
      </>
    ),
  },
};
