import { World } from './physics.js';
import { NOTES } from './bell.js';
import { marigold, bead, mirror, rng } from './sprites.js';

export const VARIANTS = {
  genda: {
    name: 'Marigold',
    script: 'तोरण',
    lang: 'hi',
    blurb: 'Marigolds and mango leaves over the door, hung for festivals and weddings across much of India.',
  },
  aam: {
    name: 'Mango leaf',
    script: 'தோரணம்',
    lang: 'ta',
    blurb: 'A thoranam of mango leaves, strung over doors in Tamil Nadu for Pongal and weddings.',
  },
  moti: {
    name: 'Beaded',
    script: 'મોતી તોરણ',
    lang: 'gu',
    blurb: 'Glass beads and small mirrors, the moti toran of Gujarat.',
  },
};

const BEADS = [
  ['#e0473f', '#7a1414'],
  ['#35a46b', '#0f4a2c'],
  ['#f8f3e6', '#b3a68a'],
  ['#ecb940', '#8a5f10'],
  ['#3f72cf', '#152f66'],
];
const LEAF_GREENS = ['#3f7d2a', '#4a8a30', '#356d24', '#5a9a3c', '#2f6420'];

export function layout(w, h) {
  const top = Math.max(96, h * 0.14);
  const dw = Math.min(w * 0.86, 760);
  const bottom = h - (w < 640 ? 150 : 96);
  return { x: (w - dw) / 2, y: top, w: dw, h: Math.max(200, bottom - top) };
}

function oddCount(width, gap) {
  const n = Math.max(7, Math.min(21, Math.round(width / gap)));
  return n % 2 ? n : n - 1;
}

export function buildToran(variant, door, dpr) {
  const world = new World();
  const rand = rng(7);
  const strands = [];
  const leaves = [];
  const top = door.y + (variant === 'moti' ? 20 : 2);

  const strand = (x, length, seg, s, kindOf) => {
    const pts = [world.point(x, top, true)];
    const count = Math.max(3, Math.round(length / seg));
    for (let j = 1; j <= count; j++) {
      const p = world.point(x, top + j * seg);
      p.s = s;
      world.link(pts[j - 1], p, seg);
      pts.push(p);
    }
    const bell = world.point(x, top + (count + 0.9) * seg);
    bell.s = s;
    bell.w = 0.8;
    world.link(pts[count], bell, seg * 0.9);
    const kinds = pts.map((_, j) => (j === 0 ? null : kindOf(j)));
    const st = { pts, kinds, bell: { p: bell, v: 0, flash: 0, cool: 0, freq: 0 }, door: null };
    strands.push(st);
    return st;
  };

  const leaf = (x, length, s, color) => {
    const pin = world.point(x, top - 1, true);
    const tip = world.point(x, top + length);
    tip.s = s;
    tip.w = 1.3;
    world.link(pin, tip, length);
    const l = { pin, tip, color, door: null };
    leaves.push(l);
    return l;
  };

  if (variant === 'aam') {
    const gap = 14;
    const count = Math.floor(door.w / gap);
    const off = (door.w - (count - 1) * gap) / 2;
    for (let j = 0; j < count; j++) {
      const x = door.x + off + j * gap;
      if (j % 5 === 2) {
        const t = j / (count - 1);
        const len = door.h * 0.17 * (1 + 0.5 * Math.cos((t - 0.5) * Math.PI));
        strand(x, len, 17, j, (k) => (k % 3 === 0 ? 'y' : 'o'));
      }
    }
    for (let j = 0; j < count; j++) {
      const x = door.x + off + j * gap;
      leaf(x, 44 + (j % 2) * 10 + rand() * 6, 100 + j, LEAF_GREENS[j % LEAF_GREENS.length]);
    }
  } else {
    const n = oddCount(door.w, variant === 'moti' ? 30 : 36);
    const gap = door.w / (n + 1);
    for (let i = 0; i < n; i++) {
      const x = door.x + gap * (i + 1);
      const t = i / (n - 1);
      const len = door.h * (i % 2 === 0 ? 0.34 : 0.22) * (1 + 0.28 * Math.cos((t - 0.5) * Math.PI));
      if (variant === 'moti') {
        strand(x, len, 11, i, (k) => (k % 6 === 3 ? 'mirror' : 'b' + ((k + i) % BEADS.length)));
      } else {
        const main = i % 2 ? 'y' : 'o';
        const other = i % 2 ? 'o' : 'y';
        strand(x, len, 17, i, (k) => (k % 4 === 0 ? other : main));
      }
    }
    if (variant === 'genda') {
      for (let i = 0; i <= n; i++) {
        leaf(door.x + gap * (i + 0.5), 36 + rand() * 10, 100 + i, LEAF_GREENS[i % LEAF_GREENS.length]);
      }
    }
  }

  const bells = strands.map((s) => s.bell).sort((a, b) => a.p.x - b.p.x);
  bells.forEach((b, i) => {
    b.freq = NOTES[Math.round((i / Math.max(1, bells.length - 1)) * (NOTES.length - 1))];
  });

  const sprites = {
    o: marigold(9.5, 28, 11, dpr),
    y: marigold(9.5, 42, 23, dpr),
    mirror: mirror(4.2, dpr),
  };
  BEADS.forEach(([l, d], i) => (sprites['b' + i] = bead(5, l, d, dpr)));
  return { variant, world, strands, leaves, bells, sprites, top };
}

