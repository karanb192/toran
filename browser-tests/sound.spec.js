import { test, expect } from '@playwright/test';

test.use({ launchOptions: { args: ['--autoplay-policy=user-gesture-required'] } });

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({
    json: { current: { wind_speed_10m: 18, wind_direction_10m: 90 } },
  }));
  await page.route('**/src/main.js', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()) + '\nglobalThis.__bells = bells;' });
  });
});

async function expectPlaying(page) {
  await expect.poll(() => page.evaluate(() => globalThis.__bells.ctx?.state)).toBe('running');
  expect(await page.evaluate(() => globalThis.__bells.on)).toBe(true);
}

test('first visits stay muted even after interacting with the garland', async ({ page }) => {
  await page.goto('/');
  await page.locator('canvas').click({ position: { x: 100, y: 200 } });
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => globalThis.__bells.ctx)).toBeNull();
});

for (const hard of [false, true]) {
  test(`sound on and off survive a ${hard ? 'cache-bypassing' : 'normal'} reload`, async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    const reload = async () => {
      if (!hard) return page.reload();
      await Promise.all([
        page.waitForEvent('load'),
        cdp.send('Page.reload', { ignoreCache: true }),
      ]);
    };
    await page.goto('/');
    await page.locator('#sound').click();
    await expectPlaying(page);
    await reload();
    await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#caption')).toHaveText('Tap or click to resume the bells.');
    expect(await page.evaluate(() => globalThis.__bells.ctx)).toBeNull();
    await page.locator('canvas').click({ position: { x: 100, y: 200 } });
    await expectPlaying(page);
    await page.locator('#sound').click();
    await reload();
    await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('canvas').click({ position: { x: 100, y: 200 } });
    expect(await page.evaluate(() => globalThis.__bells.ctx)).toBeNull();
  });
}

test('a restored on setting can be muted before any audio starts', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('toran:sound', 'on'));
  await page.goto('/');
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('toran:sound'))).toBe('off');
  expect(await page.evaluate(() => globalThis.__bells.ctx)).toBeNull();
});

test.describe('phone touch', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('a tap resumes the remembered sound', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('toran:sound', 'on'));
    await page.goto('/');
    await page.touchscreen.tap(100, 200);
    await expectPlaying(page);
  });
});

test('a key press resumes remembered sound', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('toran:sound', 'on'));
  await page.goto('/');
  await page.keyboard.press('Enter');
  await expectPlaying(page);
});

for (const blocked of ['getter', 'read', 'write']) {
  test(`sound still toggles when the storage ${blocked} throws`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((operation) => {
      const fail = () => { throw new DOMException('Storage denied', 'SecurityError'); };
      if (operation === 'getter') Object.defineProperty(globalThis, 'localStorage', { get: fail });
      else Storage.prototype[operation === 'read' ? 'getItem' : 'setItem'] = fail;
    }, blocked);
    await page.goto('/');
    await page.locator('#sound').click();
    await expectPlaying(page);
    await page.locator('#sound').click();
    await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => page.evaluate(() => globalThis.__bells.ctx.state)).toBe('suspended');
    expect(errors).toEqual([]);
  });
}

test('a pending audio resume cannot undo a later mute', async ({ page }) => {
  await page.addInitScript(() => {
    const resume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = function () {
      return new Promise((resolve, reject) => {
        globalThis.finishAudioResume = () => resume.call(this).then(resolve, reject);
      });
    };
  });
  await page.goto('/');
  await page.locator('#sound').click();
  await page.locator('#sound').click();
  await page.evaluate(() => globalThis.finishAudioResume());
  await expect.poll(() => page.evaluate(() => globalThis.__bells.on)).toBe(false);
  await expect.poll(() => page.evaluate(() => globalThis.__bells.ctx.state)).toBe('suspended');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('toran:sound'))).toBe('off');
});

test('audio failures show a retry message without an unhandled error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    AudioContext.prototype.resume = () => Promise.reject(new Error('Audio unavailable'));
  });
  await page.goto('/');
  await page.locator('#sound').click();
  await expect(page.locator('#caption')).toContainText('Sound could not start');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});
