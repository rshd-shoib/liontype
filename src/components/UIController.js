import Chart from 'chart.js/auto';
import confetti from 'canvas-confetti';
import gsap from 'gsap';
import { rank, escapeHtml, storage } from '../utils/helpers.js';

const RING_CIRC = 2 * Math.PI * 31;

const $ = id => document.getElementById(id);

/**
 * UIController — owns every DOM concern: the scrolling word stream, caret,
 * live HUD, config bar, theme switching and the results screen.
 */
export class UIController {
  constructor(engine, audio, scene) {
    this.engine = engine;
    this.audio = audio;
    this.scene = scene;

    this.wordsEl = $('words');
    this.caretEl = $('caret');
    this.arenaEl = $('arena');
    this.inputEl = $('hiddenInput');
    this.resultsEl = $('results');
    this.chart = null;
    this.wordEls = [];
    this.lineOffset = 0;
    this.best = 0;
    this.tests = 0;
    this.theme = 'neon';

    this.wordsEl.appendChild(this.caretEl); 

    this._bindEngine();
    this._bindConfigBar();
    this._bindInput();
    this._loadStats();
  }

  // ------------------------------------------------------------------ wiring

  _bindEngine() {
    const e = this.engine;
    e.on('render', () => this.renderWords());
    e.on('tick', s => this.renderLive(s));
    e.on('key', ({ correct }) => {
      this.audio.keyPress();
      if (!correct) this.flashError();
    });
    e.on('error', () => {
      this.audio.error();
      this.scene.lion?.flinch();
    });
    e.on('start', () => {
      this.arenaEl.classList.add('typing');
      this.resultsEl.classList.remove('show');
    });
    e.on('finish', r => this.showResults(r));
  }

