import { setBoil } from './ink';
import { finish, H, W } from './stage';
import { sceneAt, SCENES, STARTS } from './scenes';

/** How long one scene dissolves into the next. */
export const FADE = 0.8;
/** The hand-drawn wobble is re-rolled this many times a second. */
const BOIL_FPS = 8;
/**
 * And the grain drifts at this rate. Both are tied to the clock rather than to
 * how many frames have been drawn, which keeps the film a pure function of its
 * clock: seek to the same moment twice and you get the same picture, and the
 * grain crawls like film stock instead of strobing at the refresh rate.
 */
const GRAIN_FPS = 12;

let spare: HTMLCanvasElement | null = null;

function spareContext(): CanvasRenderingContext2D | null {
  if (!spare) {
    spare = document.createElement('canvas');
    spare.width = W;
    spare.height = H;
  }
  return spare.getContext('2d');
}

/**
 * Draws the whole film at one moment: the scene showing, the next one dissolving
 * in over it near the cut, then the grain and vignette that tie the frame
 * together. Everything is a pure function of the clock, so seeking anywhere
 * gives exactly the frame that would have played.
 */
export function renderFilm(ctx: CanvasRenderingContext2D, clock: number): void {
  const boilFrame = Math.floor(clock * BOIL_FPS);
  const grainFrame = Math.floor(clock * GRAIN_FPS);
  setBoil(boilFrame);

  const { index, scene, t } = sceneAt(clock);
  scene.draw(ctx, { t, clock, frame: grainFrame });

  const ends = STARTS[index] + scene.seconds;
  const next = SCENES[index + 1];
  if (next && clock > ends - FADE) {
    const over = (clock - (ends - FADE)) / FADE;
    const layer = spareContext();
    if (layer) {
      setBoil(boilFrame);
      next.draw(layer, { t: clock - ends, clock, frame: grainFrame });
      ctx.save();
      ctx.globalAlpha = over;
      ctx.drawImage(layer.canvas, 0, 0);
      ctx.restore();
    }
  }

  setBoil(boilFrame);
  finish(ctx, grainFrame);
}

/** Fits the film inside a box, letterboxing rather than stretching it. */
export function fit(width: number, height: number): { scale: number; x: number; y: number } {
  const scale = Math.min(width / W, height / H);
  return { scale, x: (width - W * scale) / 2, y: (height - H * scale) / 2 };
}
