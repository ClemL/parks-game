import { expect, test } from '@playwright/test';

/**
 * End-to-end cover for the flows unit tests cannot reach: the decision modals,
 * the expansion toggles, undo, and resuming a saved game. The bot plays the
 * human seat by clicking whatever the board offers.
 */

test('plays a full game through every decision modal', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.waitForSelector('.trail .site');

  // The board is dealt: trail, park row, campsites, bison, season card.
  await expect(page.locator('.season-card')).toBeVisible();
  await expect(page.locator('.campsite')).toHaveCount(3);
  await expect(page.locator('.park-bison')).toHaveCount(1);
  expect(await page.locator('.site-tent').count()).toBeGreaterThan(0);

  const modalsSeen = new Set<string>();
  let clicks = 0;

  for (let step = 0; step < 4000; step++) {
    if (await page.locator('.scores').count()) break;

    const nextSeason = page.locator('.modal button.primary', { hasText: 'Begin season' });
    if (await nextSeason.count()) {
      await nextSeason.first().click();
      continue;
    }

    const modal = page.locator('.modal');
    if (await modal.count()) {
      modalsSeen.add((await modal.locator('.modal-head h2').innerText()).split('—')[0].trim());
      const parks = modal.locator('.park-card.clickable');
      const gear = modal.locator('.gear-card.clickable');
      const choices = modal.locator('.choice:not([disabled])');
      // Rotate through the option types so no branch goes unexercised.
      const pick = clicks % 4;
      if (pick === 0 && (await parks.count())) await parks.first().click({ timeout: 5000 });
      else if (pick === 1 && (await gear.count())) await gear.first().click({ timeout: 5000 });
      else if ((await choices.count()) > 0) await choices.first().click({ timeout: 5000 });
      else if (await parks.count()) await parks.first().click({ timeout: 5000 });
      else throw new Error(`modal with no available action: ${[...modalsSeen].join(', ')}`);
      continue;
    }

    const target = page.locator('.site-target .site-hit:not([disabled])');
    if (await target.count()) {
      try {
        await target.first().click({ timeout: 3000 });
        clicks += 1;
      } catch {
        /* the board moved on between locating and clicking */
      }
      continue;
    }
    await page.waitForTimeout(80);
  }

  // The game finished and scored everyone.
  await expect(page.locator('.scores')).toBeVisible();
  await expect(page.locator('.scores tbody tr')).toHaveCount(4);
  await expect(page.locator('.scores .winner')).toHaveCount(1);

  // The human seat met the Trail End and at least one site decision.
  expect(modalsSeen.has('Trail End')).toBe(true);
  expect(modalsSeen.size).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test('undo steps back to before the last move', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  const undo = page.locator('.topbar').getByRole('button', { name: 'Undo' });
  await expect(undo).toBeDisabled();

  // A plain resource site resolves without opening a decision.
  const plain = page.locator(
    '.site-target:not(.site-camera):not(.site-tent):not([class*="site-adv"]) .site-hit:not([disabled])',
  );
  const before = await page.locator('.log li').count();
  await plain.first().click();
  await expect(undo).toBeEnabled();
  expect(await page.locator('.log li').count()).toBeGreaterThan(before);

  await undo.click();
  await expect(page.locator('.board .turn-you')).toBeVisible();
  await expect(undo).toBeDisabled();
});

test('a decision modal can be undone from inside it', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');

  // The Camera Point always opens a decision. A tent site is not a reliable
  // choice here: its prompt is skipped when no campsite is payable, which is
  // the normal case before anyone has collected anything.
  const decision = page.locator('.site-target.site-camera .site-hit');
  if ((await decision.count()) === 0) test.skip(true, 'no camera site reachable on this trail');
  await decision.first().click();

  const modal = page.locator('.modal');
  await expect(modal).toBeVisible();
  const back = modal.getByRole('button', { name: /Undo this move/ });
  await expect(back).toBeVisible();
  await back.click();

  // The board is back to our turn with no decision pending.
  await expect(page.locator('.modal')).toHaveCount(0);
  await expect(page.locator('.board .turn-you')).toBeVisible();
});

test('resumes a saved game after a reload', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  await page.locator('.site-target .site-hit:not([disabled])').first().click();
  await page.waitForTimeout(400);
  const season = await page.locator('.season-now').innerText();

  await page.reload();
  await page.waitForSelector('.trail .site');
  await expect(page.locator('.resumed')).toBeVisible();
  expect(await page.locator('.season-now').innerText()).toBe(season);
});

