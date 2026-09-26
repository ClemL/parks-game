import { fill, line, ring, speckle, type Point, pt, boilSeed } from './ink';
import { sheet } from './paper';
import { hash1, hash2, rng } from './rand';

/** The film's palette, drawn from the board's own skins. */
export const INK = '#2b2118';
export const PAPER = '#f4e8d0';
export const CREAM = '#fbf3e2';
export const FOREST = '#2f5d42';
export const PINE = '#3f7351';
export const MOSS = '#7d9a5c';
export const GOLD = '#d9a441';
export const RUST = '#c4622d';
export const SKY = '#a8c8d8';
export const WATER = '#4b8fa8';
export const SLATE = '#5a6472';
export const SNOW = '#f2f6f8';
export const BERRY = '#9c4f6c';

export const SEATS = ['#d9663f', '#4f86a8', '#7d9a5c', '#9c6fae'];

/** A pine, cut from two or three shades of green paper. */
export function pine(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, seed = 1): void {
  const w = 34 * scale;
  const h = 78 * scale;
  ctx.save();
  ctx.translate(x, y);
  line(ctx, [pt(0, 0), pt(0, -h * 0.28)], { color: '#6b4a2f', width: 5 * scale, seed, wobble: 1 });

  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const top = -h * (0.32 + t * 0.62) - h * 0.3;
    const spread = (w / 2) * (1 - t * 0.42);
    const drop = h * 0.3;
    const shape: Point[] = [
      pt(0, top),
      pt(spread, top + drop),
      pt(spread * 0.45, top + drop * 0.86),
      pt(spread * 0.7, top + drop * 1.25),
      pt(-spread * 0.7, top + drop * 1.25),
      pt(-spread * 0.45, top + drop * 0.86),
      pt(-spread, top + drop),
    ];
    fill(ctx, shape, i === 0 ? PINE : i === 1 ? FOREST : '#27503a', { seed: seed + i * 17, wobble: 1.5 });
    line(ctx, [...shape, shape[0]], { color: INK, width: 1.5 * scale, alpha: 0.5, seed: seed + i, passes: 1, wobble: 1.2 });
  }
  ctx.restore();
}

/** A ridge with one face in shadow and a cap of torn white paper. */
export function mountain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed = 2): void {
  const peak = pt(x + w * 0.04, y - h);
  const left = pt(x - w / 2, y);
  const right = pt(x + w / 2, y);
  // A shoulder on the way down, so the ridge is not a perfect triangle.
  const shoulder = pt(x + w * 0.3, y - h * 0.42);
  const lit: Point[] = [left, peak, shoulder, right];
  fill(ctx, lit, '#6d7887', { seed, wobble: 2.4 });
  fill(ctx, [peak, shoulder, right, pt(x + w * 0.12, y)], '#4d5766', { seed: seed + 4, wobble: 2 });

  const cap = h * 0.26;
  const snow: Point[] = [
    pt(peak.x - w * 0.15, peak.y + cap),
    pt(peak.x - w * 0.07, peak.y + cap * 0.45),
    pt(peak.x - w * 0.02, peak.y + cap * 0.7),
    peak,
    pt(peak.x + w * 0.07, peak.y + cap * 0.55),
    pt(peak.x + w * 0.14, peak.y + cap * 1.1),
    pt(peak.x + w * 0.04, peak.y + cap * 0.75),
    pt(peak.x - w * 0.06, peak.y + cap * 0.95),
  ];
  fill(ctx, snow, SNOW, { seed: seed + 9, wobble: 1.1 });
  line(ctx, [left, peak, shoulder, right], { color: INK, width: 2.2, alpha: 0.5, seed, passes: 1, wobble: 1.6 });
}

/** A sun: a disc of gold with rays that were drawn in a hurry. */
export function sun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed = 3, turn = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const inner = r * 1.25;
    const outer = r * (1.55 + hash1(i, seed) * 0.42);
    line(ctx, [pt(Math.cos(a) * inner, Math.sin(a) * inner), pt(Math.cos(a) * outer, Math.sin(a) * outer)], {
      color: GOLD,
      width: 3.4,
      seed: seed + i,
      passes: 1,
      wobble: 1.1,
      alpha: 0.9,
    });
  }
  ctx.rotate(-turn);
  fill(ctx, ring(0, 0, r, seed), GOLD, { seed: seed + 5 });
  fill(ctx, ring(-r * 0.22, -r * 0.2, r * 0.55, seed + 2), '#f0c766', { seed: seed + 6, alpha: 0.7 });
  ctx.restore();
}

