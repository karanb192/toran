import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({
    json: { current: { wind_speed_10m: 18, wind_direction_10m: 90 } },
  }));
});

test('the first-visit hint pulses twice, ends, and does not repeat on reload', async ({ page }) => {
  await page.goto('/');
  const speaker = page.locator('#sound');
  await expect(speaker).toHaveClass(/sound-hint/);
  await expect(speaker).toHaveCSS('animation-name', 'sound-hint');
  await expect(speaker).toHaveCSS('animation-duration', '1.5s');
  await expect(speaker).toHaveCSS('animation-iteration-count', '2');
  await expect(speaker).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('toran:sound'))).toBeNull();
  await expect(speaker).not.toHaveClass(/sound-hint/, { timeout: 4500 });
  await page.reload();
  await expect(speaker).not.toHaveClass(/sound-hint/);
  await expect(speaker).toHaveCSS('animation-name', 'none');
});

test('enabling sound stops the hint immediately and muting does not restart it', async ({ page }) => {
  await page.goto('/');
  const speaker = page.locator('#sound');
  await expect(speaker).toHaveClass(/sound-hint/);
  await speaker.click({ force: true });
  await expect(speaker).toHaveAttribute('aria-pressed', 'true');
  await expect(speaker).not.toHaveClass(/sound-hint/);
  await speaker.click();
  await expect(speaker).toHaveAttribute('aria-pressed', 'false');
  await expect(speaker).not.toHaveClass(/sound-hint/);
});

for (const choice of ['on', 'off']) {
  test(`a saved ${choice} choice suppresses the hint`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('toran:sound', value), choice);
    await page.goto('/');
    await expect(page.locator('#sound')).not.toHaveClass(/sound-hint/);
    await expect(page.locator('#sound')).toHaveCSS('animation-name', 'none');
  });
}

test('reduced motion skips the hint', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#sound')).not.toHaveClass(/sound-hint/);
  await expect(page.locator('#sound')).toHaveCSS('animation-name', 'none');
});

for (const blocked of ['getter', 'read', 'write']) {
  test(`a blocked storage ${blocked} skips the hint without breaking the page`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((operation) => {
      const fail = () => { throw new DOMException('Storage denied', 'SecurityError'); };
      if (operation === 'getter') Object.defineProperty(globalThis, 'localStorage', { get: fail });
      else Storage.prototype[operation === 'read' ? 'getItem' : 'setItem'] = fail;
    }, blocked);
    await page.goto('/');
    await expect(page.locator('#sound')).not.toHaveClass(/sound-hint/);
    await expect(page.locator('#caption')).toContainText('Brush the toran');
    expect(errors).toEqual([]);
  });
}

test('preview-image mode does not consume the first-visit hint', async ({ page }) => {
  await page.goto('/?og');
  expect(await page.evaluate(() => localStorage.getItem('toran:sound-hint'))).toBeNull();
  await page.goto('/');
  await expect(page.locator('#sound')).toHaveClass(/sound-hint/);
});
