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
      // A CPU can finish the game between the check above and this one.
      if (await modal.locator('.scores').count()) break;
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
  const season = await page.locator('.season-badge').innerText();

  await page.reload();
  await page.waitForSelector('.trail .site');
  await expect(page.locator('.resumed')).toBeVisible();
  expect(await page.locator('.season-badge').innerText()).toBe(season);
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

test('closes the notices with their X, and the dismissal sticks', async ({ page }) => {
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

  // The dismissal sticks across a reload; Setup is where it comes back from.
  await page.reload();
  await page.waitForSelector('.trail .site');
  await expect(page.locator('.notice.hint')).toHaveCount(0);
  await expect(page.locator('label', { hasText: 'Turn hints' }).locator('input')).not.toBeChecked();
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
    // A var() that carries a fallback cannot flatten anything, so only bare
    // references have to resolve to a declaration. (--slot, for one, is set on
    // the element by the pawn stack.)
    const used = new Set(
      Array.from(text.matchAll(/var\((--[a-z0-9-]+)\s*([,)])/g))
        .filter((m) => m[2] === ')')
        .map((m) => m[1]),
    );
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
  const sw = await page.evaluate(() => fetch('./sw.js').then((r) => r.text()));
  expect(sw).toContain('addEventListener');
  // The table routes are live, per-seat state: a cached answer would hand a
  // phone a stale board and its poll would never see the table move again.
  expect(sw).toMatch(/pathname\.includes\('\/api\/'\)/);
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

test('summarises your kit above the board', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');

  const kit = page.locator('.kit');
  await expect(kit).toBeVisible();
  // Resources, the token count, campfires, photos, bottles and gear.
  expect(await kit.locator('.chip').count()).toBeGreaterThanOrEqual(8);
  expect(await kit.locator('.kit-bottle').count()).toBeGreaterThanOrEqual(1);
  await expect(kit.locator('.kit-gear')).toBeVisible();

  // It sits above the board rather than inside a column.
  const above = await page.evaluate(() => {
    const k = document.querySelector('.kit')!.getBoundingClientRect();
    const layout = document.querySelector('.layout')!.getBoundingClientRect();
    return k.bottom <= layout.top + 1;
  });
  expect(above).toBe(true);

  // Your own panel no longer repeats what the kit bar carries.
  const you = page.locator('aside .player').first();
  await expect(you.locator('.player-res')).toHaveCount(0);
});

test('names the season in the trail heading', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');

  await expect(page.locator('.topbar .season-badge')).toHaveCount(0);
  // One label in the heading itself, reading "Spring 1/4".
  const badge = page.locator('.panel-head .season-badge');
  await expect(badge).toHaveCount(1);
  await expect(badge).toContainText('Spring');
  await expect(badge.locator('.season-count')).toHaveText('1/4');

  const head = await page.evaluate(() => {
    const b = document.querySelector('.season-badge')!;
    const h = b.closest('.panel-head')!.querySelector('h2')!;
    return { heading: h.textContent, sameLine: Math.abs(b.getBoundingClientRect().top - h.getBoundingClientRect().top) < 14 };
  });
  expect(head.heading).toBe('The trail');
  expect(head.sameLine).toBe(true);

  // The turn label keeps its own place beside the heading.
  await expect(page.locator('.board .panel-meta .turn-pill')).toBeVisible();
});

test('clicking your turn switches the active hiker', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');

  const pill = page.locator('.board .panel-meta .turn-pill');
  await expect(pill).toHaveClass(/turn-switch/);
  const first = await pill.locator('.turn-hiker').textContent();

  const selected = () => page.locator('.hiker-selected').getAttribute('data-hiker');
  const before = await selected();
  await pill.click();
  const after = await selected();
  expect(after).not.toBe(before);
  expect(await pill.locator('.turn-hiker').textContent()).not.toBe(first);

  // And back again: two hikers cycle.
  await pill.click();
  expect(await selected()).toBe(before);
});

test('puts the turn hints switch in Setup', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.trail .site');

  const toggle = page.locator('label', { hasText: 'Turn hints' }).locator('input');
  await expect(page.locator('.notice.hint')).toBeVisible();
  await toggle.uncheck();
  await expect(page.locator('.notice.hint')).toHaveCount(0);
  // No stray restore link left behind on the board.
  await expect(page.locator('.hint-hidden')).toHaveCount(0);
  await toggle.check();
  await expect(page.locator('.notice.hint')).toBeVisible();
});