/** A drop of water, with a highlight. */
export function drop(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed = 4): void {
  const shape: Point[] = [
    pt(x, y - s),
    pt(x + s * 0.72, y + s * 0.34),
    pt(x + s * 0.3, y + s),
    pt(x - s * 0.3, y + s),
    pt(x - s * 0.72, y + s * 0.34),
  ];
  fill(ctx, shape, WATER, { seed, wobble: 1 });
  fill(ctx, ring(x - s * 0.22, y + s * 0.2, s * 0.22, seed + 1), '#bfe0ea', { seed: seed + 2, alpha: 0.8 });
}

/** A leaf, for autumn and for drifting about. */
export function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, turn: number, color: string, seed = 5): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  const shape: Point[] = [
    pt(0, -s),
    pt(s * 0.55, -s * 0.55),
    pt(s * 0.8, s * 0.1),
    pt(0, s),
    pt(-s * 0.8, s * 0.1),
    pt(-s * 0.55, -s * 0.55),
  ];
  fill(ctx, shape, color, { seed, wobble: 0.9 });
  line(ctx, [pt(0, -s * 0.85), pt(0, s * 0.9)], { color: INK, width: 1, alpha: 0.4, seed: seed + 1, passes: 1 });
  ctx.restore();
}

/**
 * A hiker, cut from paper: boots, a jacket in the seat's colour, a pack, a hat
 * and a stick. `stride` swings the legs and arms, `lift` picks the whole figure
 * up off the ground, and the shadow stays behind on the trail.
 *
 * Drawn at about 60px tall at scale 1, because a figure any smaller than that
 * reads as a smudge and this one has to carry the film.
 */
export function hiker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: string,
  o: { seed?: number; stride?: number; lift?: number; facing?: 1 | -1 } = {},
): void {
  const { seed = 6, stride = 0, lift = 0, facing = 1 } = o;
  const s = scale;
  const swing = Math.sin(stride);
  const bob = Math.abs(Math.cos(stride)) * 1.6 * s;

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x, y, 17 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y - lift - bob);
  ctx.scale(facing, 1);

  const hip = -26 * s;
  const shoulder = -46 * s;

  // Legs, back one first so the front reads in front.
  for (const [leg, phase] of [[-1, Math.PI], [1, 0]] as const) {
    const sw = Math.sin(stride + phase) * 0.7;
    const knee = pt(sw * 9 * s, hip + 13 * s);
    const foot = pt(sw * 15 * s, -1 * s);
    line(ctx, [pt(0, hip), knee, foot], {
      color: leg < 0 ? '#3a3026' : INK,
      width: 5.2 * s,
      seed: seed + (leg < 0 ? 40 : 41),
      passes: 1,
      wobble: 0.7,
    });
    fill(ctx, [pt(foot.x - 3 * s, foot.y - 3 * s), pt(foot.x + 9 * s, foot.y - 3.5 * s), pt(foot.x + 9 * s, foot.y + 1 * s), pt(foot.x - 3.5 * s, foot.y + 1 * s)], '#6b4a2f', {
      seed: seed + (leg < 0 ? 42 : 43),
      wobble: 0.6,
    });
  }

  // The pack rides behind the shoulder.
  fill(
    ctx,
    [pt(-14 * s, shoulder + 4 * s), pt(-3 * s, shoulder + 1 * s), pt(-2 * s, hip + 1 * s), pt(-14 * s, hip - 1 * s)],
    RUST,
    { seed: seed + 3, wobble: 0.9 },
  );
  fill(ctx, [pt(-13 * s, shoulder + 8 * s), pt(-4 * s, shoulder + 6 * s), pt(-4 * s, shoulder + 12 * s), pt(-13 * s, shoulder + 14 * s)], '#a24f24', {
    seed: seed + 31,
    wobble: 0.7,
  });

  // Jacket.
  fill(
    ctx,
    [pt(-9 * s, shoulder), pt(9 * s, shoulder + 1 * s), pt(8 * s, hip + 2 * s), pt(-8 * s, hip + 2 * s)],
    color,
    { seed, wobble: 1.1 },
  );
  fill(ctx, [pt(-9 * s, shoulder), pt(-2 * s, shoulder), pt(-2 * s, hip + 2 * s), pt(-8 * s, hip + 2 * s)], '#ffffff', {
    seed: seed + 1,
    alpha: 0.13,
  });

  // Arms: the front one holds the stick.
  const armSwing = swing * 0.8;
  line(ctx, [pt(2 * s, shoulder + 5 * s), pt(9 * s + armSwing * 5 * s, shoulder + 19 * s)], {
    color,
    width: 4.6 * s,
    seed: seed + 6,
    passes: 1,
    wobble: 0.6,
  });
  line(ctx, [pt(-1 * s, shoulder + 5 * s), pt(-8 * s - armSwing * 5 * s, shoulder + 18 * s)], {
    color: '#00000022',
    width: 4.6 * s,
    seed: seed + 7,
    passes: 1,
    wobble: 0.6,
  });

  // Head, hat and brim.
  fill(ctx, ring(1 * s, shoulder - 8 * s, 8 * s, seed + 8), '#e8c39a', { seed: seed + 8 });
  fill(ctx, [pt(-9 * s, shoulder - 11 * s), pt(12 * s, shoulder - 11 * s), pt(11 * s, shoulder - 8.5 * s), pt(-8 * s, shoulder - 8.5 * s)], '#6b4a2f', {
    seed: seed + 9,
    wobble: 0.6,
  });
  fill(ctx, [pt(-6 * s, shoulder - 11 * s), pt(8 * s, shoulder - 11 * s), pt(6 * s, shoulder - 18 * s), pt(-4 * s, shoulder - 18 * s)], '#7d5637', {
    seed: seed + 10,
    wobble: 0.7,
  });

  // The stick plants as the near foot lands.
  const plant = Math.sin(stride + 0.6) * 3 * s;
  line(ctx, [pt(11 * s + armSwing * 5 * s, shoulder + 14 * s), pt(15 * s + plant, 2 * s)], {
    color: '#6b4a2f',
    width: 3 * s,
    seed: seed + 11,
    passes: 1,
    wobble: 0.5,
  });
  ctx.restore();
}

