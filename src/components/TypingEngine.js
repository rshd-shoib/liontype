import mitt from 'mitt';
import { genWords } from '../utils/helpers.js';

/**
 * TypingEngine — headless typing test state machine.
 *
 * Implements Monkeytype's semantics:
 *  - word-at-a-time input; SPACE commits the current word (even if incomplete)
 *  - per-character states: correct | incorrect | extra | missed | pending
 *  - backspace within a word; ctrl/alt+backspace deletes the whole word
 *  - you may return to a previous word only if it was typed imperfectly
 *  - wpm  = (correct chars / 5) / minutes   (a committed word contributes its space)
 *  - raw  = (all typed chars / 5) / minutes
 *  - acc  = correct keystrokes / total keystrokes  (never decreases on backspace)
 *  - consistency = 100 * (1 - coefficient of variation of per-second raw wpm)
 *
 * Emits: 'render' | 'tick' | 'key' | 'error' | 'start' | 'finish'
 */
export class TypingEngine {
  constructor() {
    this.emitter = mitt();
    this.on = this.emitter.on;
    this.off = this.emitter.off;

    this.config = { mode: 'time', duration: 30, wordCount: 25, punctuation: false };
    this.reset();
  }

  // ---------------------------------------------------------------- lifecycle

  reset() {
    const c = this.config;
    const n = c.mode === 'words' ? c.wordCount : Math.max(80, c.duration * 4);
    this.words = genWords(n, c.punctuation);
    this.typed = ['']; // what the user has entered for each word index
    this.wordIndex = 0;
    this.running = false;
    this.finished = false;
    this.startTime = 0;
    this.elapsed = 0;
    this.totalKeys = 0;
    this.correctKeys = 0;
    this.history = [];      // { t, wpm, raw }
    this._lastSample = 0;
    this._recentKeys = [];  // timestamps, for the live "intensity" signal
    this.emitter.emit('render');
    this.emitter.emit('tick', this.snapshot());
  }

  setConfig(patch) {
    Object.assign(this.config, patch);
    this.reset();
  }

  start() {
    if (this.running || this.finished) return;
    this.running = true;
    this.startTime = performance.now();
    this.emitter.emit('start');
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    this._sample(true);
    this.emitter.emit('finish', this.results());
  }

  // ------------------------------------------------------------------- timing

  /** called every animation frame by main.js */
  update() {
    if (!this.running) return;
    this.elapsed = (performance.now() - this.startTime) / 1000;

    if (this.config.mode === 'time' && this.elapsed >= this.config.duration) {
      this.elapsed = this.config.duration;
      this.finish();
      return;
    }
    if (this.elapsed - this._lastSample >= 1) this._sample();
    this.emitter.emit('tick', this.snapshot());
  }

  _sample(force = false) {
    if (!force && this.elapsed - this._lastSample < 1) return;
    this._lastSample = Math.floor(this.elapsed);
    const s = this.snapshot();
    this.history.push({ t: +this.elapsed.toFixed(1), wpm: s.wpm, raw: s.raw });
  }

  // -------------------------------------------------------------------- input

