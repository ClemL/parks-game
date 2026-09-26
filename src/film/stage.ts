import { fill, line, pt, ring, setBoil, type Point } from './ink';
import { grain, sheet, tape, vignette } from './paper';
import * as p from './props';
import { clamp, ease, fbm, hash1, outCubic, rng, settle } from './rand';

/** The film is composed at this size and scaled to whatever it is shown in. */
export const W = 1280;
export const H = 720;
/** Captions sit here, so nothing that matters is drawn below it. */
export const FLOOR = 600;

export interface Frame {
  /** Seconds into the scene. */
  t: number;
  /** Seconds into the whole film. */
  clock: number;
  frame: number;
}

/** A window of a scene, as 0..1, for driving one beat of the action. */
export const beat = (t: number, from: number, length: number): number => clamp((t - from) / length);

/* ------------------------------------------------------------ the ground */

/** The sheet of paper every scene is drawn on. */
export function ground(ctx: CanvasRenderingContext2D, tint: string, seed = 1): void {
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, W, H);
  sheet(ctx, [pt(-14, -10), pt(W + 12, -14), pt(W + 14, H + 12), pt(-12, H + 10)], {
    fill: tint,
    edge: '#fffaf0',
    seed,
    roughness: 6,
    shadow: 0,
  });
}

/** Distant hills, in two washes, for depth behind everything else. */
export function hills(ctx: CanvasRenderingContext2D, y: number, seed: number, drift = 0): void {
  for (let layer = 0; layer < 2; layer++) {
    const points: Point[] = [pt(-40, y + 90)];
    const height = 70 - layer * 22;
    for (let x = -40; x <= W + 40; x += 40) {
      points.push(pt(x, y - height * (0.6 + fbm(x * 0.004 + layer * 3 + drift, seed + layer) * 0.7) + layer * 34));
    }
    points.push(pt(W + 40, y + 90));
    fill(ctx, points, layer === 0 ? '#c3d2c4' : '#a9bfae', { seed: seed + layer * 9, wobble: 2.4, alpha: 0.85 });
  }
}

/** The trail itself: a dashed path with a little rise and fall. */
export function trailPath(y: number): Point[] {
  const points: Point[] = [];
  for (let x = 60; x <= W - 60; x += 24) points.push(pt(x, y + Math.sin(x * 0.011) * 12 + fbm(x * 0.01, 5) * 6));
  return points;
}

export function dashedTrail(ctx: CanvasRenderingContext2D, path: Point[], progress: number, seed = 7): void {
  const upto = Math.max(2, Math.floor(path.length * clamp(progress)));
  const shown = path.slice(0, upto);
  ctx.save();
  ctx.setLineDash([16, 13]);
  line(ctx, shown, { color: '#8a7455', width: 5, seed, passes: 1, wobble: 1.2, alpha: 0.75 });
  ctx.restore();
}

/* ------------------------------------------------------ pieces of a board */

export interface Site {
  name: string;
  icon: string;
  pips: string[];
  token?: boolean;
}

export const SITE_ROW: Site[] = [
  { name: 'Trailhead', icon: '🥾', pips: [] },
  { name: 'Valley', icon: '💧', pips: [p.WATER, p.WATER], token: true },
  { name: 'Woodland', icon: '🌲', pips: [p.MOSS, p.MOSS], token: true },
  { name: 'Ridge', icon: '⛰️', pips: [p.SLATE], token: true },
  { name: 'Sunlit Basin', icon: '☀️', pips: [p.GOLD, p.GOLD], token: true },
  { name: 'Camera Point', icon: '📷', pips: [], token: true },
  { name: 'Trail End', icon: '🏕️', pips: [] },
];