/** The seat's disc, as it appears on the board itself. */
export function pawn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: string,
  o: { seed?: number; lift?: number } = {},
): void {
  const { seed = 6, lift = 0 } = o;
  const r = 17 * scale;
  ctx.save();
  ctx.globalAlpha = 0.22 - Math.min(0.14, lift * 0.004);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.85, r * 0.8, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y - lift);
  fill(ctx, ring(0, 0, r, seed), color, { seed });
  fill(ctx, ring(-r * 0.2, -r * 0.22, r * 0.46, seed + 1), '#ffffff', { seed: seed + 1, alpha: 0.2 });
  line(ctx, ring(0, 0, r, seed + 2), { color: INK, width: 2.4 * scale, close: true, seed: seed + 2, passes: 1, alpha: 0.75 });
  // A walker, reduced to what still reads at this size.
  line(ctx, [pt(-r * 0.12, -r * 0.1), pt(-r * 0.12, r * 0.24)], { color: INK, width: 3 * scale, seed: seed + 4, passes: 1, wobble: 0.4 });
  fill(ctx, ring(-r * 0.12, -r * 0.34, r * 0.19, seed + 5), INK, { seed: seed + 5 });
  line(ctx, [pt(-r * 0.12, r * 0.24), pt(r * 0.3, r * 0.5)], { color: INK, width: 2.6 * scale, seed: seed + 6, passes: 1, wobble: 0.4 });
  line(ctx, [pt(-r * 0.12, r * 0.24), pt(-r * 0.5, r * 0.5)], { color: INK, width: 2.6 * scale, seed: seed + 7, passes: 1, wobble: 0.4 });
  ctx.restore();
}

export interface CardFace {
  title?: string;
  icon?: string;
  tint?: string;
  /** Pips drawn along the bottom, as a cost or a payout. */
  pips?: string[];
  /** A number in the corner, as on a park card. */
  score?: number;
  /** Drawn face down. */
  back?: boolean;
}

