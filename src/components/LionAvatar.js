import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';
import { THEMES } from '../utils/helpers.js';
import lionUrl from '../assets/models/lion.glb?url';
import goldUrl from '../assets/textures/gold.jpg';

/**
 * LionAvatar — the 3D mascot hovering over the arena.
 * Tries to load assets/models/lion.glb; if the model is a small placeholder
 * (or fails to load), it builds a procedural neon low-poly lion head instead.
 * Drop a real lion.glb into src/assets/models/ and it is used automatically.
 */
export class LionAvatar {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.set(0, 1.55, -2);
    scene.add(this.group);

    this.maneParts = [];
    this.eyes = [];
    this.spin = 0;
    this.intensity = 0;

    const tex = new THREE.TextureLoader().load(goldUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.goldTex = tex;

    this.gltfMaterials = []; // materials on a *real* loaded model, so setTheme() can still tint it

    new GLTFLoader().load(
      lionUrl,
      (gltf) => {
        let verts = 0;
        gltf.scene.traverse(o => { if (o.isMesh) verts += o.geometry.attributes.position.count; });
        if (verts > 100) {
          gltf.scene.scale.setScalar(1.2);
          this.group.add(gltf.scene);

          // give the real model the same theme-reactive glow the procedural one has
          gltf.scene.traverse(o => {
            if (o.isMesh && o.material && 'emissive' in o.material) {
              o.material.emissiveIntensity = Math.max(o.material.emissiveIntensity, 0.25);
              this.gltfMaterials.push(o.material);
            }
          });
        } else {
          this.buildProceduralLion(); // placeholder glb -> procedural mascot
        }
        this.enter();
      },
      undefined,
      () => { this.buildProceduralLion(); this.enter(); }
    );
  }

  buildProceduralLion() {
    const t = THEMES.neon;
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: t.body, metalness: 0.85, roughness: 0.25,
      map: this.goldTex, emissive: t.a, emissiveIntensity: 0.12, flatShading: true
    });
    this.maneMat = new THREE.MeshStandardMaterial({
      color: t.mane, metalness: 0.6, roughness: 0.3,
      emissive: t.mane, emissiveIntensity: 0.55, flatShading: true
    });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: t.eye });

    // head
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), this.bodyMat);
    this.group.add(head);

    // snout
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 6), this.bodyMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.08, 0.62);
    this.group.add(snout);

    // nose
    const nose = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), this.maneMat);
    nose.position.set(0, -0.02, 0.88);
    this.group.add(nose);

    // ears
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 5), this.bodyMat);
      ear.position.set(0.38 * s, 0.58, -0.05);
      ear.rotation.z = -0.5 * s;
      this.group.add(ear);
    }

    // glowing eyes
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), this.eyeMat);
      eye.position.set(0.26 * s, 0.14, 0.5);
      this.group.add(eye);
      this.eyes.push(eye);
    }

    // mane — ring of shards that spin with typing speed
    this.maneGroup = new THREE.Group();
    const N = 14;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.22 + Math.random() * 0.12), this.maneMat);
      shard.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, -0.18);
      shard.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.maneGroup.add(shard);
      this.maneParts.push(shard);
    }
    this.group.add(this.maneGroup);

    // outer wireframe halo
    const halo = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.35, 1),
      new THREE.MeshBasicMaterial({ color: t.a, wireframe: true, transparent: true, opacity: 0.14 })
    );
    this.group.add(halo);
    this.halo = halo;
  }

  enter() {
    this.group.scale.setScalar(0.01);
    gsap.to(this.group.scale, { x: 1, y: 1, z: 1, duration: 1.1, ease: 'elastic.out(1, 0.55)' });
  }

  setTheme(name) {
    const t = THEMES[name] || THEMES.neon;
    if (this.bodyMat) { this.bodyMat.color.setHex(t.body); this.bodyMat.emissive.setHex(t.a); }
    if (this.maneMat) { this.maneMat.color.setHex(t.mane); this.maneMat.emissive.setHex(t.mane); }
    if (this.eyeMat) this.eyeMat.color.setHex(t.eye);
    if (this.halo) this.halo.material.color.setHex(t.a);
    // real (non-procedural) model: retint its emissive glow so themes still do something
    for (const m of this.gltfMaterials) m.emissive.setHex(t.a);
  }

  /** typing intensity 0..1 */
  setIntensity(v) { this.intensity = Math.min(1, Math.max(0, v)); }

  /** quick head-shake on wrong key */
  flinch() {
    gsap.fromTo(this.group.rotation, { z: -0.09 }, { z: 0, duration: 0.35, ease: 'elastic.out(2, 0.4)' });
  }

  /** triumphant roar pulse on finish / PB */
  roar() {
    gsap.fromTo(this.group.scale, { x: 1.28, y: 1.28, z: 1.28 }, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'elastic.out(1.2, 0.4)' });
    if (this.halo) gsap.fromTo(this.halo.material, { opacity: 0.55 }, { opacity: 0.14, duration: 1.2 });
  }

  update(dt, elapsed) {
    // idle float + look around
    this.group.position.y = 1.55 + Math.sin(elapsed * 1.2) * 0.08;
    this.group.rotation.y = Math.sin(elapsed * 0.5) * 0.22;

    // mane spins faster the faster you type
    this.spin += dt * (0.25 + this.intensity * 3.2);
    if (this.maneGroup) {
      this.maneGroup.rotation.z = this.spin;
      for (const s of this.maneParts) { s.rotation.x += dt * (0.5 + this.intensity * 2); }
    }
    if (this.halo) this.halo.rotation.y = -this.spin * 0.4;
    if (this.maneMat) this.maneMat.emissiveIntensity = 0.45 + this.intensity * 0.9;
  }
}

