import type { ReactNode } from 'react';

/**
 * A small drawing kit for the park illustrations. Every scene is drawn on the
 * same 160 × 100 board in flat, layered colour, like a screen-printed poster:
 * far things pale and cool, near things dark and warm.
 *
 * Coordinates are plain numbers so a scene reads as a list of shapes rather than
 * a wall of path strings.
 */

export const W = 160;
export const H = 100;

export type Pt = [number, number];

/** Ids have to be unique per card on the page; a scene asks for them here. */
export interface Kit {
  id: (name: string) => string;
  url: (name: string) => string;
}

export type Scene = (k: Kit) => ReactNode;

const n = (v: number) => Math.round(v * 10) / 10;

/** A straight-edged silhouette from the given points, filled down to `base`. */
export function land(points: Pt[], base = H): string {
  const [first] = points;
  const last = points[points.length - 1];
  return `M${n(first[0])} ${base} ${points.map(([x, y]) => `L${n(x)} ${n(y)}`).join(' ')} L${n(last[0])} ${base}Z`;
}

/** A rounded silhouette through the given points, filled down to `base`. */
export function hills(points: Pt[], base = H): string {
  let d = `M${n(points[0][0])} ${base} L${n(points[0][0])} ${n(points[0][1])}`;
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const mx = (px + x) / 2;
    d += ` C${n(mx)} ${n(py)} ${n(mx)} ${n(y)} ${n(x)} ${n(y)}`;
  }
  return `${d} L${n(points[points.length - 1][0])} ${base}Z`;
}

/** A closed straight-edged shape. */
export function poly(points: Pt[]): string {
  return `M${points.map(([x, y]) => `${n(x)} ${n(y)}`).join(' L')}Z`;
}

export function Sky({ k, stops, name = 'sky' }: { k: Kit; stops: string[]; name?: string }) {
  return (
    <>
      <defs>
        <linearGradient id={k.id(name)} x1="0" y1="0" x2="0" y2="1">
          {stops.map((color, i) => (
            <stop key={i} offset={`${(i / Math.max(1, stops.length - 1)) * 100}%`} stopColor={color} />
          ))}
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={k.url(name)} />
    </>
  );
}

export function Sun({ x, y, r = 8, fill = '#fbe3a1', glow }: { x: number; y: number; r?: number; fill?: string; glow?: string }) {
  return (
    <>
      {glow && <circle cx={x} cy={y} r={r * 2.2} fill={glow} opacity="0.35" />}
      <circle cx={x} cy={y} r={r} fill={fill} />
    </>
  );
}

/** A narrow conifer: a stack of three triangles on a short trunk. */
export function Pine({ x, y, h, fill, w = 0.42 }: { x: number; y: number; h: number; fill: string; w?: number }) {
  const hw = h * w * 0.5;
  const d = [
    `M${n(x)} ${n(y - h)} L${n(x + hw * 0.55)} ${n(y - h * 0.62)} L${n(x - hw * 0.55)} ${n(y - h * 0.62)}Z`,
    `M${n(x)} ${n(y - h * 0.8)} L${n(x + hw * 0.8)} ${n(y - h * 0.34)} L${n(x - hw * 0.8)} ${n(y - h * 0.34)}Z`,
    `M${n(x)} ${n(y - h * 0.58)} L${n(x + hw)} ${n(y - h * 0.08)} L${n(x - hw)} ${n(y - h * 0.08)}Z`,
    `M${n(x - h * 0.03)} ${n(y - h * 0.1)} h${n(h * 0.06)} V${n(y)} h${n(-h * 0.06)}Z`,
  ].join(' ');
  return <path d={d} fill={fill} />;
}

/** A row of pines along a line, heights varied by a fixed pattern. */
export function Pines({
  from,
  to,
  y,
  h,
  fill,
  step = 4,
  w,
}: {
  from: number;
  to: number;
  y: number;
  h: number;
  fill: string;
  step?: number;
  w?: number;
}) {
  const trees: ReactNode[] = [];
  let i = 0;
  for (let x = from; x <= to; x += step, i++) {
    const vary = [1, 0.78, 0.92, 0.7, 1.08, 0.85][i % 6];
    trees.push(<Pine key={i} x={x + ((i * 7) % 3) - 1} y={y} h={h * vary} fill={fill} w={w} />);
  }
  return <>{trees}</>;
}

/** A round broadleaf crown on a trunk. */
export function Broadleaf({ x, y, h, fill, trunk }: { x: number; y: number; h: number; fill: string; trunk?: string }) {
  const r = h * 0.34;
  return (
    <>
      <rect x={x - h * 0.03} y={y - h * 0.45} width={h * 0.06} height={h * 0.45} fill={trunk ?? fill} />
      <circle cx={x} cy={y - h + r} r={r} fill={fill} />
      <circle cx={x - r * 0.7} cy={y - h + r * 1.6} r={r * 0.75} fill={fill} />
      <circle cx={x + r * 0.7} cy={y - h + r * 1.5} r={r * 0.8} fill={fill} />
    </>
  );
}

