import type { ParkScene } from './types';
import { EAST } from './east';
import { HEARTLAND } from './heartland';
import { NORTH_PACIFIC } from './north-pacific';
import { SOUTHWEST } from './southwest';
import { WEST } from './west';

export type { ParkScene } from './types';

/** One illustration per park, keyed by park id. */
export const SCENES: Record<string, ParkScene> = {
  ...WEST,
  ...SOUTHWEST,
  ...HEARTLAND,
  ...EAST,
  ...NORTH_PACIFIC,
};
