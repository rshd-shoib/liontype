# 🦁 LionType

A futuristic, WebGL-powered typing speed test — Monkeytype's mechanics, rebuilt with a
Three.js neon arena, custom GLSL particles, a 3D lion mascot, and a synthesised audio engine.

## Quick start

```bash
npm install
npm run dev      # vite dev server (hot reload)
npm run build    # compiles to dist/
npm run preview  # serve the production build
```

## Pipeline

```
src/
├── components/
│   ├── LionAvatar.js      # 3D mascot: GLB loader + procedural low-poly fallback
│   ├── ParticleSystem.js  # 4k-point GPU particle field driven by custom shaders
│   ├── TypingEngine.js    # test state machine, scoring, event bus (mitt)
│   ├── AudioEngine.js     # sampled key clicks + WebAudio synth cues
│   └── UIController.js    # DOM rendering, caret, config bar, results + Chart.js graph
├── shaders/
│   ├── vertex.glsl         # per-particle drift, typing-speed swirl, size attenuation
│   └── fragment.glsl       # soft radial glow, theme colour mix, additive falloff
├── assets/
│   ├── models/lion.glb     # mascot model (placeholder → procedural lion)
│   ├── textures/gold.jpg   # metallic gold map for the mane/head material
│   └── sounds/click.mp3    # keystroke sample (pitch-randomised per press)
├── styles/
│   ├── main.css            # layout, glassmorphism, arena, results dashboard
│   ├── animations.css      # keyframes: caret blink, shake, sheen, boot sweep
│   └── themes.css          # Neon / Savanna / Cyber palettes (CSS vars)
├── utils/helpers.js        # word lists, generators, WPM math, storage, THEMES
├── main.js                 # scene, camera, bloom post-processing, render loop, wiring
└── index.html
dist/                       # compiled output
vite.config.js              # root=src, glsl plugin, terser, dist/ output
```

## Typing mechanics (Monkeytype-compatible)

- **Modes** — Time (15 / 30 / 60 / 120s) and Words (10 / 25 / 50 / 100), plus a punctuation toggle.
- **Character states** — correct, incorrect, extra, missed; per-word validation on space.
- **WPM** = (correct characters ÷ 5) ÷ minutes elapsed. **Raw WPM** counts every character typed.
- **Accuracy** = correct keystrokes ÷ total keystrokes (backspaces excluded).
- **Consistency** = 100 − coefficient of variation of per-second WPM samples.
- **Caret** glides between letters; the word stream keeps three lines visible and scrolls.
- `Tab` / `Esc` restarts instantly. Personal bests persist locally.

## Graphics notes

- Custom `ShaderMaterial` particles: `uTime`, `uSpeed`, `uColorA/B` uniforms are updated
  each frame from the typing engine, so the field accelerates as you type faster.
- Selective bloom via `postprocessing`, plus a reflective grid floor and drifting fog.
- The mascot reacts: mane spins with WPM, flinches on errors, roars on a personal best.

## Swapping in a real lion model

`src/assets/models/lion.glb` is a tiny valid placeholder. `LionAvatar.js` counts vertices —
anything above 100 is treated as a real model and rendered directly, otherwise it builds the
procedural neon lion. Drop your own `lion.glb` in that folder and rebuild; no code changes needed.
Regenerate the placeholder any time with `node scripts/make-placeholder-glb.mjs`.
