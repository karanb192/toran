import { test, expect } from '@playwright/test';

const WEATHER = 'https://api.open-meteo.com/**';
const wind = (speed = 18) => ({ current: { wind_speed_10m: speed, wind_direction_10m: 90 } });
let errors;

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(WEATHER, (route) => route.fulfill({ json: wind() }));
  // Inspect the actual scene without exposing test state in the shipped application.
  await page.route('**/src/main.js', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()) + '\nglobalThis.__scene = { S, ptr };' });
  });
});

test.afterEach(() => expect(errors).toEqual([]));

test('reduced motion keeps instructions and style captions visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#caption')).toContainText('Brush the toran');
  await page.waitForTimeout(100);
  await expect(page.locator('#caption')).toHaveCSS('opacity', '1');
  await page.locator('a[href="#aam"]').click();
  await expect(page.locator('#caption')).not.toContainText('Brush the toran');
  await page.waitForTimeout(100);
  await expect(page.locator('#caption')).toHaveCSS('opacity', '1');
});

for (const firstLift of ['owner', 'other']) {
  test(`two fingers release cleanly when ${firstLift} lifts first`, async ({ page, context }) => {
    await page.goto('/');
    await page.waitForFunction(() => globalThis.__scene);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    const [first, second] = await page.evaluate(() => {
      const bells = globalThis.__scene.S.T.bells;
      return [bells[1].p, bells[bells.length - 2].p].map((p, i) => ({ x: p.x, y: p.y, id: i + 1 }));
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
    expect(await page.evaluate(() => globalThis.__scene.S.T.world.points.filter((p) => p.grabbed).length)).toBe(1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [firstLift === 'owner' ? first : second] });
    expect(await page.evaluate(() => globalThis.__scene.ptr.down)).toBe(firstLift !== 'owner');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(await page.evaluate(() => globalThis.__scene.S.T.world.points.filter((p) => p.grabbed).length)).toBe(0);
    expect(await page.evaluate(() => globalThis.__scene.ptr.grab)).toBeNull();
  });
}

test('cancelled touch releases the point without opening a story', async ({ page, context }) => {
  await page.clock.install();
  await page.goto('/');
  await page.waitForFunction(() => globalThis.__scene);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const first = await page.evaluate(() => {
    const leaf = globalThis.__scene.S.T.leaves[3];
    return { x: (leaf.pin.x + leaf.tip.x) / 2, y: (leaf.pin.y + leaf.tip.y) / 2, id: 1 };
  });
  const caption = await page.locator('#caption').textContent();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect(await page.evaluate(() => globalThis.__scene.S.T.world.points.filter((p) => p.grabbed).length)).toBe(0);
  await expect(page.locator('#caption')).toHaveText(caption);
});

test('denied storage does not prevent drawing or changing styles', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      get() { throw new DOMException('Storage denied', 'SecurityError'); },
    });
  });
  await page.goto('/');
  await expect(page.locator('#caption')).toContainText('Brush the toran');
  await expect(page.locator('#windText')).toContainText('Wind in Delhi');
  for (const variant of ['aam', 'moti', 'genda']) {
    await page.locator(`a[href="#${variant}"]`).click();
    await expect(page.locator(`a[href="#${variant}"]`)).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => page.locator('canvas').evaluate((c) => c.getContext('2d').getImageData(100, 100, 1, 1).data[3])).toBe(255);
  }
});

test('lost pointer capture releases a dragged point', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => globalThis.__scene);
  const point = await page.evaluate(() => {
    const p = globalThis.__scene.S.T.bells[1].p;
    return { x: p.x, y: p.y };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 40, point.y + 40);
  expect(await page.evaluate(() => globalThis.__scene.ptr.grab !== null)).toBe(true);
  await page.locator('canvas').evaluate((c) => c.releasePointerCapture(globalThis.__scene.ptr.id));
  await page.mouse.move(point.x + 50, point.y + 50);
  await expect.poll(() => page.evaluate(() => globalThis.__scene.ptr.down)).toBe(false);
  expect(await page.evaluate(() => globalThis.__scene.S.T.world.points.filter((p) => p.grabbed).length)).toBe(0);
  await page.mouse.up();
});

test('a delayed city response cannot overwrite a newer selection', async ({ page }) => {
  let pending;
  await page.route(WEATHER, (route) => {
    if (route.request().url().includes('latitude=19.08')) pending = route;
    else return route.fulfill({ json: wind(28) });
  });
  await page.goto('/');
  await expect(page.locator('#windText')).toContainText('Delhi');
  await page.locator('#city').selectOption('mumbai');
  await expect.poll(() => !!pending).toBe(true);
  await page.locator('#city').selectOption('london');
  await expect(page.locator('#windText')).toContainText('Wind in London');
  const response = page.waitForResponse((r) => r.url().includes('latitude=19.08'));
  await pending.fulfill({ json: wind(3) });
  await (await response).finished();
  await page.waitForTimeout(100);
  await expect(page.locator('#city')).toHaveValue('london');
  await expect(page.locator('#windText')).toHaveText('Wind in London, 28 km/h from the east');
});

for (const outcome of ['success', 'error']) {
  test(`a late location ${outcome} cannot replace the selected city`, async ({ page }) => {
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (success, error) => {
        globalThis.locationCallbacks = { success, error };
      };
    });
    await page.goto('/');
    await expect(page.locator('#windText')).toContainText('Delhi');
    await page.locator('#city').selectOption('here');
    await page.locator('#city').selectOption('london');
    await expect(page.locator('#windText')).toContainText('Wind in London');
    await page.evaluate((result) => {
      globalThis.locationCallbacks[result]({ coords: { latitude: 48.86, longitude: 2.35 } });
    }, outcome);
    await page.waitForTimeout(100);
    await expect(page.locator('#windText')).toContainText('Wind in London');
  });
}

test('location wind refreshes after cache expiry and survives a failed refresh', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 48.86, longitude: 2.35 });
  let requests = 0;
  await page.route(WEATHER, (route) => {
    if (route.request().url().includes('latitude=48.86')) {
      requests++;
      if (requests > 2) return route.fulfill({ status: 429, json: {} });
      return route.fulfill({ json: wind(requests === 1 ? 14 : 22) });
    }
    return route.fulfill({ json: wind() });
  });
  await page.clock.install();
  await page.goto('/');
  await page.locator('#city').selectOption('here');
  await expect(page.locator('#windText')).toContainText('your area, 14 km/h');
  await page.clock.fastForward(31 * 60 * 1000);
  await expect.poll(() => requests).toBe(2);
  await expect(page.locator('#windText')).toContainText('your area, 22 km/h');
  await page.clock.fastForward(31 * 60 * 1000);
  await expect.poll(() => requests).toBe(3);
  await expect(page.locator('#windText')).toContainText('your area, 22 km/h');
});
