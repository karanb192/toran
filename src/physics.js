export class World {
  constructor() {
    this.points = [];
    this.links = [];
    this.gravity = 1500;
    this.damping = 0.993;
    this.iterations = 8;
  }

  point(x, y, pinned = false) {
    const p = { x, y, px: x, py: y, pinned, grabbed: false, s: 0, w: 1, touched: 0 };
    this.points.push(p);
    return p;
  }

  link(a, b, len = Math.hypot(a.x - b.x, a.y - b.y)) {
    const l = { a, b, len };
    this.links.push(l);
    return l;
  }

  step(dt, force) {
    const dt2 = dt * dt;
    for (const p of this.points) {
      if (p.pinned || p.grabbed) continue;
      const f = force(p);
      const vx = (p.x - p.px) * this.damping;
      const vy = (p.y - p.py) * this.damping;
      p.px = p.x;
      p.py = p.y;
      p.x += vx + f.x * dt2;
      p.y += vy + (this.gravity + f.y) * dt2;
    }
    for (let k = 0; k < this.iterations; k++) {
      for (const l of this.links) solve(l);
    }
  }
}

function solve(l) {
  const { a, b } = l;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1e-6;
  let diff = (d - l.len) / d;
  // strings go slack instead of pushing back like rods
  if (diff < 0) diff *= 0.3;
  const ma = a.pinned || a.grabbed ? 0 : 1;
  const mb = b.pinned || b.grabbed ? 0 : 1;
  const m = ma + mb;
  if (!m) return;
  const ox = dx * diff;
  const oy = dy * diff;
  a.x += (ox * ma) / m;
  a.y += (oy * ma) / m;
  b.x -= (ox * mb) / m;
  b.y -= (oy * mb) / m;
}

export function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  let t = len2 ? ((px - ax) * vx + (py - ay) * vy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}
