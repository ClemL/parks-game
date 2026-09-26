/**
 * Deterministic noise, so the film draws itself the same way every time it is
 * played — the same principle the game's seeded RNG runs on.
 */

/** Hash two integers into 0..1. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Hash one integer into 0..1. */
export const hash1 = (x: number, seed = 0): number => hash2(x, 0x5bf03635, seed);

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Smooth value noise in -1..1, continuous in x. */
export function noise(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = smooth(x - i);
  const a = hash1(i, seed);
  const b = hash1(i + 1, seed);
  return (a + (b - a) * f) * 2 - 1;
}

/** Layered noise, for edges that read as torn rather than wavy. */
export function fbm(x: number, seed = 0, octaves = 3): number {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * frequency, seed + i * 977) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }
  return sum / total;
}

/** A small seeded generator, for scattering things about. */
export function rng(seed: number): () => number {
  let state = (seed | 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 8) / 16777216;
  };
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo = 0, hi = 1): number => (v < lo ? lo : v > hi ? hi : v);

/** 0..1 eased with a soft start and stop. */
export const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Overshoots a little before settling, for paper landing on paper. */
export function settle(t: number, overshoot = 1.5): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const p = 1 - t;
  return 1 - p * p * ((overshoot + 1) * p - overshoot);
}

/** Eases out fast, for something thrown down. */
export const outCubic = (t: number): number => 1 - Math.pow(1 - clamp(t), 3);
export const inCubic = (t: number): number => Math.pow(clamp(t), 3);