test('closes the board with the trail log', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');

  const below = await page.evaluate(() => {
    const log = document.querySelector('.log-strip')!.getBoundingClientRect();
    const players = document.querySelector('aside.players')!.getBoundingClientRect();
    const board = document.querySelector('.board')!.getBoundingClientRect();
    return { belowPlayers: log.top >= players.top, belowBoard: log.top >= board.top };
  });
  expect(below.belowPlayers).toBe(true);
  expect(below.belowBoard).toBe(true);
  await expect(page.locator('.log-strip .log')).toBeVisible();
});

test('stands the hikers on the cards in compact density', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.trail .site');

  const trailHeight = () =>
    page.evaluate(() => Math.round(document.querySelector('.trail')!.getBoundingClientRect().height));
  const comfortable = await trailHeight();

  await page.locator('label', { hasText: 'Density' }).locator('select').selectOption('compact');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  const compact = await trailHeight();
  // Losing the pawn row under the trail is most of the saving.
  expect(compact).toBeLessThan(comfortable);

  const pawns = await page.evaluate(() => {
    const box = document.querySelector('.site-start .site-hikers')!;
    const card = document.querySelector('.site-start .site-hit')!;
    const p = box.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    return { position: getComputedStyle(box).position, onCard: p.top < c.bottom && p.bottom > c.top };
  });
  expect(pawns.position).toBe('absolute');
  expect(pawns.onCard).toBe(true);
});

test('clusters the hikers in the middle of the card, offset', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');

  const stack = await page.evaluate(() => {
    const card = document.querySelector('.site-start .site-hit')!.getBoundingClientRect();
    const name = document.querySelector('.site-start .site-name')!.getBoundingClientRect();
    const icon = document.querySelector('.site-start .site-icon')!.getBoundingClientRect();
    const pawns = Array.from(document.querySelectorAll('.site-start .hiker')).map((p) =>
      p.getBoundingClientRect(),
    );
    const middle = (box: DOMRect) => box.left + box.width / 2;
    const span = {
      left: Math.min(...pawns.map((p) => p.left)),
      right: Math.max(...pawns.map((p) => p.right)),
    };
    return {
      count: pawns.length,
      onCard: pawns.every((p) => p.top >= card.top - 1 && p.bottom <= card.bottom + 1),
      insideCard: span.left >= card.left - 1 && span.right <= card.right + 1,
      // The cluster is centred on the card, not pushed to one side.
      offCentre: Math.abs((span.left + span.right) / 2 - middle(card)),
      // And so are the card's own label and icon, still.
      nameCentred: Math.abs(middle(name) - middle(card)) < 2,
      iconCentred: Math.abs(middle(icon) - middle(card)) < 2,
      // A row, overlapping, each pawn a step further down.
      alongside: pawns.slice(0, 3).every((p, i) => i === 0 || p.left > pawns[i - 1].left),
      overlaps: pawns.slice(0, 3).every((p, i) => i === 0 || p.left < pawns[i - 1].right),
      stepped: pawns.slice(0, 3).every((p, i) => i === 0 || p.top > pawns[i - 1].top),
    };
  });
  expect(stack.count).toBeGreaterThanOrEqual(4);
  expect(stack.onCard).toBe(true);
  expect(stack.insideCard).toBe(true);
  expect(stack.offCentre).toBeLessThan(3);
  expect(stack.nameCentred).toBe(true);
  expect(stack.iconCentred).toBe(true);
  expect(stack.alongside).toBe(true);
  expect(stack.overlaps).toBe(true);
  expect(stack.stepped).toBe(true);
});

test('lets a click through a pawn to the card it stands on', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');

  // A CPU pawn overlaps the card's own button now that the stack is on the
  // card, so it must not swallow the tap.
  const blocked = await page.evaluate(() => {
    const pawn = document.querySelector<HTMLElement>('.hiker:disabled');
    if (!pawn) return null;
    return getComputedStyle(pawn).pointerEvents;
  });
  expect(blocked).toBe('none');

  // Your own hikers stay tappable, which is how you pick one.
  const mine = await page.evaluate(
    () => getComputedStyle(document.querySelector<HTMLElement>('.hiker-selectable')!).pointerEvents,
  );
  expect(mine).toBe('auto');
});