test('turning both expansions off deals a base-game board', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');

  for (const box of await page.locator('.expansions input').all()) await box.uncheck();
  await page.getByRole('button', { name: 'New game' }).click();
  await page.waitForTimeout(300);

  await expect(page.locator('.site-tent')).toHaveCount(0);
  await expect(page.locator('.campsite')).toHaveCount(0);
  await expect(page.locator('.park-bison')).toHaveCount(0);
  // Season cards are base game, so they stay.
  await expect(page.locator('.season-card')).toBeVisible();
  // The base game deals three park cards, not four.
  await expect(page.locator('.panel .card-strip .park-card')).toHaveCount(3);
});

test('seats two to five players', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  await page.locator('.speed select').last().selectOption('2');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('aside .player')).toHaveCount(2);

  await page.locator('.speed select').last().selectOption('5');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('aside .player')).toHaveCount(5);
});

test('the rules panel documents the expansions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Rules' }).click();
  await page.waitForSelector('.rules-table');
  // Headings are upper-cased by CSS, so compare case-insensitively.
  const text = (await page.locator('.modal-body').innerText()).toLowerCase();
  for (const needle of ['nightfall', 'wildlife', 'season card', 'campfire', 'wildcard', 'bison']) {
    expect(text, needle).toContain(needle);
  }
  // Escape closes it and focus returns to the page.
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);
});

test('folds sections away and remembers it', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.trail .site');

  // Desktop opens with everything showing.
  await expect(page.locator('.panel-folded')).toHaveCount(0);

  const parkRow = page.locator('.panel', { hasText: 'PARK ROW' });
  const toggle = parkRow.locator('.panel-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();

  // Folded: the cards go, a one-line summary takes their place.
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(parkRow.locator('.park-card')).toHaveCount(0);
  await expect(parkRow.locator('.panel-summary')).toBeVisible();

  await page.reload();
  await page.waitForSelector('.trail .site');
  await expect(page.locator('.panel', { hasText: 'PARK ROW' }).locator('.panel-toggle')).toHaveAttribute(
    'aria-expanded',
    'false',
  );

  await page.locator('.panel', { hasText: 'PARK ROW' }).locator('.panel-toggle').click();
  await expect(page.locator('.panel', { hasText: 'PARK ROW' }).locator('.park-card').first()).toBeVisible();
});

test('closes the notices with their X and can bring hints back', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.trail .site');

  await expect(page.locator('.notice.hint')).toBeVisible();
  await page.locator('.notice.hint .notice-close').click();
  await expect(page.locator('.notice.hint')).toHaveCount(0);

  const seasonCard = page.locator('.notice.season-card');
  if (await seasonCard.count()) {
    await seasonCard.locator('.notice-close').click();
    await expect(page.locator('.notice.season-card')).toHaveCount(0);
  }

  // The dismissal sticks across a reload, with a way back.
  await page.reload();
  await page.waitForSelector('.trail .site');
  await expect(page.locator('.notice.hint')).toHaveCount(0);
  await page.locator('.hint-hidden button').click();
  await expect(page.locator('.notice.hint')).toBeVisible();
});

test('folds a player away to a one-line summary', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.trail .site');

  const opponent = page.locator('aside .player').nth(1);
  await opponent.locator('.player-toggle').click();
  await expect(opponent.locator('.player-fold-summary')).toBeVisible();
  await expect(opponent.locator('.player-row')).toHaveCount(0);
  // The resource chips stay: they are the part worth reading at a glance.
  await expect(opponent.locator('.chip').first()).toBeVisible();
});

test('opens on a phone with the reference material folded and setup behind a button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.trail .site');

  // Campsites, gear and log start folded, as do the CPU seats.
  expect(await page.locator('.panel-folded').count()).toBeGreaterThanOrEqual(3);
  expect(await page.locator('.player-toggle[aria-expanded="false"]').count()).toBeGreaterThanOrEqual(1);
  // The trail itself stays open.
  await expect(page.locator('.trail .site').first()).toBeVisible();

  // The controls hide behind Setup.
  await expect(page.locator('.setup-toggle')).toBeVisible();
  await expect(page.locator('.topbar-actions')).toBeHidden();
  await page.locator('.setup-toggle').click();
  await expect(page.locator('.topbar-actions')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
});

