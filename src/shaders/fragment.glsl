// LionType particle fragment shader
uniform vec3 uColorA; // primary (cyan / gold / magenta by theme)
uniform vec3 uColorB; // secondary
uniform vec3 uColorC; // accent

varying float vAlpha;
varying vec3 vColorMix;

void main() {
  // soft round sprite with glowing core
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;

  float core = smoothstep(0.5, 0.0, d);
  float glow = pow(core, 2.2);

  vec3 col = uColorA * vColorMix.x + uColorB * vColorMix.y + uColorC * vColorMix.z;
  col += vec3(1.0) * pow(core, 8.0) * 0.6; // hot white center

  gl_FragColor = vec4(col, glow * vAlpha);
}

