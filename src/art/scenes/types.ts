import type { Scene } from '../kit';

export interface ParkScene {
  /** The view the drawing is after, in words: read out as the image's label. */
  view: string;
  draw: Scene;
}
