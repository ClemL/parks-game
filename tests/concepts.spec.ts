import { expect, test, type Page } from '@playwright/test';

/**
 * The redesign concepts at #/concepts: each one plays the same running game
 * through its own layout, and the switcher moves between them mid-game.
 */

/** A move can open a decision; take its first choice so the switcher is in reach again. */
async function answerAnyDecision(page: Page) {
  await page.waitForTimeout(300);
  for (let i = 0; i < 6 && (await page.locator('.modal').count()); i++) {
    await page.locator('.modal .choice:not([disabled])').first().click();
    await page.waitForTimeout(300);
  }
  await expect(page.locator('.modal')).toHaveCount(0);
}

test('plays a move in each concept and keeps one game across the switch', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/#/concepts/tabletop');
  await expect(page.locator('.cx-bar')).toBeVisible();
  await expect(page.locator('.tt-trail .tt-stop')).not.toHaveCount(0);

  // Tabletop: walk a hiker off the trailhead by its tile.
  await page.locator('.tt-target .tt-tile').first().click();
  await expect(page.locator('.tt-stop:not(.tt-start) .tt-pawn[aria-label="You\'s hiker"]')).toHaveCount(1);
  await answerAnyDecision(page);

  // Field Guide: the same game, now as a list of moves with what each pays.
  await page.getByRole('tab', { name: 'B · Field Guide' }).click();
  await expect(page.locator('.fg-route .fg-stop')).not.toHaveCount(0);
  const heading = page.locator('.fg-move-head h2');
  await expect(heading).toHaveText('Where should this hiker go?', { timeout: 15_000 });
  await page.locator('.fg-option .fg-go').first().click();
  // The move either opens a decision or hands the turn to the CPUs.
  await expect(heading).not.toHaveText('Where should this hiker go?');
  await answerAnyDecision(page);

  // The current board shows both moves too.
  await page.getByRole('tab', { name: 'Current' }).click();
  await expect(page.locator('.trail .site')).not.toHaveCount(0);
  expect(await page.locator('.site:not(.site-start) .hiker', { hasText: '🚶' }).count()).toBeGreaterThanOrEqual(1);

  await page.locator('.cx-notes-toggle').click();
  await expect(page.locator('.cx-notes')).toBeVisible();

  expect(errors).toEqual([]);
});

test('leaves the board at the root address untouched', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.trail .site')).not.toHaveCount(0);
  await expect(page.locator('.cx-bar')).toHaveCount(0);
});
