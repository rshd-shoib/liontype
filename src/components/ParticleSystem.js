import * as THREE from 'three';
import vertexShader from '../shaders/vertex.glsl';
import fragmentShader from '../shaders/fragment.glsl';
import { THEMES } from '../utils/helpers.js';

const COUNT = 1600;

export class ParticleSystem {
  constructor(scene) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const scale = new Float32Array(COUNT);
    const rand = new Float32Array(COUNT);
    const colorMix = new Float32Array(COUNT * 3);

    for (let i = 0; i < COUNT; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 34;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 2] = -Math.random() * 20 - 2;
      scale[i] = Math.random() * 2.2 + 0.4;
      rand[i] = Math.random();
      // one-hot-ish mix between three theme colors
      const pick = Math.random();
      colorMix[i * 3 + 0] = pick < 0.6 ? 1 : 0;
      colorMix[i * 3 + 1] = pick >= 0.6 && pick < 0.85 ? 1 : 0;
      colorMix[i * 3 + 2] = pick >= 0.85 ? 1 : 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geo.setAttribute('aRandom', new THREE.BufferAttribute(rand, 1));
    geo.setAttribute('aColorMix', new THREE.BufferAttribute(colorMix, 3));

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uColorA: { value: new THREE.Color(THEMES.neon.a) },
        uColorB: { value: new THREE.Color(THEMES.neon.b) },
        uColorC: { value: new THREE.Color(THEMES.neon.c) }
      }
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);

    this._speed = 0;
    this._target = 0;
  }

  /** typing intensity 0..1 — eases toward target */
  setIntensity(v) { this._target = Math.min(1, Math.max(0, v)); }

  setTheme(name) {
    const t = THEMES[name] || THEMES.neon;
    this.material.uniforms.uColorA.value.setHex(t.a);
    this.material.uniforms.uColorB.value.setHex(t.b);
    this.material.uniforms.uColorC.value.setHex(t.c);
  }

  update(dt, elapsed) {
    this._speed += (this._target - this._speed) * Math.min(1, dt * 2.5);
    this.material.uniforms.uTime.value = elapsed;
    this.material.uniforms.uSpeed.value = this._speed;
  }
}

