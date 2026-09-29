import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windForce, compass, cityForTimeZone, windLabel, fetchWind } from '../src/wind.js';

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
  assert.match(windLabel('Delhi', null), /light breeze/);
});

test('fetchWind reads Open-Meteo current values', async () => {
  const fake = async (url) => {
    assert.match(url, /latitude=28\.61&longitude=77\.21&current=wind_speed_10m,wind_direction_10m/);
    return { ok: true, json: async () => ({ current: { wind_speed_10m: 12, wind_direction_10m: 200 } }) };
  };
  assert.deepEqual(await fetchWind(28.61, 77.21, fake), { speed: 12, dir: 200 });
});
