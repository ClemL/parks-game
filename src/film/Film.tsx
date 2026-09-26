import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fit, renderFilm } from './player';
import { captionAt, CAPTIONS, DURATION, SCENES, STARTS } from './scenes';
import { H, W } from './stage';

/** The frame shown before anybody presses play: the title, fully drawn. */
const POSTER = 9.2;

const clock = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The film: a hand-drawn walk through the game, drawn frame by frame onto a
 * canvas — no video file, no audio, nothing to download.
 *
 * It is a pure function of its clock, so the scrubber can land anywhere and get
 * exactly the frame that would have played. The captions are real text in the
 * document rather than burned into the picture, so they can be read by a screen
 * reader, selected, and translated.
 */
export function Film({ onDone }: { onDone?: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const started = useRef<number | null>(null);
  const held = useRef(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [script, setScript] = useState(false);

  const still = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  /** Paints one frame at the given moment. */
  const paint = useCallback((at: number) => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = element.clientWidth;
    const height = Math.round((width * H) / W);
    if (element.width !== Math.round(width * dpr) || element.height !== Math.round(height * dpr)) {
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
    }
    const box = fit(element.width, element.height);
    ctx.save();
    ctx.translate(box.x, box.y);
    ctx.scale(box.scale, box.scale);
    renderFilm(ctx, at);
    ctx.restore();
  }, []);

  // The loop. It only runs while playing, so a paused film costs nothing.
  useEffect(() => {
    if (!playing) {
      // Before it has been started, show the title card rather than the blank
      // sheet the film opens on.
      paint(held.current > 0 ? held.current : POSTER);
      return;
    }
    let alive = true;
    started.current = null;
    const step = (now: number) => {
      if (!alive) return;
      if (started.current === null) started.current = now - held.current * 1000;
      const at = (now - started.current) / 1000;
      if (at >= DURATION) {
        held.current = DURATION;
        setTime(DURATION);
        setPlaying(false);
        setEnded(true);
        paint(DURATION - 0.01);
        onDone?.();
        return;
      }
      held.current = at;
      setTime(at);
      paint(at);
      requestAnimationFrame(step);
    };
    const id = requestAnimationFrame(step);
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [playing, paint, onDone]);

  // A film nobody can see should not be drawing itself.
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) setPlaying(false);
      },
      { threshold: 0.25 },
    );
    watcher.observe(element);
    const onHidden = () => document.hidden && setPlaying(false);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      watcher.disconnect();
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, []);

  // Repaint on resize, so a rotated phone does not show a stretched frame.
  useEffect(() => {
    const onResize = () => paint(held.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [paint]);

  const seek = useCallback(
    (to: number) => {
      const at = Math.max(0, Math.min(DURATION - 0.05, to));
      held.current = at;
      started.current = null;
      setTime(at);
      setEnded(false);
      paint(at);
    },
    [paint],
  );

  const toggle = useCallback(() => {
    if (ended) {
      seek(0);
      setPlaying(true);
      return;
    }
    setPlaying((on) => !on);
  }, [ended, seek]);

  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      toggle();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      seek(held.current + 5);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      seek(held.current - 5);
    }
  };

  const caption = captionAt(time);
  const chapter = SCENES[Math.max(0, STARTS.findIndex((s, i) => time >= s && time < s + SCENES[i].seconds))];

  return (
    <div className="film">
      <div
        className="film-frame"
        role="group"
        aria-label="How it plays: a three and a half minute film"
        tabIndex={0}
        onKeyDown={onKey}
      >
        <canvas ref={canvas} className="film-canvas" aria-hidden="true" />

        {!playing && !ended && (
          <button type="button" className="film-play" onClick={toggle}>
            <span className="film-play-mark" aria-hidden="true">
              ▶
            </span>
            <span>
              {time > 0 ? 'Keep watching' : 'How it plays'}
              <span className="film-length">{clock(DURATION)} · no sound</span>
            </span>
          </button>
        )}

        {ended && (
          <div className="film-end">
            <p>That is the whole game.</p>
            <div className="film-end-actions">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  seek(0);
                  setPlaying(true);
                }}
              >
                Watch again
              </button>
            </div>
          </div>
        )}

        {/* Real text, not pixels: readable, selectable, and announced. */}
        <p className={`film-caption${caption ? '' : ' film-caption-empty'}`} aria-live="polite">
          {caption?.text ?? ''}
        </p>
      </div>

      <div className="film-bar">
        <button
          type="button"
          className="film-button"
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="film-time">{clock(time)}</span>
        <label className="film-scrub">
          <span className="visually-hidden">Scrub through the film</span>
          <input
            type="range"
            min={0}
            max={Math.round(DURATION)}
            step={0.5}
            value={time}
            onChange={(event) => seek(Number(event.target.value))}
          />
        </label>
        <span className="film-time film-time-total">{clock(DURATION)}</span>
        <span className="film-chapter">{chapter?.title}</span>
        <button type="button" className="film-button film-script-toggle" onClick={() => setScript((on) => !on)}>
          {script ? 'Hide text' : 'Read it instead'}
        </button>
      </div>

      {(script || still) && (
        <ol className="film-script">
          {CAPTIONS.map((cue) => (
            <li key={`${cue.from}`}>
              <button type="button" className="link" onClick={() => seek(cue.from + 0.1)}>
                {clock(cue.from)}
              </button>
              <span>{cue.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