/** A card, cut from paper and printed by hand. */
export function card(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  face: CardFace = {},
  seed = 7,
): void {
  const { title, icon, tint = CREAM, pips = [], score, back = false } = face;
  const body: Point[] = [pt(x - w / 2, y - h / 2), pt(x + w / 2, y - h / 2), pt(x + w / 2, y + h / 2), pt(x - w / 2, y + h / 2)];
  sheet(ctx, body, { fill: back ? '#3b5c48' : tint, seed, roughness: 2, shadow: 12 });

  if (back) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    for (let i = -2; i <= 2; i++) {
      line(ctx, [pt(x - w * 0.3, y + i * h * 0.13), pt(x + w * 0.3, y + i * h * 0.13)], {
        color: '#8fb49a',
        width: 2,
        seed: seed + i,
        passes: 1,
      });
    }
    ctx.restore();
    return;
  }

  if (icon) {
    ctx.save();
    ctx.font = `${Math.round(h * 0.3)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y - h * 0.12);
    ctx.restore();
  }

  if (title) {
    ctx.save();
    ctx.fillStyle = INK;
    ctx.font = `600 ${Math.round(h * 0.11)}px "Zilla Slab", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.88;
    ctx.translate(x, y + h * 0.2);
    ctx.rotate((hash1(1, seed) - 0.5) * 0.03);
    ctx.fillText(title, 0, 0);
    ctx.restore();
  }

  pips.forEach((colour, i) => {
    const span = pips.length * 11;
    drop(ctx, x - span / 2 + i * 11 + 5.5, y + h * 0.36, 4.6, seed + i * 3);
    if (colour !== WATER) {
      // Recolour the pip by overpainting: the shapes are all the same size.
      fill(ctx, ring(x - span / 2 + i * 11 + 5.5, y + h * 0.36, 4.4, seed + i), colour, { seed: seed + i, alpha: 1 });
    }
  });

  if (score !== undefined) {
    ctx.save();
    fill(ctx, ring(x + w * 0.33, y - h * 0.36, h * 0.1, seed + 11), GOLD, { seed: seed + 11 });
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.round(h * 0.12)}px "Zilla Slab", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(score), x + w * 0.33, y - h * 0.35);
    ctx.restore();
  }
}

/** A campfire, flickering on its own clock. */
export function flame(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, seed = 8): void {
  for (let i = 0; i < 3; i++) {
    const flick = Math.sin(t * 7 + i * 2.1) * 0.18 + 1;
    const height = s * (1.5 - i * 0.32) * flick;
    const width = s * (0.62 - i * 0.14);
    fill(
      ctx,
      [pt(x, y - height), pt(x + width, y - height * 0.22), pt(x + width * 0.5, y), pt(x - width * 0.5, y), pt(x - width, y - height * 0.3)],
      i === 0 ? RUST : i === 1 ? GOLD : '#f6dd9a',
      { seed: seed + i, wobble: 1.4 },
    );
  }
  line(ctx, [pt(x - s * 0.9, y + s * 0.1), pt(x + s * 0.9, y - s * 0.05)], { color: '#6b4a2f', width: 4, seed, passes: 1 });
  line(ctx, [pt(x - s * 0.8, y - s * 0.1), pt(x + s * 0.85, y + s * 0.12)], { color: '#553b25', width: 4, seed: seed + 1, passes: 1 });
  speckle(ctx, x, y - s * 1.4, s * 0.7, 6, GOLD, seed + Math.floor(t * 9), 1.2);
}

/** A tent, two flaps of canvas. */
export function tent(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed = 9): void {
  fill(ctx, [pt(x, y - s), pt(x + s * 0.95, y), pt(x - s * 0.95, y)], '#c9773f', { seed, wobble: 1.4 });
  fill(ctx, [pt(x, y - s), pt(x + s * 0.3, y), pt(x - s * 0.3, y)], '#2b2118', { seed: seed + 1, alpha: 0.45 });
  line(ctx, [pt(x, y - s * 1.12), pt(x, y)], { color: INK, width: 2, seed: seed + 2, passes: 1, alpha: 0.6 });
}

/** A camera, for the photographs. */
export function camera(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed = 10): void {
  const body: Point[] = [pt(x - s, y - s * 0.55), pt(x + s, y - s * 0.55), pt(x + s, y + s * 0.6), pt(x - s, y + s * 0.6)];
  fill(ctx, body, '#4a4038', { seed, wobble: 1 });
  fill(ctx, [pt(x - s * 0.35, y - s * 0.85), pt(x + s * 0.1, y - s * 0.85), pt(x + s * 0.1, y - s * 0.5), pt(x - s * 0.35, y - s * 0.5)], '#4a4038', {
    seed: seed + 1,
  });
  fill(ctx, ring(x, y, s * 0.42, seed + 2), '#cfd8dc', { seed: seed + 2 });
  fill(ctx, ring(x, y, s * 0.27, seed + 3), '#33505c', { seed: seed + 3 });
  fill(ctx, ring(x - s * 0.1, y - s * 0.09, s * 0.09, seed + 4), '#ffffff', { seed: seed + 4, alpha: 0.8 });
  fill(ctx, ring(x + s * 0.68, y - s * 0.3, s * 0.11, seed + 5), RUST, { seed: seed + 5 });
}

