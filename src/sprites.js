export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sheet(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

export function marigold(r, hue, seed, dpr) {
  const pad = 2;
  const c = sheet(Math.ceil((r + pad) * 2 * dpr));
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(r + pad, r + pad);
  const rand = rng(seed);
  g.fillStyle = `hsl(${hue - 8} 85% 30%)`;
  g.beginPath();
  g.arc(0, 0, r * 0.95, 0, Math.PI * 2);
  g.fill();
  const rings = [
    [1, 17],
    [0.8, 14],
    [0.6, 11],
    [0.4, 7],
  ];
  rings.forEach(([f, n], k) => {
    const rr = r * f;
    for (let i = 0; i < n; i++) {
      const a = ((i + rand() * 0.5) / n) * Math.PI * 2 + k * 0.7;
      g.save();
      g.rotate(a);
      g.translate(rr * 0.58, 0);
      g.rotate((rand() - 0.5) * 0.7);
      g.fillStyle = `hsl(${hue + (rand() - 0.5) * 8} ${86 + rand() * 10}% ${42 + k * 4 + rand() * 11}%)`;
      g.beginPath();
      g.ellipse(0, 0, rr * 0.46, rr * 0.31, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = `hsl(${hue - 10} 80% 26% / 0.35)`;
      g.lineWidth = 0.6;
      g.stroke();
      g.restore();
    }
  });
  g.fillStyle = `hsl(${hue - 6} 90% 34%)`;
  g.beginPath();
  g.arc(0, 0, r * 0.13, 0, Math.PI * 2);
  g.fill();
  return { img: c, r: r + pad };
}

export function bead(r, light, dark, dpr) {
  const pad = 1;
  const c = sheet(Math.ceil((r + pad) * 2 * dpr));
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(r + pad, r + pad);
  const grad = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.08, 0, 0, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.28, light);
  grad.addColorStop(1, dark);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  return { img: c, r: r + pad };
}

export function mirror(r, dpr) {
  const pad = 2;
  const c = sheet(Math.ceil((r + pad) * 2 * dpr));
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(r + pad, r + pad);
  g.fillStyle = '#7a1414';
  g.beginPath();
  g.arc(0, 0, r + 1.5, 0, Math.PI * 2);
  g.fill();
  const grad = g.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, '#f4f6f8');
  grad.addColorStop(0.5, '#9aa3ab');
  grad.addColorStop(1, '#dfe4e8');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  return { img: c, r: r + pad };
}
