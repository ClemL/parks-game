import { renderFilm } from './player';
import { DURATION } from './scenes';
import { H, W } from './stage';

/**
 * The preview harness behind film-preview.html, for working on the scenes
 * without the app around them. `?t=12.5` draws that moment and stops; with no
 * `t` it loops the whole film.
 */
const canvas = document.getElementById('sheet') as HTMLCanvasElement;
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d')!;
const at = Number(new URLSearchParams(location.search).get('t'));

if (Number.isFinite(at) && at > 0) {
  renderFilm(ctx, at);
  (window as unknown as { filmReady: boolean }).filmReady = true;
} else {
  let started = 0;
  const loop = (now: number) => {
    if (!started) started = now;
    const clock = ((now - started) / 1000) % DURATION;
    renderFilm(ctx, clock);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
