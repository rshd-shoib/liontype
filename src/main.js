import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, ChromaticAberrationEffect, BlendFunction } from 'postprocessing';

import { ParticleSystem } from './components/ParticleSystem.js';
import { LionAvatar } from './components/LionAvatar.js';
import { TypingEngine } from './components/TypingEngine.js';
import { AudioEngine } from './components/AudioEngine.js';
import { UIController } from './components/UIController.js';
import { THEMES } from './utils/helpers.js';

import './styles/main.css';
import './styles/animations.css';
import './styles/themes.css';

/** The WebGL backdrop: particle field, grid floor and the lion mascot. */
class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.burstAmount = 0;
    this.intensity = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(THEMES.neon.fog, 0.028);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 120);
    this.camera.position.set(0, 0.6, 8);

    this._buildLights();
    this._buildGrid();

    this.particles = new ParticleSystem(this.scene);
    this.lion = new LionAvatar(this.scene);

    this._buildComposer();

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);

    // subtle parallax on pointer move
    this.pointer = { x: 0, y: 0 };
    window.addEventListener('pointermove', e => {
      this.pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
      this.pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
    });
  }

  _buildLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    this.keyLight = new THREE.PointLight(THEMES.neon.a, 60, 40);
    this.keyLight.position.set(3.5, 4, 4);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.PointLight(THEMES.neon.c, 45, 40);
    this.rimLight.position.set(-4, 1.5, 2.5);
    this.scene.add(this.rimLight);
  }

  _buildGrid() {
    this.grid = new THREE.GridHelper(120, 90, THEMES.neon.a, THEMES.neon.b);
    this.grid.position.y = -4.2;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.16;
    this.scene.add(this.grid);
  }

  _buildComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new BloomEffect({
      intensity: 1.5,
      luminanceThreshold: 0.18,
      luminanceSmoothing: 0.35,
      mipmapBlur: true,
      radius: 0.72
    });
    this.chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0004, 0.0004) });
    const vignette = new VignetteEffect({ blendFunction: BlendFunction.NORMAL, darkness: 0.62, offset: 0.28 });

    this.composer.addPass(new EffectPass(this.camera, this.bloom, this.chroma, vignette));
  }

  setTheme(name) {
    const t = THEMES[name] || THEMES.neon;
    this.scene.fog.color.setHex(t.fog);
    this.keyLight.color.setHex(t.a);
    this.rimLight.color.setHex(t.c);
    this.grid.material.color.setHex(t.a);
    this.particles.setTheme(name);
    this.lion.setTheme(name);
  }

  /** typing intensity 0..1 drives particle speed, mane spin and bloom */
  setIntensity(v) { this.intensity = v; }

  /** a shockwave of light — used on test completion */
  burst(strength = 1) {
    gsap.fromTo(this, { burstAmount: strength }, { burstAmount: 0, duration: 1.6, ease: 'power2.out' });
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.particles.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  }

  render() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.getElapsedTime();
    const boost = this.intensity + this.burstAmount;

    this.particles.setIntensity(boost);
    this.particles.update(dt, t);
    this.lion.setIntensity(this.intensity);
    this.lion.update(dt, t);

    this.grid.position.z = (t * (1.2 + this.intensity * 5)) % 1.34;
    this.grid.material.opacity = 0.14 + boost * 0.22;

    this.bloom.intensity = 1.4 + boost * 1.5;
    this.chroma.offset.set(0.0004 + boost * 0.0022, 0.0004 + boost * 0.0016);

    // parallax
    this.camera.position.x += (this.pointer.x * 0.45 - this.camera.position.x) * 0.04;
    this.camera.position.y += (0.6 - this.pointer.y * 0.3 - this.camera.position.y) * 0.04;
    this.camera.lookAt(0, 0.7, 0);

    this.composer.render(dt);
  }
}

// ------------------------------------------------------------------ bootstrap

const scene = new SceneManager(document.getElementById('scene'));
const engine = new TypingEngine();
const audio = new AudioEngine();
const ui = new UIController(engine, audio, scene);

ui.setTheme('neon');
ui.restart();

function loop() {
  requestAnimationFrame(loop);
  engine.update();
  scene.setIntensity(engine.snapshot().intensity);
  scene.render();
}
loop();

// hide the boot splash once the first frame is on screen
requestAnimationFrame(() => document.body.classList.add('ready'));
