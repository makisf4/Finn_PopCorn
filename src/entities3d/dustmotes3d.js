import * as THREE from "three";

const COUNT = 90;

const vertexShader = `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uScale;
varying float vAlpha;

void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.3 + aPhase) * 6.0;
  p.y += sin(uTime * 0.22 + aPhase * 1.7) * 5.0;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aSize * (uScale / -mvPosition.z);
  vAlpha = 0.28 + 0.22 * sin(uTime * 0.6 + aPhase * 2.3);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv);
  float alpha = smoothstep(0.5, 0.0, r) * vAlpha;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(1.0, 0.98, 0.88, alpha);
}
`;

/**
 * Warm drifting dust motes for atmosphere. Cheap, GPU-animated.
 */
export class DustMotes3D {
  constructor() {
    this.density = 1;
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i += 1) {
      positions[i * 3] = Math.random();
      positions[i * 3 + 1] = Math.random();
      positions[i * 3 + 2] = Math.random();
      sizes[i] = 0.6 + Math.random() * 1.8;
      phases[i] = Math.random() * Math.PI * 2;
    }
    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uTime: { value: 0 }, uScale: { value: 512 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 1;
  }

  setZoom(scale) {
    this.material.uniforms.uScale.value = scale;
  }

  setDensity(scale) {
    this.density = Math.max(0.1, Math.min(1, scale));
    this.geometry.setDrawRange(0, Math.max(1, Math.floor(COUNT * this.density)));
  }

  layout(width, height) {
    const pos = this.geometry.attributes.position;
    for (let i = 0; i < COUNT; i += 1) {
      pos.array[i * 3] = Math.random() * width;
      pos.array[i * 3 + 1] = height * 0.2 + Math.random() * height * 0.6;
      pos.array[i * 3 + 2] = -40 - Math.random() * 120;
    }
    pos.needsUpdate = true;
  }

  update(time) {
    this.material.uniforms.uTime.value = time;
  }
}