test('switches skins and remembers the choice', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.trail .site');

  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'trailside');

  const skin = page.locator('label', { hasText: 'Skin' }).locator('select');
  for (const theme of ['parchment', 'wpa', 'nightfall', 'contrast']) {
    await skin.selectOption(theme);
    await expect(root).toHaveAttribute('data-theme', theme);
    // Every skin has to paint its own ground and keep text on it.
    const painted = await page.evaluate(() => {
      const body = getComputedStyle(document.body).backgroundColor;
      const panel = getComputedStyle(document.querySelector('.panel')!).backgroundColor;
      return { body, panel };
    });
    expect(painted.body).not.toBe('rgba(0, 0, 0, 0)');
    expect(painted.panel).not.toBe('rgba(0, 0, 0, 0)');
  }

  await page.reload();
  await page.waitForSelector('.trail .site');
  await expect(root).toHaveAttribute('data-theme', 'contrast');
});

test('leaves no CSS variable undefined in any skin', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  // Undefined custom properties fail silently and flatten the board, so check.
  const missing = await page.evaluate(() => {
    const sheets = Array.from(document.styleSheets);
    const text = sheets
      .flatMap((sheet) => {
        try {
          return Array.from(sheet.cssRules).map((rule) => rule.cssText);
        } catch {
          return [];
        }
      })
      .join('\n');
    const defined = new Set(Array.from(text.matchAll(/(--[a-z0-9-]+):/g)).map((m) => m[1]));
    const used = new Set(Array.from(text.matchAll(/var\((--[a-z0-9-]+)/g)).map((m) => m[1]));
    return Array.from(used).filter((name) => !defined.has(name));
  });
  expect(missing).toEqual([]);
});

test('density and season tint reach the document', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.trail .site');

  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-season', '1');
  await page.locator('label', { hasText: 'Density' }).locator('select').selectOption('compact');
  await expect(root).toHaveAttribute('data-density', 'compact');

  await page.locator('label', { hasText: 'Season tint' }).locator('input').uncheck();
  await expect(root).not.toHaveAttribute('data-season', '1');
});

test('explains the board by tapping, for devices without hover', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');

  // A site you cannot move to explains itself instead of doing nothing.
  const logBefore = await page.locator('.log li').count();
  await page.locator('.site-hit-info').first().click();
  await expect(page.locator('.info-sheet')).toBeVisible();
  expect(await page.locator('.log li').count()).toBe(logBefore);
  await page.locator('.info-sheet .notice-close').click();
  await expect(page.locator('.info-sheet')).toHaveCount(0);

  // Park cards, gear, campsites and chips all carry their rules text.
  for (const selector of ['.panel .card-strip .park-card', '.gear-card.card-info', '.chip']) {
    await page.locator(selector).first().click();
    await expect(page.locator('.info-sheet')).toBeVisible();
    expect((await page.locator('.info-body').innerText()).length).toBeGreaterThan(10);
    await page.locator('.info-sheet .notice-close').click();
  }
});

test('is installable and caches itself for offline play', async ({ page }) => {
  await page.goto('/');
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel=manifest]')?.getAttribute('href');
    if (!href) return null;
    return fetch(href).then((r) => r.json());
  });
  expect(manifest?.name).toBe('Trailside Seasons');
  expect(manifest?.display).toBe('standalone');
  expect(manifest?.icons?.length).toBeGreaterThanOrEqual(2);
  const sw = await page.evaluate(() => fetch('./sw.js').then((r) => r.ok));
  expect(sw).toBe(true);
});

test('keeps the action bar in reach on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForSelector('.trail .site');

  const bar = page.locator('.action-bar');
  await expect(bar).toBeVisible();
  const box = (await bar.boundingBox())!;
  // Pinned to the bottom edge, not floating mid-page.
  expect(box.y + box.height).toBeGreaterThan(830);
  await expect(bar.getByRole('button', { name: /Undo/ })).toBeVisible();

  // Decisions slide up from the bottom rather than sitting centred.
  for (let i = 0; i < 30 && !(await page.locator('.modal').count()); i++) {
    const target = page.locator('.site-target .site-hit:not([disabled])');
    if (await target.count()) await target.first().click();
    await page.waitForTimeout(200);
  }
  if (await page.locator('.modal').count()) {
    const modal = (await page.locator('.modal').boundingBox())!;
    expect(modal.y + modal.height).toBeGreaterThan(830);
  }
});

test('lays out at phone width without sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 });
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(400);
});
