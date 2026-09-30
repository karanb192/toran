export const CITIES = [
  { id: 'delhi', name: 'Delhi', lat: 28.61, lon: 77.21 },
  { id: 'mumbai', name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { id: 'bengaluru', name: 'Bengaluru', lat: 12.97, lon: 77.59 },
  { id: 'chennai', name: 'Chennai', lat: 13.08, lon: 80.27 },
  { id: 'kolkata', name: 'Kolkata', lat: 22.57, lon: 88.36 },
  { id: 'ahmedabad', name: 'Ahmedabad', lat: 23.02, lon: 72.57 },
  { id: 'jaipur', name: 'Jaipur', lat: 26.91, lon: 75.79 },
  { id: 'kathmandu', name: 'Kathmandu', lat: 27.72, lon: 85.32 },
  { id: 'dhaka', name: 'Dhaka', lat: 23.81, lon: 90.41 },
  { id: 'colombo', name: 'Colombo', lat: 6.93, lon: 79.86 },
  { id: 'dubai', name: 'Dubai', lat: 25.2, lon: 55.27 },
  { id: 'almaty', name: 'Almaty', lat: 43.24, lon: 76.95 },
  { id: 'london', name: 'London', lat: 51.51, lon: -0.13 },
  { id: 'berlin', name: 'Berlin', lat: 52.52, lon: 13.4 },
  { id: 'newyork', name: 'New York', lat: 40.71, lon: -74.01 },
  { id: 'toronto', name: 'Toronto', lat: 43.65, lon: -79.38 },
  { id: 'sf', name: 'San Francisco', lat: 37.77, lon: -122.42 },
  { id: 'singapore', name: 'Singapore', lat: 1.35, lon: 103.82 },
  { id: 'tokyo', name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { id: 'sydney', name: 'Sydney', lat: -33.87, lon: 151.21 },
];

const ZONES = {
  'Asia/Kolkata': 'delhi',
  'Asia/Calcutta': 'delhi',
  'Asia/Kathmandu': 'kathmandu',
  'Asia/Dhaka': 'dhaka',
  'Asia/Colombo': 'colombo',
  'Asia/Dubai': 'dubai',
  'Asia/Almaty': 'almaty',
  'Europe/London': 'london',
  'Europe/Berlin': 'berlin',
  'America/New_York': 'newyork',
  'America/Toronto': 'toronto',
  'America/Los_Angeles': 'sf',
  'Asia/Singapore': 'singapore',
  'Asia/Tokyo': 'tokyo',
  'Australia/Sydney': 'sydney',
};

export function cityForTimeZone(tz) {
  return CITIES.find((c) => c.id === ZONES[tz]) || CITIES[0];
}

export function compass(deg) {
  const names = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// Weather direction is where the wind comes FROM, so an east wind pushes the garland left.
export function windForce(speedKmh, fromDeg) {
  const a = (Math.min(Math.max(speedKmh, 0), 45) / 30) * 900;
  const toward = -Math.sin((fromDeg * Math.PI) / 180);
  return { steady: a * 0.45 * toward, gust: a * 0.7 + 70 };
}

export function gust(t, i) {
  return Math.sin(t * 0.9 + i * 0.37) * 0.5 + Math.sin(t * 2.3 + i * 0.13) * 0.25 + Math.sin(t * 0.31 + 1.7) * 0.55;
}

export const GENTLE = { speed: 6, dir: 270 };

export function windLabel(place, w) {
  if (!w) return 'A gentle breeze';
  const speed = Math.round(w.speed);
  if (speed < 1) return `Still air in ${place}`;
  return `Wind in ${place}, ${speed} km/h from the ${compass(w.dir)}`;
}

export async function fetchWind(lat, lon, fetchImpl = fetch, signal) {
  const url =
    'https://api.open-meteo.com/v1/forecast?latitude=' +
    lat.toFixed(2) +
    '&longitude=' +
    lon.toFixed(2) +
    '&current=wind_speed_10m,wind_direction_10m';
  const r = await fetchImpl(url, { signal });
  if (!r.ok) {
    const err = new Error('wind ' + r.status);
    err.status = r.status;
    throw err;
  }
  const j = await r.json();
  const speed = j?.current?.wind_speed_10m;
  const dir = j?.current?.wind_direction_10m;
  if (!Number.isFinite(speed) || !Number.isFinite(dir)) throw new Error('wind shape');
  return { speed, dir };
}

const MIN = 60 * 1000;

// Wraps the weather API so a visitor never sees it fail. Answers come from a per-place cache,
// requests time out, and a 429 pauses every request for a while. get() resolves to a wind or
// null and never rejects; null means "no fresh wind", and the caller decides what to keep.
export function createWindSource({
  fetchImpl = (...a) => fetch(...a),
  storage = globalThis.localStorage,
  now = () => Date.now(),
  ttl = 30 * MIN,
  backoff = 30 * MIN,
  timeout = 5000,
} = {}) {
  const read = (k) => {
    try {
      return JSON.parse(storage.getItem(k));
    } catch {
      return null;
    }
  };
  const write = (k, v) => {
    try {
      storage.setItem(k, JSON.stringify(v));
    } catch {}
  };
  const PAUSE = 'toran:wind:pause';

  return async function get(lat, lon) {
    const key = `toran:wind:${lat.toFixed(2)},${lon.toFixed(2)}`;
    const cached = read(key);
    if (cached && now() - cached.t < ttl) return { speed: cached.speed, dir: cached.dir };
    const stale = cached ? { speed: cached.speed, dir: cached.dir } : null;
    if (now() < (read(PAUSE) || 0)) return stale;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const w = await fetchWind(lat, lon, fetchImpl, ctrl.signal);
      write(key, { ...w, t: now() });
      return w;
    } catch (e) {
      if (e && e.status === 429) write(PAUSE, now() + backoff);
      return stale;
    } finally {
      clearTimeout(timer);
    }
  };
}
