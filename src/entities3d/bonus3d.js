import * as THREE from "three";

function makeBirdMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0a0e16, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), bodyMat);
  body.scale.set(1.35, 0.85, 0.85);
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), bodyMat);
  head.position.set(0.24, 0.1, 0);
  group.add(head);

  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.2, 8),
    new THREE.MeshStandardMaterial({ color: 0xf2b35f, roughness: 0.5 })
  );
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.44, 0.08, 0);
  group.add(beak);

  const tailGeo = new THREE.ConeGeometry(0.09, 0.3, 8);
  const tail = new THREE.Mesh(tailGeo, bodyMat);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.36, 0.05, 0);
  group.add(tail);

  const wings = [];
  for (const zSign of [1, -1]) {
    const wingPivot = new THREE.Group();
    wingPivot.position.set(0, 0.1, zSign * 0.11);
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.035, 0.3),
      bodyMat
    );
    wing.position.set(0, 0, zSign * 0.16);
    wingPivot.add(wing);
    group.add(wingPivot);
    wings.push(wingPivot);
  }
  group.userData.wings = wings;
  return group;
}

function makeLollipop() {
  const group = new THREE.Group();
  const candyMat = new THREE.MeshStandardMaterial({
    color: 0xff79b8,
    roughness: 0.35,
    emissive: 0xff4d9a,
    emissiveIntensity: 0.45,
  });
  const candy = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), candyMat);
  candy.castShadow = true;
  group.add(candy);

  const swirlTex = makeSwirlTexture();
  const swirl = new THREE.Mesh(
    new THREE.SphereGeometry(1.005, 18, 14),
    new THREE.MeshStandardMaterial({
      map: swirlTex,
      transparent: true,
      roughness: 0.3,
      emissive: 0xffffff,
      emissiveIntensity: 0.08,
    })
  );
  group.add(swirl);

  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 2.6, 8),
    new THREE.MeshStandardMaterial({ color: 0xf7f3e8, roughness: 0.4 })
  );
  stick.position.set(0, -2.1, 0);
  group.add(stick);
  group.userData.materials = [candyMat, swirl.material];
  return group;
}

function makeSwirlTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  for (let r = 60; r > 8; r -= 14) {
    ctx.beginPath();
    ctx.arc(64, 64, r, Math.PI * 0.2, Math.PI * (0.2 + (60 - r) * 0.055));
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Bonus3D {
  constructor() {
    this.group = new THREE.Group();
    this.birdMeshes = new Map();
    this.dropMeshes = new Map();
  }

  update(scene, sceneH) {
    const seenBirds = new Set();
    for (const bird of scene.bonusBirds || []) {
      seenBirds.add(bird);
      let mesh = this.birdMeshes.get(bird);
      if (!mesh) {
        mesh = makeBirdMesh();
        mesh.scale.set(bird.w * 0.9, bird.h * 1.4, bird.w * 0.7);
        this.birdMeshes.set(bird, mesh);
        this.group.add(mesh);
      }
      mesh.position.set(bird.x, sceneH - bird.y, 0);
      mesh.rotation.y = bird.vx >= 0 ? 0 : Math.PI;
      const flap = Math.sin(bird.wingPhase || 0) * 0.85;
      const wings = mesh.userData.wings;
      if (wings) {
        wings[0].rotation.x = -flap;
        wings[1].rotation.x = flap;
      }
    }
    for (const [bird, mesh] of this.birdMeshes) {
      if (!seenBirds.has(bird)) {
        this.group.remove(mesh);
        mesh.traverse((n) => n.geometry && n.geometry.dispose());
        this.birdMeshes.delete(bird);
      }
    }

    const seenDrops = new Set();
    for (const drop of scene.bonusDrops || []) {
      seenDrops.add(drop);
      let mesh = this.dropMeshes.get(drop);
      if (!mesh) {
        mesh = makeLollipop();
        mesh.scale.setScalar(drop.r);
        this.dropMeshes.set(drop, mesh);
        this.group.add(mesh);
      }
      mesh.position.set(drop.x, sceneH - drop.y, 0);
      mesh.rotation.z = (drop.spin || 0);
      mesh.rotation.y = Math.sin(drop.spin || 0) * 0.4;
    }
    for (const [drop, mesh] of this.dropMeshes) {
      if (!seenDrops.has(drop)) {
        this.group.remove(mesh);
        mesh.traverse((n) => n.geometry && n.geometry.dispose());
        this.dropMeshes.delete(drop);
      }
    }
  }
}
