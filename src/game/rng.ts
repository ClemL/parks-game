/** Deterministic 32-bit LCG so a seed always replays the same game. */
export function nextRng(state: number): number {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

export function randomFloat(state: number): [number, number] {
  const next = nextRng(state);
  return [next / 0x100000000, next];
}

export function randomInt(state: number, maxExclusive: number): [number, number] {
  const [f, next] = randomFloat(state);
  return [Math.floor(f * maxExclusive), next];
}

/** Fisher-Yates using the seeded generator. Returns a new array. */
export function shuffle<T>(items: readonly T[], state: number): [T[], number] {
  const out = items.slice();
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = randomInt(s, i + 1);
    s = next;
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return [out, s];
}
