import * as THREE from "three";

function hexToColor(hex) {
  return new THREE.Color(hex);
}

function createPopcornGroup(theme) {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({
    color: hexToColor(theme.body),
    roughness: 0.52,
    emissive: hexToColor(theme.stroke),
    emissiveIntensity: 0.22,
  });
  const belly = new THREE.MeshStandardMaterial({
    color: hexToColor(theme.belly),
    roughness: 0.65,
    emissive: hexToColor(theme.belly),
    emissiveIntensity: 0.1,
  });
  // Clustered lumpy kernel: lobes puff in every direction, plus a warm
  // buttery under-lobe, so it reads as popcorn instead of a ball.
  const lobes = [
    { p: [-0.34, 0.14, 0.05], r: 0.62, m: body },
    { p: [0.34, 0.12, -0.05], r: 0.6, m: body },
    { p: [0.0, 0.44, 0.0], r: 0.58, m: body },
    { p: [-0.08, 0.1, 0.34], r: 0.55, m: body },
    { p: [0.12, 0.08, -0.34], r: 0.54, m: body },
    { p: [0.02, -0.32, 0.02], r: 0.5, m: belly },
  ];
  for (const lobe of lobes) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), lobe.m);
    mesh.position.fromArray(lobe.p);
    mesh.scale.setScalar(lobe.r);
    mesh.castShadow = true;
    group.add(mesh);
  }
  group.userData.materials = [body, belly];
  group.userData.themeKey = theme.body;
  return group;
}

function createCue() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffd95e,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  mat.toneMapped = false;
  // Chevron: two thin boxes forming a V near the landing point.
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.02), mat);
  left.rotation.z = Math.PI / 5;
  left.position.set(-0.15, 0, 0);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.02), mat);
  right.rotation.z = -Math.PI / 5;
  right.position.set(0.15, 0, 0);
  group.add(left);
  group.add(right);
  group.userData.material = mat;
  return group;
}

export class Popcorns3D {
  constructor() {
    this.group = new THREE.Group();
    this.meshes = new Map();
    this.cues = new Map();
  }

  update(scene, sceneH, time) {
    const seen = new Set();

    for (const popcorn of scene.popcorns) {
      seen.add(popcorn);
      let entry = this.meshes.get(popcorn);
      if (!entry) {
        entry = {
          group: createPopcornGroup(popcorn.theme),
          cue: createCue(),
        };
        this.meshes.set(popcorn, entry);
        this.group.add(entry.group);
        this.group.add(entry.cue);
      } else if (popcorn.theme && entry.group.userData.themeKey !== popcorn.theme.body) {
        // Theme changes as score milestones pass; recolor in place.
        this.#applyTheme(entry.group, popcorn.theme);
      }

      entry.group.position.set(popcorn.x, sceneH - popcorn.y, 0);
      entry.group.rotation.z = popcorn.spin;
      entry.group.rotation.x = popcorn.spinSpeed * 0.12 + Math.sin(time * 2 + popcorn.spin) * 0.2;
      entry.group.scale.setScalar(popcorn.r * 1.9);

      const assistGlow = (popcorn.assist || 0) * 0.85;
      for (const mat of entry.group.userData.materials) {
        mat.emissiveIntensity = 0.12 + assistGlow * 0.9;
      }

      const intensity = popcorn.assist || 0;
      if (intensity > 0.05) {
        entry.cue.visible = true;
        entry.cue.position.set(
          popcorn.x,
          sceneH - (scene.groundY - 0.01),
          2
        );
        entry.cue.scale.setScalar(Math.max(9, popcorn.r * 1.45) * 2.4);
        entry.cue.userData.material.opacity = 0.22 + intensity * 0.5;
        entry.cue.rotation.x = -Math.PI / 2;
      } else {
        entry.cue.visible = false;
      }
    }

    for (const [popcorn, entry] of this.meshes) {
      if (!seen.has(popcorn)) {
        this.group.remove(entry.group);
        this.group.remove(entry.cue);
        entry.group.traverse((node) => node.geometry && node.geometry.dispose());
        entry.group.userData.materials.forEach((m) => m.dispose());
        entry.cue.userData.material.dispose();
        this.meshes.delete(popcorn);
      }
    }
  }

  #applyTheme(group, theme) {
    group.userData.materials[0].color.copy(hexToColor(theme.body));
    group.userData.materials[0].emissive.copy(hexToColor(theme.stroke));
    group.userData.materials[1].color.copy(hexToColor(theme.belly));
    group.userData.materials[1].emissive.copy(hexToColor(theme.belly));
    group.userData.themeKey = theme.body;
  }

  clear() {
    for (const [, entry] of this.meshes) {
      this.group.remove(entry.group);
      this.group.remove(entry.cue);
    }
    this.meshes.clear();
  }
}
