import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windForce, compass, cityForTimeZone, windLabel, fetchWind, createWindSource } from '../src/wind.js';

test('an east wind pushes left and a west wind pushes right', () => {
  assert.ok(windForce(20, 90).steady < 0);
  assert.ok(windForce(20, 270).steady > 0);
});

test('still air keeps a small breeze and storms are capped', () => {
  assert.ok(windForce(0, 0).gust > 0);
  assert.equal(windForce(200, 90).gust, windForce(45, 90).gust);
});

test('compass names', () => {
  assert.equal(compass(0), 'north');
  assert.equal(compass(315), 'northwest');
  assert.equal(compass(-45), 'northwest');
});

test('time zones map to a city, unknown ones fall back to Delhi', () => {
  assert.equal(cityForTimeZone('Europe/London').name, 'London');
  assert.equal(cityForTimeZone('Mars/Olympus').name, 'Delhi');
});

test('labels', () => {
  assert.equal(windLabel('Delhi', { speed: 9.9, dir: 52 }), 'Wind in Delhi, 10 km/h from the northeast');
  assert.equal(windLabel('Delhi', { speed: 0.2, dir: 0 }), 'Still air in Delhi');
  assert.equal(windLabel('Delhi', null), 'A gentle breeze');
});

test('fetchWind reads Open-Meteo current values', async () => {
  const fake = async (url) => {
    assert.match(url, /latitude=28\.61&longitude=77\.21&current=wind_speed_10m,wind_direction_10m/);
    return { ok: true, json: async () => ({ current: { wind_speed_10m: 12, wind_direction_10m: 200 } }) };
  };
  assert.deepEqual(await fetchWind(28.61, 77.21, fake), { speed: 12, dir: 200 });
});

function rig({ responses, clock = { t: 0 }, storage } = {}) {
  const calls = [];
  const store = storage || new Map();
  const fake = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  };
  const fetchImpl = async (url, opts) => {
    calls.push(url);
    const r = responses.shift();
    if (r === 'hang') {
      return new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    }
    if (r === 'down') throw new TypeError('Failed to fetch');
    if (r.status) return { ok: false, status: r.status, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ current: { wind_speed_10m: r, wind_direction_10m: 90 } }) };
  };
  const get = createWindSource({ fetchImpl, storage: fake, now: () => clock.t, timeout: 20 });
  return { get, calls, clock };
}

const MIN = 60 * 1000;

test('a place is fetched once and then served from cache for 30 minutes', async () => {
  const { get, calls, clock } = rig({ responses: [10, 14] });
  assert.deepEqual(await get(28.61, 77.21), { speed: 10, dir: 90 });
  clock.t = 29 * MIN;
  assert.deepEqual(await get(28.61, 77.21), { speed: 10, dir: 90 });
  assert.equal(calls.length, 1);
  clock.t = 31 * MIN;
  assert.deepEqual(await get(28.61, 77.21), { speed: 14, dir: 90 });
  assert.equal(calls.length, 2);
});

test('a rate limit returns the last good wind and pauses requests for 30 minutes', async () => {
  const { get, calls, clock } = rig({ responses: [10, { status: 429 }, 12] });
  await get(28.61, 77.21);
  clock.t = 31 * MIN;
  assert.deepEqual(await get(28.61, 77.21), { speed: 10, dir: 90 });
  clock.t = 45 * MIN;
  assert.deepEqual(await get(51.51, -0.13), null);
  assert.equal(calls.length, 2);
  clock.t = 62 * MIN;
  assert.deepEqual(await get(51.51, -0.13), { speed: 12, dir: 90 });
});

test('outages, bad shapes and timeouts resolve to null instead of throwing', async () => {
  const { get } = rig({ responses: ['down', 'hang', { status: 500 }] });
  assert.equal(await get(1, 2), null);
  assert.equal(await get(1, 2), null);
  assert.equal(await get(1, 2), null);
});

test('a broken storage still returns live wind', async () => {
  const get = createWindSource({
    fetchImpl: async () => ({ ok: true, json: async () => ({ current: { wind_speed_10m: 3, wind_direction_10m: 0 } }) }),
    storage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } },
  });
  assert.deepEqual(await get(1, 2), { speed: 3, dir: 0 });
});
