import { Howl } from 'howler';
import clickUrl from '../assets/sounds/click.mp3';

/**
 * AudioEngine — keystroke clicks (sampled) plus synthesised error / finish cues.
 * Everything is lazily created on first user gesture so autoplay policies stay happy.
 */
export class AudioEngine {
  constructor() {
    this.enabled = false;
    this.ctx = null;

    this.click = new Howl({
      src: [clickUrl],
      volume: 0.35,
      preload: true,
      pool: 12
    });
  }

  setEnabled(v) {
    this.enabled = v;
    if (v) this._ensureCtx();
  }

  _ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /** slight pitch variation keeps rapid typing from sounding like a machine gun */
  keyPress() {
    if (!this.enabled) return;
    this.click.rate(0.92 + Math.random() * 0.18);
    this.click.play();
  }

  error() {
    if (!this.enabled) return;
    this._tone({ freq: 150, type: 'square', dur: 0.11, gain: 0.07, slideTo: 90 });
  }

  /** rising triumphant chord when a test ends */
  finish(isPb = false) {
    if (!this.enabled) return;
    const notes = isPb ? [392, 523.25, 659.25, 783.99] : [329.63, 415.3, 493.88];
    notes.forEach((f, i) => {
      setTimeout(() => this._tone({ freq: f, type: 'triangle', dur: 0.55, gain: 0.09 }), i * 90);
    });
  }

  _tone({ freq, type = 'sine', dur = 0.2, gain = 0.08, slideTo = null }) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }
}
