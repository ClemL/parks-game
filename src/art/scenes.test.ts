import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EXPANSION_PARKS, PARKS } from '../game/data/parks';
import { IllustratedParkArt } from './illustrated';
import { SCENES } from './scenes';

const ALL = [...PARKS, ...EXPANSION_PARKS];

/**
 * The drawings themselves are checked by eye (park-art-preview.html); what can
 * be pinned down here is that every park has one, and that each one renders
 * to an SVG whose gradients and clips actually resolve.
 */

describe('park illustrations', () => {
  it('draws every park in the game, and nothing else', () => {
    const ids = ALL.map((p) => p.id).sort();
    expect(Object.keys(SCENES).sort()).toEqual(ids);
  });

  it('names the view each drawing is after', () => {
    for (const park of ALL) {
      const view = SCENES[park.id].view;
      expect(view.length, park.id).toBeGreaterThan(8);
    }
    // No two parks share a caption.
    expect(new Set(ALL.map((p) => SCENES[p.id].view)).size).toBe(ALL.length);
  });

  it('renders each park as a labelled SVG whose references all resolve', () => {
    for (const park of ALL) {
      const html = renderToStaticMarkup(createElement(IllustratedParkArt, { park }));
      expect(html, park.id).toMatch(/^<svg[^>]*role="img"/);
      expect(html, park.id).toContain(`aria-label="Illustration of ${park.name}`);
      expect(html, park.id).not.toMatch(/NaN|undefined/);
      // Every url(#…) a scene uses points at something it defined.
      const ids = new Set(Array.from(html.matchAll(/ id="([^"]+)"/g), (m) => m[1]));
      for (const [, ref] of html.matchAll(/url\(#([^)]+)\)/g)) expect(ids.has(ref), `${park.id} → ${ref}`).toBe(true);
    }
  });

  it('gives two drawings of the same park on one page their own ids', () => {
    const two = renderToStaticMarkup(
      createElement('div', null, createElement(IllustratedParkArt, { park: PARKS[0] }), createElement(IllustratedParkArt, { park: PARKS[0] })),
    );
    const ids = Array.from(two.matchAll(/ id="([^"]+)"/g), (m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