/** A flask, the water card. */
export function flask(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed = 11): void {
  const body: Point[] = [
    pt(x - s * 0.45, y - s * 0.5),
    pt(x + s * 0.45, y - s * 0.5),
    pt(x + s * 0.55, y + s * 0.8),
    pt(x - s * 0.55, y + s * 0.8),
  ];
  fill(ctx, body, '#9db5a4', { seed, wobble: 1 });
  fill(ctx, [pt(x - s * 0.5, y + s * 0.1), pt(x + s * 0.5, y + s * 0.1), pt(x + s * 0.55, y + s * 0.8), pt(x - s * 0.55, y + s * 0.8)], WATER, {
    seed: seed + 1,
    alpha: 0.85,
  });
  fill(ctx, [pt(x - s * 0.18, y - s * 0.78), pt(x + s * 0.18, y - s * 0.78), pt(x + s * 0.2, y - s * 0.46), pt(x - s * 0.2, y - s * 0.46)], '#6b4a2f', {
    seed: seed + 2,
  });
  line(ctx, [...body, body[0]], { color: INK, width: 1.8, alpha: 0.5, seed: seed + 3, passes: 1 });
}

/** A rubber stamp, thunked down at an angle. */
export function stamp(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, turn: number, colour = RUST, seed = 12): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.globalAlpha = 0.86;
  const w = Math.max(56, text.length * 13);
  const h = 34;
  line(ctx, [pt(-w / 2, -h / 2), pt(w / 2, -h / 2), pt(w / 2, h / 2), pt(-w / 2, h / 2)], {
    color: colour,
    width: 3,
    close: true,
    seed,
    passes: 2,
    wobble: 1.3,
  });
  ctx.fillStyle = colour;
  ctx.font = `700 ${Math.round(h * 0.52)}px "Zilla Slab", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

/** A bird: two strokes, the oldest trick in the book. */
export function bird(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, seed = 13): void {
  const flap = Math.sin(t * 5 + seed) * 0.4;
  line(ctx, [pt(x - s, y + s * flap), pt(x - s * 0.2, y - s * 0.25), pt(x, y - s * 0.05)], {
    color: INK,
    width: 2,
    seed,
    passes: 1,
    alpha: 0.7,
  });
  line(ctx, [pt(x, y - s * 0.05), pt(x + s * 0.2, y - s * 0.25), pt(x + s, y + s * flap)], {
    color: INK,
    width: 2,
    seed: seed + 1,
    passes: 1,
    alpha: 0.7,
  });
}

/** An arrow, for pointing at what matters. */
export function arrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, o: { color?: string; width?: number; seed?: number; head?: number } = {}): void {
  const { color = INK, width = 3, seed = 14, head = 12 } = o;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const bend = 14;
  const mid = pt((from.x + to.x) / 2 + Math.cos(angle - Math.PI / 2) * bend, (from.y + to.y) / 2 + Math.sin(angle - Math.PI / 2) * bend);
  line(ctx, [from, mid, to], { color, width, seed, passes: 2, wobble: 1.4 });
  line(ctx, [pt(to.x - Math.cos(angle - 0.5) * head, to.y - Math.sin(angle - 0.5) * head), to,
    pt(to.x - Math.cos(angle + 0.5) * head, to.y - Math.sin(angle + 0.5) * head)], {
    color,
    width,
    seed: seed + 1,
    passes: 2,
    wobble: 1,
  });
}

/** Hand-lettered display type, set down one word at a time. */
export function lettering(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  o: { color?: string; align?: CanvasTextAlign; seed?: number; alpha?: number; weight?: number } = {},
): void {
  const { color = INK, align = 'center', seed = 15, alpha = 1, weight = 700 } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${weight} ${size}px "Zilla Slab", Georgia, serif`;
  const width = ctx.measureText(text).width;
  let cursor = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  for (const glyph of text) {
    const w = ctx.measureText(glyph).width;
    ctx.save();
    ctx.translate(cursor + w / 2, y + (hash2(cursor | 0, boilSeed(seed), 3) - 0.5) * size * 0.05);
    ctx.rotate((hash2(cursor | 0, seed, 5) - 0.5) * 0.045);
    ctx.fillText(glyph, -w / 2, 0);
    ctx.restore();
    cursor += w;
  }
  ctx.restore();
}

/** Scatters a handful of things about without them landing in a grid. */
export function scatter(seed: number, count: number, w: number, h: number): { x: number; y: number; r: number }[] {
  const random = rng(seed);
  return Array.from({ length: count }, () => ({ x: random() * w, y: random() * h, r: random() }));
}
