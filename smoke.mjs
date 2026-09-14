import { chromium } from 'playwright';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto('http://localhost:4176/', { waitUntil: 'networkidle' });
await page.waitForSelector('.trail .site');
const shot = (n) => page.screenshot({ path: `${process.env.SCRATCH}/${n}.png` });

console.log('season 1 sites:', await page.locator('.trail .site').count());
console.log('park row cards:', await page.locator('.panel .card-strip .park-card').count());
await shot('r3-initial');

const seen = new Map();
let clicks = 0;
for (let i = 0; i < 2500; i++) {
  if (await page.locator('.scores').count()) break;
  const seasonBtn = page.locator('.modal button.primary', { hasText: 'Begin season' });
  if (await seasonBtn.count()) { await seasonBtn.first().click(); continue; }
  const modal = page.locator('.modal');
  if (await modal.count()) {
    const title = (await modal.locator('.modal-head h2').innerText()).split('—')[0].trim();
    if (!seen.has(title)) { seen.set(title, 1); await shot(`r3-${seen.size}-${title.toLowerCase().replace(/[^a-z]+/g,'-')}`); }
    else seen.set(title, seen.get(title) + 1);
    const park = modal.locator('.park-card.clickable');
    const gear = modal.locator('.gear-card.clickable');
    const choice = modal.locator('.choice:not([disabled])');
    try {
      const pick = clicks % 4;
      if (pick === 0 && await park.count()) await park.first().click({ timeout: 3000 });
      else if (pick === 1 && await gear.count()) await gear.first().click({ timeout: 3000 });
      else if (await choice.count()) await choice.first().click({ timeout: 3000 });
      else if (await park.count()) await park.first().click({ timeout: 3000 });
      else { console.log('stuck modal:', title); break; }
    } catch (e) { console.log('modal click failed:', title, String(e).slice(0, 60)); break; }
    continue;
  }
  const bottle = page.locator('aside .player:first-child button.bottle-ready:not([disabled])');
  if (await bottle.count()) { try { await bottle.first().click({ timeout: 1500 }); continue; } catch {} }
  const target = page.locator('.site-target .site-hit:not([disabled])');
  if (await target.count()) { try { await target.first().click({ timeout: 2000 }); clicks++; continue; } catch {} }
  await page.waitForTimeout(80);
}
console.log('moves:', clicks);
console.log('modals seen:', [...seen.entries()].map(([k, v]) => `${k} x${v}`).join(' | '));
const done = await page.locator('.scores').count();
console.log('finished:', done > 0);
if (done) { console.log((await page.locator('.scores').innerText()).replace(/\n+/g, ' | ')); await shot('r3-scores'); }
await page.locator('.modal button.primary', { hasText: 'New game' }).click();
await page.locator('button.ghost', { hasText: 'Rules' }).click();
await page.waitForSelector('.rules-table');
await shot('r3-rules');
await page.locator('.modal-head button.ghost').click();
await page.setViewportSize({ width: 400, height: 860 });
await page.waitForTimeout(250);
console.log('mobile scrollWidth:', await page.evaluate(() => document.documentElement.scrollWidth));
console.log('console errors:', errors.length ? errors.slice(0, 4) : 'none');
await browser.close();