/** A row of site cards, dealt left to right as `dealt` grows. */
export function siteRow(
  ctx: CanvasRenderingContext2D,
  sites: Site[],
  y: number,
  dealt: number,
  o: { w?: number; h?: number; gap?: number; tokens?: boolean[]; seed?: number; lift?: number[]; cx?: number } = {},
): { x: number; y: number }[] {
  const { w = 132, h = 168, gap = 18, tokens, seed = 20, lift = [], cx = W / 2 } = o;
  const span = sites.length * w + (sites.length - 1) * gap;
  const left = cx - span / 2 + w / 2;
  const places: { x: number; y: number }[] = [];

  sites.forEach((site, i) => {
    const x = left + i * (w + gap);
    const appear = clamp(dealt - i);
    places.push({ x, y });
    if (appear <= 0) return;
    const drop = (1 - settle(appear)) * -220;
    const turn = (hash1(i, seed) - 0.5) * 0.05 * (1 - appear * 0.6);
    ctx.save();
    ctx.translate(x, y + drop - (lift[i] ?? 0));
    ctx.rotate(turn);
    ctx.globalAlpha = Math.min(1, appear * 2);
    p.card(ctx, 0, 0, w, h, { title: site.name, icon: site.icon, pips: site.pips }, seed + i * 5);
    if ((tokens ? tokens[i] : site.token) === true) {
      const bob = Math.sin(i * 1.7) * 1.5;
      p.card(ctx, w * 0.3, -h * 0.34 + bob, 0, 0, {}, seed);
      fill(ctx, ring(w * 0.31, -h * 0.33 + bob, 13, seed + i), p.GOLD, { seed: seed + i });
      line(ctx, ring(w * 0.31, -h * 0.33 + bob, 13, seed + i + 1), {
        color: p.INK,
        width: 1.6,
        close: true,
        passes: 1,
        alpha: 0.6,
        seed: seed + i,
      });
      ctx.save();
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i % 2 === 0 ? '☀️' : '💧', w * 0.31, -h * 0.33 + bob + 1);
      ctx.restore();
    }
    ctx.restore();
  });
  return places;
}

/** A resource flying from one place to another, with a little arc. */
export function flyResource(
  ctx: CanvasRenderingContext2D,
  kind: 'sun' | 'water' | 'tree' | 'rock',
  from: Point,
  to: Point,
  progress: number,
  seed = 30,
): void {
  if (progress <= 0 || progress > 1) return;
  const e = outCubic(progress);
  const x = from.x + (to.x - from.x) * e;
  const y = from.y + (to.y - from.y) * e - Math.sin(e * Math.PI) * 90;
  const turn = progress * 4 + seed;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(turn) * 0.3);
  const s = 15 * (1 - progress * 0.2);
  if (kind === 'sun') p.sun(ctx, 0, 0, s * 0.62, seed, turn * 0.5);
  else if (kind === 'water') p.drop(ctx, 0, 0, s, seed);
  else if (kind === 'tree') p.pine(ctx, 0, s, 0.42, seed);
  else fill(ctx, ring(0, 0, s * 0.8, seed), p.SLATE, { seed });
  ctx.restore();
}

/** A pack, which the resources fly into. */
export function pack(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, bulge = 0, seed = 40): void {
  const w = 86 * s * (1 + bulge * 0.05);
  const h = 96 * s * (1 + bulge * 0.05);
  const body: Point[] = [
    pt(x - w / 2, y - h / 2),
    pt(x + w / 2, y - h / 2),
    pt(x + w / 2 + 4, y + h / 2),
    pt(x - w / 2 - 4, y + h / 2),
  ];
  fill(ctx, body, p.RUST, { seed, wobble: 1.4 });
  fill(ctx, [pt(x - w / 2, y - h * 0.1), pt(x + w / 2, y - h * 0.1), pt(x + w / 2, y + h * 0.16), pt(x - w / 2, y + h * 0.16)], '#a24f24', {
    seed: seed + 1,
    wobble: 1,
  });
  fill(ctx, [pt(x - w * 0.3, y - h * 0.62), pt(x + w * 0.3, y - h * 0.62), pt(x + w * 0.24, y - h * 0.42), pt(x - w * 0.24, y - h * 0.42)], '#b4592a', {
    seed: seed + 2,
    wobble: 1,
  });
  line(ctx, [...body, body[0]], { color: p.INK, width: 2, alpha: 0.5, seed: seed + 3, passes: 1 });
}

