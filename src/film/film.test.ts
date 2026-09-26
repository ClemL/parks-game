import { describe, expect, it } from 'vitest';
import { CAPTIONS, captionAt, DURATION, SCENES, sceneAt, STARTS } from './scenes';

/**
 * The film is a timeline, and the timeline is testable even where the drawing
 * is not: every caption has to be on screen long enough to read, every scene
 * has to say something, and seeking anywhere has to land somewhere sensible.
 */
describe('the film', () => {
  it('runs for the length it claims, between two and five minutes', () => {
    const summed = SCENES.reduce((total, scene) => total + scene.seconds, 0);
    expect(DURATION).toBe(summed);
    expect(DURATION).toBeGreaterThan(120);
    expect(DURATION).toBeLessThan(300);
  });

  it('explains something in every scene', () => {
    for (const scene of SCENES) {
      expect(scene.cues.length, `${scene.id} has no captions`).toBeGreaterThan(0);
      expect(scene.title.length, `${scene.id} has no chapter name`).toBeGreaterThan(2);
      for (const cue of scene.cues) {
        expect(cue.at, `${scene.id} cue before the scene`).toBeGreaterThanOrEqual(0);
        expect(cue.at, `${scene.id} cue after the scene`).toBeLessThan(scene.seconds);
        expect(cue.text.length, `${scene.id} cue is empty`).toBeGreaterThan(8);
      }
      const order = scene.cues.map((c) => c.at);
      expect(order, `${scene.id} cues out of order`).toEqual([...order].sort((a, b) => a - b));
    }
  });

  it('leaves every caption on screen long enough to read', () => {
    for (const caption of CAPTIONS) {
      const seconds = caption.to - caption.from;
      // Roughly three words a second is a comfortable reading pace.
      const words = caption.text.split(/\s+/).length;
      expect(seconds, `"${caption.text}" is only up for ${seconds.toFixed(1)}s`).toBeGreaterThan(words / 3.4);
      expect(seconds, `"${caption.text}" hangs about for ${seconds.toFixed(1)}s`).toBeLessThan(9);
    }
  });

  it('keeps captions on screen for most of the run', () => {
    const covered = CAPTIONS.reduce((total, c) => total + (c.to - c.from), 0);
    expect(covered / DURATION).toBeGreaterThan(0.9);
  });

  it('never overlaps two captions', () => {
    const ordered = [...CAPTIONS].sort((a, b) => a.from - b.from);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i].from).toBeGreaterThanOrEqual(ordered[i - 1].to - 0.001);
    }
  });

  it('covers the rules a new player actually needs', () => {
    const script = CAPTIONS.map((c) => c.text.toLowerCase()).join(' ');
    for (const idea of [
      'two hikers',
      'season',
      'token',
      'campfire',
      'camera',
      'flask',
      'trail end',
      'gear',
      'reserve',
      'park',
      'bonus',
      'phone',
    ]) {
      expect(script, `the film never mentions ${idea}`).toContain(idea);
    }
  });

  it('lands on a scene wherever it is seeked', () => {
    for (let at = 0; at < DURATION; at += 0.37) {
      const { index, scene, t } = sceneAt(at);
      expect(scene).toBe(SCENES[index]);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(scene.seconds);
      expect(STARTS[index] + t).toBeCloseTo(at, 5);
    }
    // Past the end and before the start are both somewhere, not nowhere.
    expect(sceneAt(-5).index).toBe(0);
    expect(sceneAt(DURATION + 10).index).toBe(SCENES.length - 1);
  });

  it('shows a caption at almost any moment', () => {
    let quiet = 0;
    for (let at = 0; at < DURATION; at += 0.25) if (!captionAt(at)) quiet += 0.25;
    expect(quiet).toBeLessThan(DURATION * 0.1);
  });
});