function angleOf(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
}

function drawLeaf(g, a, b, color, tagged) {
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const W = L * 0.17;
  g.save();
  g.translate(a.x, a.y);
  g.rotate(angleOf(a, b));
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(W, L * 0.22, W * 0.9, L * 0.72, 0, L);
  g.bezierCurveTo(-W * 0.9, L * 0.72, -W, L * 0.22, 0, 0);
  g.fill();
  g.strokeStyle = 'rgba(214, 232, 170, 0.55)';
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(0, 1);
  g.lineTo(0, L * 0.92);
  g.stroke();
  if (tagged) {
    g.fillStyle = '#e8a317';
    g.beginPath();
    g.arc(0, 3, 2.6, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function drawBell(g, prev, b) {
  const p = b.p;
  const h = 15;
  const w = 13;
  g.save();
  g.translate(p.x, p.y);
  g.rotate(angleOf(prev, p));
  if (b.flash > 0.05) {
    g.fillStyle = `rgba(255, 214, 120, ${0.35 * b.flash})`;
    g.beginPath();
    g.arc(0, h * 0.2, 16, 0, Math.PI * 2);
    g.fill();
  }
  const grad = g.createLinearGradient(-w / 2, 0, w / 2, 0);
  grad.addColorStop(0, '#7c4e0f');
  grad.addColorStop(0.45, '#f0c35a');
  grad.addColorStop(1, '#8e5e14');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(-w * 0.28, -h * 0.3);
  g.bezierCurveTo(-w * 0.3, h * 0.05, -w * 0.52, h * 0.22, -w * 0.52, h * 0.38);
  g.lineTo(w * 0.52, h * 0.38);
  g.bezierCurveTo(w * 0.52, h * 0.22, w * 0.3, h * 0.05, w * 0.28, -h * 0.3);
  g.quadraticCurveTo(0, -h * 0.52, -w * 0.28, -h * 0.3);
  g.fill();
  g.fillStyle = '#6b420c';
  g.fillRect(-w * 0.55, h * 0.36, w * 1.1, 1.8);
  g.beginPath();
  g.arc(0, h * 0.5, 2, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export function drawToran(g, T, t) {
  const { strands, leaves, sprites } = T;
  g.lineWidth = 1;
  g.strokeStyle = T.variant === 'moti' ? '#6b1d1d' : '#5c3b16';
  for (const s of strands) {
    g.beginPath();
    g.moveTo(s.pts[0].x, s.pts[0].y);
    for (let j = 1; j < s.pts.length; j++) g.lineTo(s.pts[j].x, s.pts[j].y);
    g.lineTo(s.bell.p.x, s.bell.p.y);
    g.stroke();
  }
  for (const s of strands) {
    for (let j = 1; j < s.pts.length; j++) {
      const p = s.pts[j];
      const sp = sprites[s.kinds[j]];
      const a = angleOf(s.pts[j - 1], p) + (s.kinds[j].length === 1 ? j * 1.3 : 0);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(a);
      g.drawImage(sp.img, -sp.r, -sp.r, sp.r * 2, sp.r * 2);
      if (s.kinds[j] === 'mirror') {
        const glint = Math.pow(Math.max(0, Math.sin(a * 4 + t * 1.7 + j)), 10);
        if (glint > 0.02) {
          g.fillStyle = `rgba(255,255,255,${glint})`;
          g.beginPath();
          g.arc(-1, -1, 3.2, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.restore();
    }
    drawBell(g, s.pts[s.pts.length - 1], s.bell);
  }
  for (const l of leaves) drawLeaf(g, l.pin, l.tip, l.color, !!l.door);
}

export function drawBackground(W, H, door, variant, night, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const rand = rng(3);
  g.fillStyle = night ? '#1c1822' : '#ece1cd';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = night ? `rgba(255,255,255,${rand() * 0.03})` : `rgba(90,60,30,${rand() * 0.05})`;
    g.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 1 + rand() * 2);
  }
  const post = 18;
  const beam = 26;
  const inside = g.createLinearGradient(0, door.y, 0, door.y + door.h);
  inside.addColorStop(0, night ? '#0b0806' : '#3a2819');
  inside.addColorStop(1, night ? '#050403' : '#1d130b');
  g.fillStyle = inside;
  g.fillRect(door.x, door.y, door.w, door.h);
  const wood = (x, y, w, h, horizontal) => {
    const gr = horizontal ? g.createLinearGradient(0, y, 0, y + h) : g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, night ? '#2e1d12' : '#7a4c28');
    gr.addColorStop(0.5, night ? '#3a2616' : '#91603a');
    gr.addColorStop(1, night ? '#24170e' : '#633d20');
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
    g.strokeStyle = night ? 'rgba(0,0,0,0.25)' : 'rgba(60,30,10,0.25)';
    g.lineWidth = 1;
    for (let k = 0; k < (horizontal ? 4 : 3); k++) {
      g.beginPath();
      if (horizontal) {
        const yy = y + 5 + k * ((h - 8) / 3);
        g.moveTo(x, yy);
        g.bezierCurveTo(x + w * 0.3, yy + 2, x + w * 0.6, yy - 2, x + w, yy + 1);
      } else {
        const xx = x + 4 + k * ((w - 8) / 2);
        g.moveTo(xx, y);
        g.lineTo(xx + 1, y + h);
      }
      g.stroke();
    }
  };
  wood(door.x - post, door.y, post, door.h, false);
  wood(door.x + door.w, door.y, post, door.h, false);
  g.fillStyle = night ? '#3b3530' : '#b9a78b';
  g.fillRect(door.x - post - 24, door.y + door.h, door.w + post * 2 + 48, 16);
  g.fillStyle = night ? 'rgba(0,0,0,0.3)' : 'rgba(80,60,40,0.25)';
  g.fillRect(door.x - post - 24, door.y + door.h + 14, door.w + post * 2 + 48, 3);
  wood(door.x - post - 12, door.y - beam, door.w + post * 2 + 24, beam, true);
  if (variant === 'moti') {
    g.fillStyle = night ? '#4a1010' : '#9b1c1c';
    g.fillRect(door.x, door.y, door.w, 20);
    const tri = 14;
    for (let x = door.x; x < door.x + door.w - 1; x += tri) {
      g.fillStyle = BEADS[Math.round((x - door.x) / tri) % BEADS.length][0];
      g.beginPath();
      g.moveTo(x, door.y + 20);
      g.lineTo(x + tri, door.y + 20);
      g.lineTo(x + tri / 2, door.y + 29);
      g.fill();
    }
    for (let x = door.x + 5; x <= door.x + door.w - 5; x += 10) {
      g.fillStyle = (x / 10) % 2 < 1 ? '#f8f3e6' : '#ecb940';
      g.beginPath();
      g.arc(x, door.y + 10, 2.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

export function drawNight(g, W, H, door, t) {
  g.fillStyle = 'rgba(14, 8, 34, 0.32)';
  g.fillRect(0, 0, W, H);
  const n = 5;
  const y = door.y + door.h + 2;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = door.x + (door.w * (i + 0.5)) / n;
    const f = 0.85 + 0.15 * Math.sin(t * 9 + i * 2.1) * Math.sin(t * 5.3 + i);
    const glow = g.createRadialGradient(x, y - 10, 2, x, y - 10, 90 * f);
    glow.addColorStop(0, 'rgba(255, 170, 60, 0.45)');
    glow.addColorStop(1, 'rgba(255, 120, 20, 0)');
    g.fillStyle = glow;
    g.fillRect(x - 100, y - 110, 200, 200);
  }
  g.restore();
  for (let i = 0; i < n; i++) {
    const x = door.x + (door.w * (i + 0.5)) / n;
    const f = 0.85 + 0.15 * Math.sin(t * 9 + i * 2.1) * Math.sin(t * 5.3 + i);
    g.fillStyle = '#9a4a22';
    g.beginPath();
    g.ellipse(x, y, 11, 5, 0, 0, Math.PI);
    g.fill();
    g.fillStyle = '#c0663a';
    g.beginPath();
    g.ellipse(x, y, 11, 2.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffd36b';
    g.beginPath();
    g.moveTo(x, y - 15 * f);
    g.quadraticCurveTo(x + 4.5, y - 5, x, y - 1);
    g.quadraticCurveTo(x - 4.5, y - 5, x, y - 15 * f);
    g.fill();
  }
}
