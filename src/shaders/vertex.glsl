// LionType particle vertex shader
uniform float uTime;
uniform float uSpeed;      // typing intensity 0..1
uniform float uPixelRatio;

attribute float aScale;
attribute float aRandom;
attribute vec3 aColorMix;

varying float vAlpha;
varying vec3 vColorMix;

void main() {
  vec3 pos = position;

  // slow orbital drift, accelerated by typing speed
  float t = uTime * (0.15 + uSpeed * 0.85);
  float angle = t * (0.2 + aRandom * 0.5) + aRandom * 6.2831;
  pos.x += sin(angle + pos.y * 0.35) * (0.6 + aRandom);
  pos.y += cos(angle * 0.8 + aRandom * 10.0) * 0.45;
  pos.z += sin(angle * 0.6 + aRandom * 4.0) * 0.5;

  // gentle upward stream
  pos.y = mod(pos.y + uTime * (0.25 + uSpeed * 1.4) * (0.4 + aRandom * 0.6) + 12.0, 24.0) - 12.0;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float size = aScale * (1.0 + uSpeed * 1.6);
  gl_PointSize = size * uPixelRatio * (280.0 / -mvPosition.z);

  // fade with depth and randomness, pulse with time
  vAlpha = (0.35 + 0.65 * sin(uTime * (1.0 + aRandom * 3.0) + aRandom * 20.0)) * smoothstep(-24.0, -4.0, mvPosition.z);
  vColorMix = aColorMix;
}