/** Snow, leaves or blossom, drifting across the frame. */
export function weather(
  ctx: CanvasRenderingContext2D,
  kind: 'blossom' | 'leaves' | 'snow',
  t: number,
  amount: number,
  seed = 50,
): void {
  if (amount <= 0) return;
  const random = rng(seed);
  const count = Math.floor(34 * amount);
  for (let i = 0; i < count; i++) {
    const speed = 30 + random() * 50;
    const sway = random() * 60 + 20;
    const startX = random() * (W + 200) - 100;
    const y = ((random() * H + t * speed) % (H + 160)) - 80;
    const x = startX + Math.sin(t * 0.7 + i) * sway;
    const turn = t * (random() * 2 - 1) + i;
    const s = 6 + random() * 7;
    if (kind === 'snow') {
      fill(ctx, ring(x, y, s * 0.42, seed + i), '#ffffff', { seed: seed + i, alpha: 0.85 });
    } else if (kind === 'leaves') {
      p.leaf(ctx, x, y, s, turn, i % 3 === 0 ? p.RUST : i % 3 === 1 ? p.GOLD : '#b4592a', seed + i);
    } else {
      fill(ctx, ring(x, y, s * 0.38, seed + i), i % 2 ? '#f6d9e2' : '#ffffff', { seed: seed + i, alpha: 0.9 });
    }
  }
}

/**
 * The near bank: a torn strip along the bottom with grass, stones and the odd
 * sapling. Without it a scene floats in the middle of the paper; with it the
 * frame has a foreground, a middle and a distance, which is what makes a
 * collage read as a place.
 */
export function foreground(ctx: CanvasRenderingContext2D, o: { colour?: string; y?: number; seed?: number; sparse?: boolean } = {}): void {
  const { colour = '#cbd6bd', y = 646, seed = 70, sparse = false } = o;
  const band: Point[] = [pt(-30, y + 40)];
  for (let x = -30; x <= W + 30; x += 46) band.push(pt(x, y + fbm(x * 0.006, seed) * 22));
  band.push(pt(W + 30, H + 40), pt(-30, H + 40));
  fill(ctx, band, colour, { seed, wobble: 2.6, alpha: 0.9 });

  const random = rng(seed * 13 + 5);
  const tufts = sparse ? 9 : 17;
  for (let i = 0; i < tufts; i++) {
    const x = random() * (W + 60) - 30;
    const top = y + fbm(x * 0.006, seed) * 22 + random() * 10;
    const h = 12 + random() * 16;
    const shade = random() > 0.6 ? '#8fa77c' : '#6f8b63';
    for (let blade = -1; blade <= 1; blade++) {
      line(ctx, [pt(x + blade * 4, top + 6), pt(x + blade * 9, top - h * (1 - Math.abs(blade) * 0.3))], {
        color: shade,
        width: 2.4,
        seed: seed + i * 3 + blade,
        passes: 1,
        wobble: 0.8,
        alpha: 0.9,
      });
    }
  }
  for (let i = 0; i < (sparse ? 3 : 6); i++) {
    const x = random() * W;
    const top = y + 16 + random() * 30;
    const r = 5 + random() * 9;
    fill(ctx, ring(x, top, r, seed + i * 7), random() > 0.5 ? '#9aa39a' : '#8b9488', { seed: seed + i * 7, alpha: 0.85 });
  }
}

/** The frame's furniture: vignette, grain, and a hand-drawn border. */
export function finish(ctx: CanvasRenderingContext2D, frame: number): void {
  vignette(ctx, W, H);
  grain(ctx, W, H, frame);
}

export { p as props, setBoil, tape, ease, clamp, settle, outCubic };
