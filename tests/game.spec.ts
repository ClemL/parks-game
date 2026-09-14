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
  const undo = page.getByRole('button', { name: 'Undo' });
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
  await expect(page.locator('.turn-you')).toBeVisible();
  await expect(undo).toBeDisabled();
});

test('a decision modal can be undone from inside it', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');

  // Walk onto a site that opens a decision, then back out of it.
  const decision = page.locator(
    '.site-target.site-camera .site-hit:not([disabled]), .site-target.site-tent .site-hit:not([disabled])',
  );
  if ((await decision.count()) === 0) test.skip(true, 'no decision site reachable on this trail');
  await decision.first().click();

  const modal = page.locator('.modal');
  await expect(modal).toBeVisible();
  const back = modal.getByRole('button', { name: /Undo this move/ });
  await expect(back).toBeVisible();
  await back.click();

  // The board is back to our turn with no decision pending.
  await expect(page.locator('.modal')).toHaveCount(0);
  await expect(page.locator('.turn-you')).toBeVisible();
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

test('lays out at phone width without sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 });
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(400);
});
