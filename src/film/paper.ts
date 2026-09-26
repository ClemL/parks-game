import { fbm, hash2, rng } from './rand';
import { boilSeed, type Point } from './ink';

/**
 * The collage substrate: sheets of paper, torn edges, tape and grain. Every
 * texture is drawn once into an offscreen tile and reused, so a frame is a few
 * dozen composites rather than a few million pixel writes.
 */

const tiles = new Map<string, CanvasPattern | null>();

function makeTile(key: string, size: number, paint: (ctx: CanvasRenderingContext2D) => void): CanvasPattern | null {
  const held = tiles.get(key);
  if (held !== undefined) return held;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  let pattern: CanvasPattern | null = null;
  if (ctx) {
    paint(ctx);
    pattern = ctx.createPattern(canvas, 'repeat');
  }
  tiles.set(key, pattern);
  return pattern;
}

/** Fibres and blotches: what makes a flat fill read as paper. */
export function fibrePattern(seed = 1): CanvasPattern | null {
  return makeTile(`fibre${seed}`, 180, (ctx) => {
    const random = rng(seed * 31 + 7);
    ctx.clearRect(0, 0, 180, 180);
    for (let i = 0; i < 900; i++) {
      const x = random() * 180;
      const y = random() * 180;
      const long = random() * 9 + 2;
      const angle = random() * Math.PI;
      ctx.globalAlpha = 0.03 + random() * 0.05;
      ctx.strokeStyle = random() > 0.45 ? '#ffffff' : '#7a6a4f';
      ctx.lineWidth = random() * 1.1 + 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * long, y + Math.sin(angle) * long);
      ctx.stroke();
    }
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.02 + random() * 0.03;
      ctx.fillStyle = '#6b5a3c';
      const r = random() * 16 + 4;
      ctx.beginPath();
      ctx.ellipse(random() * 180, random() * 180, r, r * (0.5 + random()), random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** The film grain that sits over everything and ties the cut-outs together. */
export function grainPattern(): CanvasPattern | null {
  return makeTile('grain', 128, (ctx) => {
    const image = ctx.createImageData(128, 128);
    const random = rng(4242);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = random();
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v > 0.5 ? 255 : 0;
      image.data[i + 3] = Math.floor(v > 0.5 ? (v - 0.5) * 36 : (0.5 - v) * 40);
    }
    ctx.putImageData(image, 0, 0);
  });
}

/** Grain, drifting a pixel or two each frame so the frame feels alive. */
export function grain(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number): void {
  const pattern = grainPattern();
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.translate(-(frame * 37) % 128, -(frame * 53) % 128);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w + 128, h + 128);
  ctx.restore();
}

/** Takes a polygon and chews its edges, the way a torn sheet goes. */
export function torn(points: Point[], seed = 1, roughness = 3.2, per = 11): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    const steps = Math.max(2, Math.round(length / per));
    const nx = -dy / (length || 1);
    const ny = dx / (length || 1);
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const edge = fbm(i * 13 + t * steps * 0.9, seed, 2) * roughness;
      const nib = (hash2(i * 97 + s, seed, 3) - 0.5) * roughness * 1.1;
      out.push({ x: a.x + dx * t + nx * (edge + nib), y: a.y + dy * t + ny * (edge + nib) });
    }
  }
  return out;
}

function trace(ctx: CanvasRenderingContext2D, points: Point[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

export interface SheetOptions {
  fill?: string;
  /** The pale fibre showing along a torn edge. */
  edge?: string;
  seed?: number;
  roughness?: number;
  shadow?: number;
  /** Fibres and blotches over the fill. */
  texture?: boolean;
  alpha?: number;
}

/** A piece of paper, cut or torn, sitting on top of what came before. */
export function sheet(ctx: CanvasRenderingContext2D, points: Point[], o: SheetOptions = {}): Point[] {
  const {
    fill: face = '#f4e8d0',
    edge = '#fffaf0',
    seed = 1,
    roughness = 3,
    shadow = 10,
    texture = true,
    alpha = 1,
  } = o;
  const outline = torn(points, boilSeed(seed) % 9973, roughness);

  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadow > 0) {
    ctx.save();
    ctx.shadowColor = 'rgba(28, 22, 14, 0.42)';
    ctx.shadowBlur = shadow;
    ctx.shadowOffsetY = shadow * 0.45;
    ctx.fillStyle = edge;
    trace(ctx, outline);
    ctx.fill();
    ctx.restore();
  }

  // The torn edge is a hair of pale fibre around a slightly smaller face.
  ctx.fillStyle = edge;
  trace(ctx, outline);
  ctx.fill();

  const centreX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const centreY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const inner = outline.map((p) => ({
    x: centreX + (p.x - centreX) * 0.985,
    y: centreY + (p.y - centreY) * 0.985,
  }));
  ctx.fillStyle = face;
  trace(ctx, inner);
  ctx.fill();

  if (texture) {
    const pattern = fibrePattern(seed % 5);
    if (pattern) {
      ctx.save();
      trace(ctx, inner);
      ctx.clip();
      ctx.globalAlpha = 0.85 * alpha;
      ctx.fillStyle = pattern;
      const xs = inner.map((p) => p.x);
      const ys = inner.map((p) => p.y);
      ctx.fillRect(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      ctx.restore();
    }
  }
  ctx.restore();
  return outline;
}

/** A strip of tape, for holding a corner down. */
export function tape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
  seed = 2,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const ends: Point[] = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) ends.push({ x: (-w / 2) + (w * i) / steps, y: -h / 2 + (hash2(i, seed, 1) - 0.5) * 3 });
  for (let i = steps; i >= 0; i--) ends.push({ x: (-w / 2) + (w * i) / steps, y: h / 2 + (hash2(i, seed, 2) - 0.5) * 3 });
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = '#e8dcc0';
  trace(ctx, ends);
  ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = '#fffaf0';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** The soft darkening at the edge of the frame, as on old paper stock. */
export function vignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gradient = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.78);
  gradient.addColorStop(0, 'rgba(30, 24, 16, 0)');
  gradient.addColorStop(1, 'rgba(30, 24, 16, 0.34)');
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