test('walks a hiker to its new site instead of teleporting it', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');

  const hiker = await page.locator('.hiker-selected').getAttribute('data-hiker');
  await page.locator('.site-target .site-hit:not([disabled])').first().click();

  // The pawn is mid-walk: a script-driven animation is running on it.
  const walking = await page.evaluate((id) => {
    const pawn = document.querySelector<HTMLElement>(`.hiker[data-hiker="${id}"]`);
    if (!pawn) return null;
    return { animations: pawn.getAnimations().length, lifted: getComputedStyle(pawn).zIndex };
  }, hiker);
  expect(walking?.animations).toBeGreaterThan(0);
  expect(walking?.lifted).toBe('6');

  // And it settles back onto the card once it arrives.
  await page.waitForTimeout(700);
  const settled = await page.evaluate((id) => {
    const pawn = document.querySelector<HTMLElement>(`.hiker[data-hiker="${id}"]`);
    return { transform: getComputedStyle(pawn!).transform, z: pawn!.style.zIndex };
  }, hiker);
  expect(settled.transform === 'none' || settled.transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
  expect(settled.z).toBe('');
});

test('shows a resource arriving on its chip', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');

  // A plain resource site pays out on arrival, with no decision in between.
  const plain = page.locator(
    '.site-target:not(.site-camera):not(.site-tent):not([class*="site-adv"]) .site-hit:not([disabled])',
  );
  if ((await plain.count()) === 0) test.skip(true, 'no plain resource site reachable');
  await plain.first().click();

  // The chip that went up carries a floating delta and a pop.
  const gained = page.locator('.kit .chip-up').first();
  await expect(gained).toBeVisible();
  const delta = gained.locator('.chip-delta');
  await expect(delta).toHaveText(/^\+\d$/);

  // It clears itself rather than staying lit.
  await expect(page.locator('.kit .chip-up')).toHaveCount(0, { timeout: 4000 });
});

test('deals cards in rather than snapping them onto the board', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.park-card');

  // Park cards, gear and the kit's own gear chips all animate on arrival, which
  // is what makes a purchase or a reservation visible.
  const dealt = await page.evaluate(() =>
    ['.park-card', '.gear-card'].map((sel) => getComputedStyle(document.querySelector(sel)!).animationName),
  );
  expect(dealt).toEqual(['card-in', 'card-in']);
});

test('lays out at phone width without sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 });
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(400);
});

test('leaves the first space out of the trailhead bare', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.trail .site');

  const tokens = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.trail .site')).map(
      (site) => site.querySelector('.site-token') !== null,
    ),
  );
  // The trailhead, the space out of it and the Trail End carry nothing; every
  // other site starts the season with a token on it.
  expect(tokens[0]).toBe(false);
  expect(tokens[1]).toBe(false);
  expect(tokens[tokens.length - 1]).toBe(false);
  expect(tokens.slice(2, -1).every(Boolean)).toBe(true);
});

test('fills a flask only from the water a stop just paid out', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.trail .site');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.trail .site');

  // Nothing has been drawn yet, so no flask is offered.
  const bottle = page.locator('.kit .kit-bottle').first();
  await expect(bottle).not.toHaveClass(/bottle-ready/);
  await bottle.click();
  await expect(page.locator('.info-sheet')).toContainText('latest stop paid out');
  await expect(page.locator('.info-sheet')).toContainText('needs freshly drawn water');
  await page.locator('.info-sheet .notice-close').click();

  // Stop somewhere that pays water and the flask can take it. A tent site asks
  // first, and its own action is the first option, so take that.
  const wet = page.locator('.site-target.site-valley .site-hit, .site-target.site-waterfall .site-hit');
  if ((await wet.count()) === 0) test.skip(true, 'no water site reachable on this trail');
  await wet.first().click();
  if (await page.locator('.modal .choice').count()) {
    await page.locator('.modal .choice').first().click();
  }
  await expect(page.locator('.kit .kit-bottle.bottle-ready').first()).toBeVisible({ timeout: 20000 });

  // Emptying it spends that water and uses the flask up for the season.
  await page.locator('.kit .kit-bottle.bottle-ready').first().click();
  await expect(page.locator('.kit .kit-bottle.bottle-used').first()).toBeVisible({ timeout: 15000 });
});
