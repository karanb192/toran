// [frequency ratio, gain, share of the decay]. Two near-unison partials give a brass bell its shimmer.
const PARTIALS = [
  [1, 1, 1],
  [1.004, 0.5, 0.85],
  [2.32, 0.38, 0.5],
  [4.25, 0.2, 0.3],
  [6.63, 0.09, 0.18],
];

// Raag Bhupali (Sa Re Ga Pa Dha) over two octaves from C5, so any sweep sounds in tune.
export const NOTES = (() => {
  const sa = 523.25;
  const steps = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3];
  const out = [];
  for (let o = 0; o < 2; o++) for (const r of steps) out.push(sa * r * 2 ** o);
  out.push(sa * 4);
  return out;
})();

export class Bells {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.night = false;
    this.active = 0;
  }

  async enable() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      const c = (this.ctx = new AC());
      this.tone = c.createBiquadFilter();
      this.tone.type = 'lowpass';
      this.tone.frequency.value = 9000;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.ratio.value = 6;
      this.out = c.createGain();
      this.out.gain.value = 0.9;
      this.tone.connect(this.comp).connect(this.out).connect(c.destination);
      this.noise = makeNoise(c);
    }
    await this.ctx.resume();
    this.on = true;
    this.setNight(this.night);
  }

  disable() {
    this.on = false;
    if (this.ctx) this.ctx.suspend();
  }

  pause() {
    if (this.ctx && this.on) this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.on) this.ctx.resume();
  }

  setNight(night) {
    this.night = night;
    if (this.tone) this.tone.frequency.setTargetAtTime(night ? 2200 : 9000, this.ctx.currentTime, 0.3);
  }

  stream() {
    if (!this.ctx) return null;
    if (!this.dest) {
      this.dest = this.ctx.createMediaStreamDestination();
      this.out.connect(this.dest);
    }
    return this.dest.stream;
  }

  ring(freq, intensity = 0.5) {
    if (!this.on || !this.ctx || this.ctx.state !== 'running' || this.active > 16) return;
    const c = this.ctx;
    const now = c.currentTime;
    const peak = (this.night ? 0.1 : 0.14) * (0.35 + 0.65 * intensity);
    const decay = (this.night ? 3.4 : 2.4) * (0.6 + 0.4 * intensity);
    const voice = c.createGain();
    voice.connect(this.tone);
    let end = now;
    for (const [ratio, gain, share] of PARTIALS) {
      const o = c.createOscillator();
      o.frequency.value = freq * ratio;
      const g = c.createGain();
      const d = decay * share;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(peak * gain, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.003 + d);
      o.connect(g).connect(voice);
      o.start(now);
      o.stop(now + d + 0.05);
      end = Math.max(end, now + d + 0.05);
    }
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = Math.min(8000, freq * 3);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.06 * intensity, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    n.connect(hp).connect(ng).connect(voice);
    n.start(now);
    n.stop(now + 0.03);
    this.active++;
    setTimeout(() => {
      this.active--;
      voice.disconnect();
    }, (end - now) * 1000 + 50);
  }
}

function makeNoise(c) {
  const len = Math.floor(c.sampleRate * 0.03);
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  return b;
}
