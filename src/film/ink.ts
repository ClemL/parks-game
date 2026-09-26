import { fbm, hash1, hash2, rng } from './rand';

export interface Point {
  x: number;
  y: number;
}

export const pt = (x: number, y: number): Point => ({ x, y });

/**
 * Hand-drawn work is redrawn for every frame, so the lines shimmer — animators
 * call it boil. Quantising the wobble seed to a few frames a second gives that,
 * while the motion itself stays smooth.
 */
let boil = 0;
export const setBoil = (frame: number): void => {
  boil = frame;
};
export const boilSeed = (seed: number): number => seed * 7919 + boil * 104729;

export interface Stroke {
  color?: string;
  width?: number;
  /** How far the line wanders from true, in pixels. */
  wobble?: number;
  /** Redraws, each slightly off, for a pencil that has been over the line. */
  passes?: number;
  alpha?: number;
  seed?: number;
  cap?: CanvasLineCap;
  close?: boolean;
  /** Leaves the ends short, the way a quick pencil stroke does. */
  gap?: number;
}

/** Walks a polyline, adding low-frequency drift and a little jitter. */
function wobbled(points: Point[], amount: number, seed: number, resample = 9): Point[] {
  const out: Point[] = [];
  let travelled = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.round(length / resample));
    const nx = -dy / (length || 1);
    const ny = dx / (length || 1);
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const at = travelled + length * t;
      const drift = fbm(at * 0.035, seed) * amount + (hash2(i * 31 + s, seed, 7) - 0.5) * amount * 0.35;
      out.push({ x: a.x + dx * t + nx * drift, y: a.y + dy * t + ny * drift });
    }
    travelled += length;
  }
  const last = points[points.length - 1];
  const endDrift = fbm(travelled * 0.035, seed) * amount;
  out.push({ x: last.x + endDrift * 0.3, y: last.y + endDrift * 0.3 });
  return out;
}

/** A smooth path through the given points. */
function traceSmooth(ctx: CanvasRenderingContext2D, points: Point[], close: boolean): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  if (close) ctx.closePath();
}

/** A pencil line: a few passes, each wandering slightly differently. */
export function line(ctx: CanvasRenderingContext2D, points: Point[], o: Stroke = {}): void {
  const {
    color = '#2b2118',
    width = 2,
    wobble = 1.6,
    passes = 2,
    alpha = 0.85,
    seed = 1,
    cap = 'round',
    close = false,
    gap = 0,
  } = o;
  if (points.length < 2) return;

  let path = points;
  if (gap > 0 && path.length > 2) path = path.slice(0, -1);

  ctx.save();
  ctx.lineCap = cap;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  for (let p = 0; p < passes; p++) {
    ctx.globalAlpha = alpha * (p === 0 ? 1 : 0.5);
    ctx.lineWidth = width * (p === 0 ? 1 : 0.7);
    traceSmooth(ctx, wobbled(path, wobble, boilSeed(seed + p * 131)), close);
    ctx.stroke();
  }
  ctx.restore();
}

/** A shape filled the way a brush fills it: edge slightly past the line. */
export function fill(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  o: { seed?: number; wobble?: number; alpha?: number } = {},
): void {
  const { seed = 3, wobble = 1.4, alpha = 1 } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  traceSmooth(ctx, wobbled([...points, points[0]], wobble, boilSeed(seed)), true);
  ctx.fill();
  ctx.restore();
}

/** Pencil shading, for the shadowed side of a thing. */
export function hatch(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  o: { color?: string; gap?: number; angle?: number; seed?: number; alpha?: number } = {},
): void {
  const { color = '#2b2118', gap = 7, angle = -0.6, seed = 5, alpha = 0.22 } = o;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const span = Math.hypot(right - left, bottom - top);

  ctx.save();
  traceSmooth(ctx, wobbled([...points, points[0]], 1, boilSeed(seed)), true);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let i = -span; i < span; i += gap) {
    const ox = left + i;
    const jitter = fbm(i * 0.3, boilSeed(seed + 17)) * 1.6;
    ctx.beginPath();
    ctx.moveTo(ox + jitter, top - span);
    ctx.lineTo(ox + dx * span * 2 + jitter, top - span + dy * span * 2 + span * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Speckles, for grit, spray or a dusting of snow. */
export function speckle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  count: number,
  color: string,
  seed = 9,
  size = 1.4,
): void {
  const random = rng(seed + boil);
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    const r = size * (0.4 + random() * 0.9);
    ctx.globalAlpha = 0.25 + random() * 0.5;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, r, r * 0.8, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A circle that was drawn by hand, not by a compass. */
export function ring(cx: number, cy: number, r: number, seed = 2, points = 22): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (1 + (hash1(i, seed) - 0.5) * 0.06);
    out.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return out;
}

/** A rectangle with corners a hand would round off. */
export function box(x: number, y: number, w: number, h: number, seed = 4): Point[] {
  const j = (i: number) => (hash1(i, seed) - 0.5) * Math.min(w, h) * 0.02;
  return [
    { x: x + j(0), y: y + j(1) },
    { x: x + w + j(2), y: y + j(3) },
    { x: x + w + j(4), y: y + h + j(5) },
    { x: x + j(6), y: y + h + j(7) },
  ];
}
