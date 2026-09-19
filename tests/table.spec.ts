import { expect, test, type Page } from '@playwright/test';

/**
 * Table mode end to end: a tablet deals the table and hands out a QR code per
 * seat, phones claim their seats, and the two surfaces stay in step through the
 * polling API. The local server runs the same route handlers the deployed
 * functions run, against the in-process store.
 */

/** Opens a table with `seats` chairs and returns the per-seat join links. */
async function openTable(page: Page, seats: number): Promise<string[]> {
  await page.goto('/#/table');
  await page.locator('label', { hasText: 'Seats' }).locator('select').selectOption(String(seats));
  await page.getByRole('button', { name: 'Open the table' }).click();
  await expect(page.locator('.seat-card')).toHaveCount(seats);
  return page.locator('.seat-link').evaluateAll((links) => links.map((l) => (l as HTMLAnchorElement).href));
}

test('deals a table with one QR code per seat, each hidable', async ({ page }) => {
  const links = await openTable(page, 4);
  expect(links).toHaveLength(4);
  // Every seat gets its own secret, and the links point at hand mode.
  expect(new Set(links).size).toBe(4);
  for (const link of links) expect(link).toMatch(/#\/hand\?t=[A-HJ-NP-Z2-9]{5}&s=\d&k=[0-9a-f]{32}$/);

  // A real code is drawn, not an image fetched from somewhere.
  const drawn = await page.locator('.seat-qr').first().evaluate((canvas) => {
    const context = (canvas as HTMLCanvasElement).getContext('2d')!;
    const pixels = context.getImageData(0, 0, (canvas as HTMLCanvasElement).width, 20).data;
    return pixels.some((value, i) => i % 4 === 0 && value < 128);
  });
  expect(drawn).toBe(true);

  // And each one hides on demand, so a seat's code is not on show all game.
  await page.locator('.seat-card').first().getByRole('button', { name: /Hide/ }).click();
  await expect(page.locator('.seat-qr')).toHaveCount(3);
  await page.locator('.seat-card').first().getByRole('button', { name: /Show code/ }).click();
  await expect(page.locator('.seat-qr')).toHaveCount(4);
});

test('fills the seats nobody took with CPUs, and plays their turns', async ({ page, browser }) => {
  const links = await openTable(page, 4);

  // One phone claims seat 2; the other three chairs stay empty.
  const phone = await browser.newPage();
  await phone.goto(links[2]);
  await phone.locator('.hand-name input').fill('Kris');
  await phone.getByRole('button', { name: 'Take this seat' }).click();
  await expect(phone.locator('.hand-wait')).toBeVisible();

  // The table notices without being reloaded.
  await expect(page.locator('.seat-card.seat-taken')).toHaveCount(1);
  await expect(page.locator('.seat-state-human')).toHaveText('✓ Kris');

  await page.getByRole('button', { name: 'Start the game' }).click();
  await expect(page.locator('.trail .site').first()).toBeVisible();

  // Seats 0 and 1 are CPUs, so they have already played by the time the board
  // appears, and the table is waiting on the human seat.
  await expect(page.locator('.table-turn')).toContainText('Kris');
  const log = await page.locator('.log li').count();
  expect(log).toBeGreaterThan(0);

  // The phone knows it is on the clock.
  await expect(phone.locator('.hand-turn-mine')).toContainText('Your turn');
  await phone.close();
});

test('moves a hiker by dragging it across the table', async ({ page, browser }) => {
  const links = await openTable(page, 2);
  const phone = await browser.newPage();
  await phone.goto(links[0]);
  await phone.locator('.hand-name input').fill('Clem');
  await phone.getByRole('button', { name: 'Take this seat' }).click();
  await page.getByRole('button', { name: 'Start the game' }).click();
  await expect(page.locator('.trail .site').first()).toBeVisible();
  await expect(page.locator('.table-turn')).toContainText('drag a hiker');

  const pawn = page.locator('.site-start .hiker-selectable').first();
  // A plain resource site takes the hiker without opening a decision.
  const target = page.locator(
    '.site-target:not(.site-camera):not(.site-tent):not([class*="site-adv"])',
  ).first();
  const from = (await pawn.boundingBox())!;
  const to = (await target.boundingBox())!;

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  // The card under the pointer says it will take the drop.
  await expect(page.locator('.site-drop')).toHaveCount(1);
  await page.mouse.up();

  // The board moved — and the CPU seat has already answered, which is why the
  // newest line is not necessarily ours.
  await expect(page.locator('.log')).toContainText('Clem');
  // The phone picks the same move up on its next poll: the site paid it, so its
  // pack is no longer empty.
  await expect(phone.locator('.kit')).toContainText(/[1-9]\/12/, { timeout: 15000 });
  await phone.close();
});

test('puts the decision on the phone and says so on the table', async ({ page, browser }) => {
  const links = await openTable(page, 2);
  const phone = await browser.newPage();
  await phone.goto(links[0]);
  await phone.locator('.hand-name input').fill('Clem');
  await phone.getByRole('button', { name: 'Take this seat' }).click();
  await page.getByRole('button', { name: 'Start the game' }).click();
  await expect(phone.locator('.hand-turn-mine')).toBeVisible();

  // Walk to the Camera Point from the phone: it always opens a decision.
  const camera = phone.locator('.site-target.site-camera .site-hit');
  if ((await camera.count()) === 0) test.skip(true, 'no camera site reachable on this trail');
  await camera.first().click();

  // The phone owns the decision; the table only says who is deciding.
  await expect(phone.locator('.modal')).toBeVisible();
  await expect(page.locator('.modal')).toHaveCount(0);
  await expect(page.locator('.table-turn')).toContainText('is deciding');
  await expect(page.locator('.table-turn')).toContainText('Camera Point');

  // Answering on the phone unblocks the table. The last option of any of these
  // prompts is the one that declines and ends the stop, and a camera site can
  // stack a tent prompt in front of its own, so take up to three.
  for (let round = 0; round < 3 && (await phone.locator('.modal .choice').count()) > 0; round++) {
    await phone.locator('.modal .choice').last().click();
    await phone.waitForTimeout(400);
  }
  await expect(phone.locator('.modal')).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator('.table-turn')).not.toContainText('is deciding', { timeout: 15000 });
  await phone.close();
});