  _bindConfigBar() {
    const setActive = (sel, el) => {
      document.querySelectorAll(sel).forEach(b => b.classList.remove('active'));
      el.classList.add('active');
    };

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.onclick = () => {
        setActive('.mode-btn', btn);
        const mode = btn.dataset.mode;
        $('timeOpts').style.display = mode === 'time' ? '' : 'none';
        $('wordOpts').style.display = mode === 'words' ? '' : 'none';
        $('ringWrap').style.display = mode === 'time' ? '' : 'none';
        this.engine.setConfig({ mode });
        this.focus();
      };
    });

    document.querySelectorAll('.dur-btn').forEach(btn => {
      btn.onclick = () => {
        setActive('.dur-btn', btn);
        this.engine.setConfig({ duration: +btn.dataset.dur });
        this.focus();
      };
    });

    document.querySelectorAll('.wc-btn').forEach(btn => {
      btn.onclick = () => {
        setActive('.wc-btn', btn);
        this.engine.setConfig({ wordCount: +btn.dataset.wc });
        this.focus();
      };
    });

    $('punctBtn').onclick = () => {
      const on = $('punctBtn').classList.toggle('active');
      this.engine.setConfig({ punctuation: on });
      this.focus();
    };

    $('soundBtn').onclick = () => {
      const on = $('soundBtn').classList.toggle('active');
      this.audio.setEnabled(on);
      this.focus();
    };

    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.onclick = () => {
        setActive('.theme-btn', btn);
        this.setTheme(btn.dataset.theme);
        this.focus();
      };
    });

    $('restartBtn').onclick = () => this.restart();
    $('nextBtn').onclick = () => this.restart();
    $('logoBtn').onclick = () => this.restart();
    this.arenaEl.onclick = () => this.focus();
  }

  _bindInput() {
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Tab' || ev.key === 'Escape') {
        ev.preventDefault();
        this.restart();
        return;
      }
      if (ev.target.tagName === 'BUTTON' && ev.key === 'Enter') return;
      if (this.resultsEl.classList.contains('show')) {
        if (ev.key.length === 1) { ev.preventDefault(); this.restart(); }
        return;
      }
      this.focus();
      this.engine.handleKey(ev);
    });

    this.inputEl.addEventListener('blur', () => this.arenaEl.classList.add('blurred'));
    this.inputEl.addEventListener('focus', () => this.arenaEl.classList.remove('blurred'));
  }

  async _loadStats() {
    const s = await storage.load();
    this.best = s.best || 0;
    this.tests = s.tests || 0;
    $('bestWpm').textContent = this.best;
    $('testCount').textContent = this.tests;
  }

  // ------------------------------------------------------------------ helpers

  focus() { this.inputEl.focus({ preventScroll: true }); }

  setTheme(name) {
    this.theme = name;
    document.documentElement.dataset.theme = name;
    this.scene.setTheme(name);
    if (this.chart) this.rebuildChartColors();
  }

  restart() {
    this.resultsEl.classList.remove('show');
    this.arenaEl.classList.remove('typing');
    this.lineOffset = 0;
    
    // Safely reset GSAP cached transform state
    gsap.killTweensOf(this.wordsEl);
    gsap.set(this.wordsEl, { y: 0 });

    this.engine.reset();
    this.focus();
    gsap.fromTo(this.arenaEl, { opacity: 0.35, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
  }

  flashError() {
    this.arenaEl.classList.remove('shake');
    void this.arenaEl.offsetWidth; 
    this.arenaEl.classList.add('shake');
  }

  // ------------------------------------------------------------- word stream

  renderWords() {
    const { words, typed, wordIndex } = this.engine;
    
    // Render all words in the current batch to prevent destroying the DOM on every spacebar press
    const limit = words.length;

    // Rebuild the DOM only when the entire word list changes (e.g. test restart or time mode pagination)
    if (this.wordEls.length !== limit) {
      const frag = document.createDocumentFragment();
      this.wordEls = [];
      for (let i = 0; i < limit; i++) {
        const w = document.createElement('div');
        w.className = 'word';
        frag.appendChild(w);
        this.wordEls.push(w);
      }
      this.wordsEl.innerHTML = '';
      this.wordsEl.appendChild(frag);
      this.wordsEl.appendChild(this.caretEl);
      for (let i = 0; i < limit; i++) this.paintWord(i);
    } else {
      for (let i = Math.max(0, wordIndex - 1); i <= Math.min(limit - 1, wordIndex + 1); i++) {
        this.paintWord(i);
      }
    }

    this.wordEls.forEach((el, i) => el.classList.toggle('active', i === wordIndex));
    this.positionCaret();
  }

  paintWord(i) {
    const el = this.wordEls[i];
    if (!el) return;
    const target = this.engine.words[i] || '';
    const typed = this.engine.typed[i] || '';
    const committed = i < this.engine.wordIndex;

    let html = '';
    for (let j = 0; j < target.length; j++) {
      let cls = 'pending';
      if (j < typed.length) cls = typed[j] === target[j] ? 'correct' : 'incorrect';
      else if (committed) cls = 'missed';
      html += `<span class="l ${cls}">${escapeHtml(target[j])}</span>`;
    }
    for (let j = target.length; j < typed.length; j++) {
      html += `<span class="l extra">${escapeHtml(typed[j])}</span>`;
    }
    el.innerHTML = html;
    el.classList.toggle('word-error', committed && typed !== target);
  }

  positionCaret() {
    const el = this.wordEls[this.engine.wordIndex];
    if (!el) return;
    const typed = this.engine.typed[this.engine.wordIndex] || '';
    const letters = el.querySelectorAll('.l');

    let targetElement, isAfter;

    // 1. Determine exactly which letter the caret should attach to
    if (letters.length === 0) {
      targetElement = el; // Fallback to the whole word container
      isAfter = false;
    } else if (typed.length === 0) {
      targetElement = letters[0]; // Before the first letter
      isAfter = false;
    } else {
      const idx = Math.min(typed.length - 1, letters.length - 1);
      targetElement = letters[idx];
      isAfter = true; // After the most recently typed letter
    }

    // 2. Safely calculate exact coordinates relative to the main container
    let x = 0;
    let y = 0;
    let current = targetElement;
    
    // Loop through parents to get true X/Y without double-counting
    while (current && current !== this.wordsEl) {
      x += current.offsetLeft;
      y += current.offsetTop;
      current = current.offsetParent;
    }

    // Push caret to the right side of the letter if we are actively typing
    if (isAfter) x += targetElement.offsetWidth;
    
    const h = targetElement.offsetHeight || 30;

    // Apply exact positioning
    this.caretEl.style.height = `${h}px`;
    this.caretEl.style.transform = `translate(${x}px, ${y}px)`;

    // 3. Dynamically calculate pixel gap between lines to prevent scrolling drift
    const firstTop = this.wordEls[0] ? this.wordEls[0].offsetTop : 0;
    let realLineHeight = el.offsetHeight || 30;
    
    for (let i = 1; i < this.wordEls.length; i++) {
      if (this.wordEls[i].offsetTop > firstTop) {
        realLineHeight = this.wordEls[i].offsetTop - firstTop;
        break;
      }
    }

    // Keep the active line in the middle of the viewport
    const line = Math.round((el.offsetTop - firstTop) / realLineHeight);
    const wanted = Math.max(0, line - 1) * realLineHeight;
    
    if (wanted !== this.lineOffset) {
      this.lineOffset = wanted;
      gsap.to(this.wordsEl, { y: -wanted, duration: 0.22, ease: 'power2.out' });
    }
  }

  // ---------------------------------------------------------------- live HUD

  renderLive(s) {
    $('liveWpm').textContent = s.wpm;
    $('liveAcc').textContent = Math.round(s.acc);

    if (this.engine.config.mode === 'time') {
      const remain = Math.ceil(s.remaining);
      $('ringVal').textContent = this.engine.running || this.engine.finished ? remain : this.engine.config.duration;
      const frac = this.engine.running ? s.remaining / this.engine.config.duration : 1;
      $('ringProg').style.strokeDasharray = `${RING_CIRC}`;
      $('ringProg').style.strokeDashoffset = `${RING_CIRC * (1 - frac)}`;
    } else {
      $('ringVal').textContent = `${s.wordIndex}/${s.totalWords}`;
    }
  }

  // ----------------------------------------------------------------- results

  async showResults(r) {
    const isPb = r.wpm > this.best;
    if (isPb) this.best = r.wpm;
    this.tests++;
    storage.save(this.best, this.tests);
    $('bestWpm').textContent = this.best;
    $('testCount').textContent = this.tests;

    $('rWpm').textContent = r.wpm;
    $('rAcc').textContent = `${r.acc.toFixed(1)}%`;
    $('rRaw').textContent = r.raw;
    $('rChars').textContent = `${r.correctChars}/${r.incorrectChars}`;
    $('rCons').textContent = `${r.consistency.toFixed(0)}%`;
    $('rankBanner').textContent = isPb ? `🏆 NEW PERSONAL BEST — ${rank(r.wpm)}` : rank(r.wpm);
    $('rankBanner').classList.toggle('pb', isPb);

    this.drawChart(r.history);
    this.resultsEl.classList.add('show');
    this.arenaEl.classList.remove('typing');

    this.audio.finish(isPb);
    this.scene.lion?.roar();
    this.scene.burst(isPb ? 1 : 0.5);

    if (isPb) {
      const c = getComputedStyle(document.documentElement);
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.35 },
        colors: [c.getPropertyValue('--c1').trim(), c.getPropertyValue('--c2').trim(), c.getPropertyValue('--c3').trim()]
      });
    }

    gsap.fromTo(this.resultsEl, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
  }

  _chartColors() {
    const c = getComputedStyle(document.documentElement);
    return {
      c1: c.getPropertyValue('--c1').trim() || '#00e5ff',
      c3: c.getPropertyValue('--c3').trim() || '#ffb52e',
      grid: 'rgba(255,255,255,.07)',
      text: 'rgba(255,255,255,.55)'
    };
  }

  rebuildChartColors() {
    const col = this._chartColors();
    this.chart.data.datasets[0].borderColor = col.c1;
    this.chart.data.datasets[0].pointBackgroundColor = col.c1;
    this.chart.data.datasets[1].borderColor = col.c3;
    this.chart.update('none');
  }

  drawChart(history) {
    const col = this._chartColors();
    const labels = history.map(h => Math.round(h.t));
    const wpm = history.map(h => h.wpm);
    const raw = history.map(h => h.raw);

    if (this.chart) this.chart.destroy();

    const ctx = $('chart').getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 190);
    grad.addColorStop(0, col.c1 + '66');
    grad.addColorStop(1, col.c1 + '00');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'wpm',
            data: wpm,
            borderColor: col.c1,
            backgroundColor: grad,
            borderWidth: 2.5,
            fill: true,
            tension: 0.38,
            pointRadius: 2,
            pointBackgroundColor: col.c1
          },
          {
            label: 'raw',
            data: raw,
            borderColor: col.c3,
            borderWidth: 1.5,
            borderDash: [5, 4],
            fill: false,
            tension: 0.38,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700 },
        plugins: {
          legend: { labels: { color: col.text, boxWidth: 12, font: { family: 'JetBrains Mono', size: 10 } } },
          tooltip: { intersect: false, mode: 'index' }
        },
        scales: {
          x: { grid: { color: col.grid }, ticks: { color: col.text, font: { size: 10 } } },
          y: { grid: { color: col.grid }, ticks: { color: col.text, font: { size: 10 } }, beginAtZero: true }
        }
      }
    });
  }
}
