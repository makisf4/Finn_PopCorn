import * as THREE from "three";

const MAX_PARTICLES = 640;

const vertexShader = `
attribute vec3 aColor;
attribute float aSize;
attribute float aRotation;
attribute float aAlpha;
attribute float aKind; // 0 = soft dot, 1 = ring
varying vec3 vColor;
varying float vAlpha;
varying float vRotation;
varying float vKind;
uniform float uScale;

void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vRotation = aRotation;
  vKind = aKind;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (uScale / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
varying vec3 vColor;
varying float vAlpha;
varying float vRotation;
varying float vKind;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float c = cos(vRotation);
  float s = sin(vRotation);
  uv = mat2(c, -s, s, c) * uv;
  float r = length(uv);
  float alpha = 0.0;
  if (vKind < 0.5) {
    alpha = smoothstep(0.5, 0.0, r);
  } else {
    alpha = smoothstep(0.5, 0.38, r) * (1.0 - smoothstep(0.24, 0.14, r));
  }
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vColor, alpha * vAlpha);
}
`;

export class Particles3D {
  constructor() {
    this.density = 1;
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);
    this.rotations = new Float32Array(MAX_PARTICLES);
    this.alphas = new Float32Array(MAX_PARTICLES);
    this.kinds = new Float32Array(MAX_PARTICLES);

    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("aColor", new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute("aRotation", new THREE.BufferAttribute(this.rotations, 1));
    this.geometry.setAttribute("aAlpha", new THREE.BufferAttribute(this.alphas, 1));
    this.geometry.setAttribute("aKind", new THREE.BufferAttribute(this.kinds, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uScale: { value: 512 } },
      transparent: true,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  setZoom(scale) {
    this.material.uniforms.uScale.value = scale;
  }

  setDensity(scale) {
    this.density = Math.max(0.1, Math.min(1, scale));
  }

  update(scene, sceneH) {
    const particles = scene.particles || [];
    const capacity = Math.max(1, Math.floor(MAX_PARTICLES * this.density));
    const count = Math.min(particles.length, capacity);
    const start = Math.max(0, particles.length - count);
    let write = 0;
    for (let i = start; i < particles.length; i += 1) {
      const p = particles[i];
      this.positions[write * 3] = p.x;
      this.positions[write * 3 + 1] = sceneH - p.y;
      this.positions[write * 3 + 2] = 0;
      const color = p._colorCache || (p._colorCache = new THREE.Color(p.color));
      this.colors[write * 3] = color.r;
      this.colors[write * 3 + 1] = color.g;
      this.colors[write * 3 + 2] = color.b;
      this.sizes[write] = p.size * 8;
      this.rotations[write] = p.rotation || 0;
      this.alphas[write] = p.alpha;
      this.kinds[write] = p.shape === "ring" ? 1 : 0;
      write += 1;
    }
    this.geometry.setDrawRange(0, write);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aRotation.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
    this.geometry.attributes.aKind.needsUpdate = true;
  }
}