  handleKey(e) {
    if (this.finished) return;
    if (e.repeat) return; // one physical key press = one action, even if held slightly too long
    const key = e.key;

    if (key === 'Backspace') {
      e.preventDefault();
      this._backspace(e.ctrlKey || e.altKey || e.metaKey);
      this.emitter.emit('render');
      return;
    }

    if (key === ' ') {
      e.preventDefault();
      this._space();
      return;
    }

    if (key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    this._char(key);
  }

  _char(ch) {
    this.start();

    const target = this.words[this.wordIndex] || '';
    const cur = this.typed[this.wordIndex] || '';

    // Monkeytype caps runaway "extra" characters
    if (cur.length >= target.length + 12) return;

    this.typed[this.wordIndex] = cur + ch;

    const correct = ch === target[cur.length];
    this.totalKeys++;
    if (correct) this.correctKeys++; else this.emitter.emit('error');

    this._recentKeys.push(performance.now());
    if (this._recentKeys.length > 24) this._recentKeys.shift();

    this.emitter.emit('key', { ch, correct });
    this.emitter.emit('render');

    // words mode: finish on the last character of the last word
    if (
      this.config.mode === 'words' &&
      this.wordIndex === this.words.length - 1 &&
      this.typed[this.wordIndex] === target
    ) {
      this.finish();
    }
  }

  _space() {
    if (!this.running && !this.typed[this.wordIndex]) return; // ignore leading space
    this.start();

    const cur = this.typed[this.wordIndex] || '';
    if (cur.length === 0) return; // Monkeytype ignores double-space

    const target = this.words[this.wordIndex];
    this.totalKeys++;
    if (cur === target) this.correctKeys++; else this.emitter.emit('error');

    if (this.config.mode === 'words' && this.wordIndex >= this.words.length - 1) {
      this.emitter.emit('render');
      this.finish();
      return;
    }

    this.wordIndex++;
    if (this.typed[this.wordIndex] === undefined) this.typed[this.wordIndex] = '';

    // time mode: keep the word supply topped up so you never run dry
    if (this.config.mode === 'time' && this.wordIndex > this.words.length - 40) {
      this.words.push(...genWords(40, this.config.punctuation));
    }

    this.emitter.emit('render');
  }

  _backspace(whole) {
    const cur = this.typed[this.wordIndex] || '';

    if (cur.length === 0) {
      // step back only if the previous word was imperfect (Monkeytype default)
      const prev = this.wordIndex - 1;
      if (prev < 0) return;
      if (this.typed[prev] === this.words[prev]) return;
      this.wordIndex = prev;
      if (whole) this.typed[prev] = '';
      return;
    }

    this.typed[this.wordIndex] = whole ? '' : cur.slice(0, -1);
  }

  // ------------------------------------------------------------------- scoring

  /** correct characters, counting the space after each perfectly typed word */
  _correctChars() {
    let n = 0;
    for (let i = 0; i <= this.wordIndex; i++) {
      const target = this.words[i] || '';
      const typed = this.typed[i] || '';
      const len = Math.min(typed.length, target.length);
      for (let j = 0; j < len; j++) if (typed[j] === target[j]) n++;
      if (i < this.wordIndex && typed === target) n++; // the committed space
    }
    return n;
  }

  _typedChars() {
    let n = 0;
    for (let i = 0; i <= this.wordIndex; i++) n += (this.typed[i] || '').length;
    return n + this.wordIndex; // committed spaces
  }

  snapshot() {
    const mins = Math.max(this.elapsed, 0.001) / 60;
    const wpm = this.elapsed < 0.4 ? 0 : Math.round(this._correctChars() / 5 / mins);
    const raw = this.elapsed < 0.4 ? 0 : Math.round(this._typedChars() / 5 / mins);
    const acc = this.totalKeys === 0 ? 100 : (this.correctKeys / this.totalKeys) * 100;

    // live typing intensity 0..1 from the last ~2s of keystrokes, for the visuals
    const now = performance.now();
    const recent = this._recentKeys.filter(t => now - t < 2000).length;
    const intensity = Math.min(1, recent / 16);

    return {
      wpm: Math.max(0, wpm),
      raw: Math.max(0, raw),
      acc,
      intensity,
      elapsed: this.elapsed,
      remaining: Math.max(0, this.config.duration - this.elapsed),
      wordIndex: this.wordIndex,
      totalWords: this.config.mode === 'words' ? this.config.wordCount : this.words.length
    };
  }

  results() {
    const s = this.snapshot();

    // consistency = coefficient of variation over per-second raw wpm
    const raws = this.history.map(h => h.raw).filter(v => v > 0);
    let consistency = 0;
    if (raws.length > 1) {
      const mean = raws.reduce((a, b) => a + b, 0) / raws.length;
      const variance = raws.reduce((a, b) => a + (b - mean) ** 2, 0) / raws.length;
      consistency = Math.max(0, Math.min(100, (1 - Math.sqrt(variance) / mean) * 100));
    } else if (raws.length === 1) {
      consistency = 100;
    }

    return {
      wpm: s.wpm,
      raw: s.raw,
      acc: s.acc,
      consistency,
      correctChars: this._correctChars(),
      incorrectChars: Math.max(0, this.totalKeys - this.correctKeys),
      time: this.elapsed,
      history: this.history.slice(),
      mode: this.config.mode === 'time' ? `time ${this.config.duration}` : `words ${this.config.wordCount}`
    };
  }
}
