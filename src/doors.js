export const REPO = 'https://github.com/karanb192/toran';
export const ADD_URL = REPO + '/issues/new?template=door.yml';
export const FIX_URL = REPO + '/issues/new?template=fix.yml';

export async function loadDoors() {
  try {
    const r = await fetch('doors.json', { cache: 'no-cache' });
    if (!r.ok) return [];
    const list = await r.json();
    return Array.isArray(list) ? list.filter((d) => d && typeof d.place === 'string' && typeof d.line === 'string') : [];
  } catch {
    return [];
  }
}