/** A soft flat-bottomed cloud. */
export function Cloud({ x, y, s = 1, fill = '#ffffff', opacity = 0.85 }: { x: number; y: number; s?: number; fill?: string; opacity?: number }) {
  return (
    <path
      d={`M${n(x - 12 * s)} ${n(y)} a${n(5 * s)} ${n(5 * s)} 0 0 1 ${n(6 * s)} ${n(-5 * s)} a${n(6 * s)} ${n(6 * s)} 0 0 1 ${n(11 * s)} ${n(-2 * s)} a${n(5 * s)} ${n(5 * s)} 0 0 1 ${n(8 * s)} ${n(4 * s)} a${n(3.5 * s)} ${n(3.5 * s)} 0 0 1 ${n(-1 * s)} ${n(3 * s)}Z`}
      fill={fill}
      opacity={opacity}
    />
  );
}

/** Thin light lines across still water. */
export function Ripples({ y, x1 = 0, x2 = W, fill = '#ffffff', opacity = 0.35, rows = 3, gap = 3 }: { y: number; x1?: number; x2?: number; fill?: string; opacity?: number; rows?: number; gap?: number }) {
  const lines: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const span = x2 - x1;
    for (let j = 0; j < 4; j++) {
      const x = x1 + ((j * 0.27 + r * 0.13) % 1) * span;
      lines.push(<rect key={`${r}-${j}`} x={x} y={y + r * gap} width={span * 0.1} height={0.5} fill={fill} opacity={opacity} />);
    }
  }
  return <>{lines}</>;
}

/**
 * The part of a scene above `y`, mirrored into the water below it, clipped to
 * the water and faded.
 */
export function Reflection({ k, y, children, opacity = 0.4, name = 'water' }: { k: Kit; y: number; children: ReactNode; opacity?: number; name?: string }) {
  return (
    <>
      <defs>
        <clipPath id={k.id(name)}>
          <rect x="0" y={y} width={W} height={H - y} />
        </clipPath>
      </defs>
      <g clipPath={k.url(name)} opacity={opacity}>
        <g transform={`translate(0 ${2 * y}) scale(1 -1)`}>{children}</g>
      </g>
    </>
  );
}

/** A bird in flight, as two strokes. */
export function Bird({ x, y, s = 1, stroke = '#2b2b2b' }: { x: number; y: number; s?: number; stroke?: string }) {
  return (
    <path
      d={`M${n(x - 3 * s)} ${n(y)} q${n(1.5 * s)} ${n(-1.6 * s)} ${n(3 * s)} 0 q${n(1.5 * s)} ${n(-1.6 * s)} ${n(3 * s)} 0`}
      fill="none"
      stroke={stroke}
      strokeWidth={0.6 * s}
      strokeLinecap="round"
    />
  );
}

/** A bison in side view, facing left, standing on `y`. */
export function Bison({ x, y, s = 1, fill = '#2a1d14' }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(${n(x)} ${n(y)}) scale(${s})`} fill={fill}>
      <path d="M-6 -3.5 C-6 -7 -3.5 -8.2 -1 -8 C2 -7.8 4 -6.5 6 -5.8 C7.2 -5.3 7.5 -3.4 7 -2.4 L6.5 0 L5.6 0 L5.4 -1.8 L2 -2 L1.6 0 L0.7 0 L0.4 -2.2 L-3 -2 L-3.4 0 L-4.3 0 L-4.6 -1.9 C-5.6 -1.7 -7.4 -1.5 -7.8 -2.6 C-8.2 -3.4 -7.2 -3.8 -6 -3.5Z" />
      <path d="M-7.6 -3.4 q-0.9 -0.9 -0.4 -1.8" fill="none" stroke={fill} strokeWidth="0.5" />
    </g>
  );
}

/** A long-necked wading bird standing on `y`, facing right. */
export function Heron({ x, y, s = 1, fill = '#ffffff' }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(${n(x)} ${n(y)}) scale(${s})`} fill={fill}>
      <path d="M-3 -6 C-3 -8 0 -8.6 1.2 -7.4 C1.6 -8.6 1.4 -10.6 2 -12 C2.6 -13 3.8 -13 4 -12.2 L6.6 -12 L4 -11.4 C3.2 -11 2.8 -9.6 2.8 -8 C2.8 -6.6 2 -5.2 0 -4.8 C-1.6 -4.6 -3 -5 -3 -6Z" />
      <rect x="-0.6" y="-5" width="0.4" height="5" />
      <rect x="0.6" y="-5" width="0.4" height="5" />
    </g>
  );
}

/** A palm: a curved trunk and a burst of fronds. */
export function Palm({ x, y, h, fill, lean = 4 }: { x: number; y: number; h: number; fill: string; lean?: number }) {
  const tx = x + lean;
  const ty = y - h;
  const fronds: ReactNode[] = [];
  const angles = [-160, -130, -100, -70, -40, -15, -190];
  angles.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const len = h * 0.45;
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.6 + len * 0.35;
    fronds.push(<path key={i} d={`M${tx} ${ty} Q${(tx + ex) / 2} ${ty - len * 0.3} ${ex} ${ey}`} stroke={fill} strokeWidth={h * 0.06} fill="none" strokeLinecap="round" />);
  });
  return (
    <g>
      <path d={`M${x} ${y} Q${x + lean * 0.2} ${y - h * 0.5} ${tx} ${ty}`} stroke={fill} strokeWidth={h * 0.05} fill="none" />
      {fronds}
    </g>
  );
}