test('keeps each hand secret from the table and from the other seats', async ({ page, browser }) => {
  const links = await openTable(page, 3);
  const phones = [];
  for (const seat of [0, 1]) {
    const phone = await browser.newPage();
    await phone.goto(links[seat]);
    await phone.locator('.hand-name input').fill(`P${seat}`);
    await phone.getByRole('button', { name: 'Take this seat' }).click();
    phones.push(phone);
  }
  await page.getByRole('button', { name: 'Start the game' }).click();
  await expect(page.locator('.trail .site').first()).toBeVisible();

  // Your own bonus cards are readable on your own phone.
  const mine = phones[0].locator('.player').first();
  await expect(mine.locator('.bonus').first()).toBeVisible();
  const ownBonus = await mine.locator('.bonus').first().innerText();
  expect(ownBonus.length).toBeGreaterThan(3);

  // Not on the table, which shows every hand face down.
  await expect(page.locator('.bonus')).toHaveCount(0);
  expect(await page.locator('.bonus-hidden').count()).toBeGreaterThan(0);

  // And not in the state the other seat was sent, either.
  const leaked = await phones[1].evaluate(async () => {
    const responses: string[] = [];
    const original = window.fetch;
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (String(args[0]).includes('/api/state')) responses.push(await response.clone().text());
      return response;
    };
    await new Promise((resolve) => setTimeout(resolve, 4000));
    window.fetch = original;
    return responses.join('');
  });
  // The wire carries this seat's own cards and nothing but "hidden" for others.
  expect(leaked).toContain('hidden');
  expect(leaked).not.toContain('"parkDeck":[{');
  expect(leaked).not.toMatch(/"rng":[1-9]/);

  for (const phone of phones) await phone.close();
});

test('offers table mode only where a table can actually run', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');

  // The dev server carries the routes, so the button is there.
  await expect(page.getByRole('button', { name: 'Table mode' })).toBeVisible();
  await expect(page.locator('.topbar')).toContainText('Table mode');

  // With the routes gone — a static host, or a deployment with no store — the
  // app drops multiplayer instead of failing at it.
  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ multiplayer: false, error: 'Table mode is switched off on this deployment.' }),
    }),
  );
  await page.reload();
  await page.waitForSelector('.trail .site');
  await expect(page.getByRole('button', { name: 'Table mode' })).toHaveCount(0);

  // And reaching the surface by its link explains itself rather than erroring.
  await page.goto('/#/table');
  await expect(page.locator('.table-setup')).toContainText('off here');
  await page.getByRole('button', { name: 'Play on this device' }).click();
  await expect(page.locator('.trail .site').first()).toBeVisible();
});

test('seats a desktop the same as a phone, with room for the board beside it', async ({
  page,
  browser,
}) => {
  const links = await openTable(page, 4);

  // The same seat link, opened on a wide screen.
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await desktop.goto(links[0]);
  await desktop.locator('.hand-name input').fill('Clem');
  await desktop.getByRole('button', { name: 'Take this seat' }).click();

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(links[1]);
  await phone.locator('.hand-name input').fill('Kris');
  await phone.getByRole('button', { name: 'Take this seat' }).click();

  await page.getByRole('button', { name: 'Start the game' }).click();
  await expect(desktop.locator('.hand-board .site').first()).toBeVisible({ timeout: 15000 });

  // Desktop: the shared board sits beside the hand, not under it, and the park
  // row and gear shop are open — there is room, so nothing needs hunting for.
  const wide = await desktop.evaluate(() => {
    const board = document.querySelector('.hand-board')!.getBoundingClientRect();
    const hand = document.querySelector('.hand-private')!.getBoundingClientRect();
    return { beside: board.right <= hand.left + 1, boardWidth: Math.round(board.width) };
  });
  expect(wide.beside).toBe(true);
  expect(wide.boardWidth).toBeGreaterThan(500);
  expect(await desktop.locator('.hand-board .park-card').count()).toBeGreaterThan(0);
  expect(await desktop.locator('.hand-board .gear-card').count()).toBeGreaterThan(0);

  // Phone: one column, and the offer folded away so the hand leads.
  await expect(phone.locator('.hand-board')).toBeVisible({ timeout: 15000 });
  const narrow = await phone.evaluate(() => {
    const board = document.querySelector('.hand-board')!.getBoundingClientRect();
    const hand = document.querySelector('.hand-private')!.getBoundingClientRect();
    return { stacked: hand.top >= board.bottom - 1, wide: document.documentElement.scrollWidth };
  });
  expect(narrow.stacked).toBe(true);
  expect(narrow.wide).toBeLessThanOrEqual(390);
  await expect(phone.locator('.hand-board .park-card')).toHaveCount(0);

  // Both seats read their own bonus cards and nobody else's; the table reads
  // none at all, which is what makes it safe to leave face up in the middle.
  for (const seat of [desktop, phone]) {
    expect(await seat.locator('.hand-private .bonus').count()).toBeGreaterThan(0);
  }
  await expect(page.locator('.bonus')).toHaveCount(0);
  expect(await page.locator('.bonus-hidden').count()).toBeGreaterThan(0);

  await desktop.close();
  await phone.close();
});
