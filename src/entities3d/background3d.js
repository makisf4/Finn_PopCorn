import * as THREE from "three";

function makeSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, "#7fd4ff");
  sky.addColorStop(0.5, "#bdeaff");
  sky.addColorStop(0.78, "#eefcf3");
  sky.addColorStop(1, "#f6fff2");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 16, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCloudGroup() {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xdfe9ff),
    emissiveIntensity: 0.28,
  });
  const blobs = [
    [-0.65, 0.15, 0.55],
    [0, 0, 0.74],
    [0.7, 0.2, 0.52],
  ];
  for (const [x, y, r] of blobs) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), material);
    mesh.position.set(x, y, 0);
    mesh.scale.setScalar(r);
    group.add(mesh);
  }
  group.userData.material = material;
  return group;
}

function makeSun() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff3a8 })
  );
  core.material.toneMapped = false;
  group.add(core);

  const haloCanvas = document.createElement("canvas");
  haloCanvas.width = 256;
  haloCanvas.height = 256;
  const ctx = haloCanvas.getContext("2d");
  const glow = ctx.createRadialGradient(128, 128, 8, 128, 128, 126);
  glow.addColorStop(0, "rgba(255, 244, 176, 0.9)");
  glow.addColorStop(0.55, "rgba(255, 220, 140, 0.28)");
  glow.addColorStop(1, "rgba(255, 220, 140, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);
  const haloTexture = new THREE.CanvasTexture(haloCanvas);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    })
  );
  halo.scale.setScalar(4.6);
  group.add(halo);
  return group;
}

function makeHillPath(width, peakSeed) {
  const shape = new THREE.Shape();
  shape.moveTo(-width, 0);
  shape.quadraticCurveTo(width * (0.1 - peakSeed * 0.2), width * 0.5 * peakSeed + 40, width * 0.4, width * 0.22);
  shape.quadraticCurveTo(width * 0.85, -width * 0.1 * peakSeed, width, 0);
  shape.lineTo(width, -2600);
  shape.lineTo(-width, -2600);
  shape.closePath();
  return shape;
}

export class Background3D {
  constructor() {
    this.group = new THREE.Group();
    this.built = false;
    this.clouds = [];
    this.sun = null;
  }

  build(scene3, width, height) {
    this.disposeChildren();
    if (!(width > 0 && height > 0)) return;

    const horizonY = height * 0.175; // world y of ground top (height - groundY)

    this.sun = makeSun();
    this.sun.position.set(width * 0.84, height * 0.84, -520);
    this.sun.children[0].scale.setScalar(height * 0.075);
    this.group.add(this.sun);

    const cloudData = [
      [0.16, 0.82, 0.066, 0.95],
      [0.45, 0.88, 0.078, 0.85],
      [0.68, 0.78, 0.058, 0.92],
      [0.9, 0.9, 0.05, 0.8],
    ];
    for (const [fx, fy, fs, alpha] of cloudData) {
      const cloud = makeCloudGroup();
      cloud.userData.material.opacity = alpha;
      cloud.userData.material.transparent = true;
      cloud.scale.set(height * fs * 1.35, height * fs * 1.35, 60);
      cloud.position.set(width * fx, height * fy, -560 - (1 - alpha) * 140);
      cloud.userData.baseX = cloud.position.x;
      cloud.userData.speed = 6 + fs * 60;
      this.group.add(cloud);
      this.clouds.push(cloud);
    }

    // Back hill (far, lighter).
    const hillBackShape = makeHillPath(width * 0.62, 0.6);
    const hillBack = new THREE.Mesh(
      new THREE.ExtrudeGeometry(hillBackShape, { depth: 420, bevelEnabled: false }),
      new THREE.MeshLambertMaterial({ color: 0x8ad981 })
    );
    hillBack.position.set(width * 0.5 - width * 0.62, horizonY + 1, -780);
    hillBack.renderOrder = -1;
    this.group.add(hillBack);

    // Front hill (nearer, darker).
    const hillFrontShape = makeHillPath(width * 0.4, 0.85);
    const hillFront = new THREE.Mesh(
      new THREE.ExtrudeGeometry(hillFrontShape, { depth: 20, bevelEnabled: false }),
      new THREE.MeshLambertMaterial({ color: 0x63c169 })
    );
    hillFront.position.set(width * 0.18 - width * 0.4, horizonY + 0.4, -240);
    hillFront.renderOrder = -1;
    this.group.add(hillFront);

    // Ground slab: extends from behind the camera to the far hills so the
    // camera never sees the background plane "below" the ground.
    const groundThickness = 500;
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(width * 5, groundThickness, 1400),
      new THREE.MeshStandardMaterial({ color: 0x6cc85e, roughness: 0.95, metalness: 0 })
    );
    ground.position.set(width * 0.5, horizonY - groundThickness / 2, -450);
    ground.receiveShadow = true;
    this.group.add(ground);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(width * 5, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x8cdf6b, roughness: 0.9, metalness: 0 })
    );
    stripe.position.set(width * 0.5, horizonY + 5, -112);
    stripe.receiveShadow = true;
    this.group.add(stripe);

    // Grass tufts + flowers stay behind the gameplay line so nothing blocks the action.
    const tuftGeo = new THREE.ConeGeometry(0.7, 2.0, 5);
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0x4fa345, roughness: 1 });
    const tuftCount = 130;
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
    const tuftMatrix = new THREE.Matrix4();
    const tuftScale = new THREE.Vector3();
    const tuftQuat = new THREE.Quaternion();
    const tuftPos = new THREE.Vector3();
    for (let i = 0; i < tuftCount; i += 1) {
      const gx = (i / tuftCount) * width * 1.15 - width * 0.075 + Math.sin(i * 7.3) * 6;
      const gz = -26 - Math.abs(Math.sin(i * 3.1)) * 40;
      tuftPos.set(gx, horizonY + 0.6, gz);
      tuftQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(i * 1.7) * 0.5);
      tuftScale.setScalar(3.6 + Math.sin(i * 11.1) * 1.4);
      tuftMatrix.compose(tuftPos, tuftQuat, tuftScale);
      tufts.setMatrixAt(i, tuftMatrix);
    }
    tufts.receiveShadow = true;
    this.group.add(tufts);

    const flowerGeo = new THREE.SphereGeometry(0.7, 8, 8);
    const flowerMat = new THREE.MeshStandardMaterial({
      color: 0xfff4f9,
      roughness: 0.55,
      emissive: 0xff9fc9,
      emissiveIntensity: 0.35,
    });
    const flowerCount = 26;
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
    const stemGeo = new THREE.CylinderGeometry(0.14, 0.18, 2.4, 5);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3d8a37, roughness: 1 });
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, flowerCount);
    for (let i = 0; i < flowerCount; i += 1) {
      const gx = (i / flowerCount) * width * 1.1 + Math.sin(i * 9.4) * width * 0.06 - width * 0.05;
      const gz = -34 - Math.abs(Math.cos(i * 5.9)) * 48;
      tuftPos.set(gx, horizonY + 2.4, gz);
      tuftQuat.identity();
      tuftScale.setScalar(2.2 + Math.cos(i * 13.7) * 0.8);
      tuftMatrix.compose(tuftPos, tuftQuat, tuftScale);
      flowers.setMatrixAt(i, tuftMatrix);
      tuftPos.set(gx, horizonY + 1.0, gz);
      tuftScale.setScalar(1.6);
      tuftMatrix.compose(tuftPos, tuftQuat, tuftScale);
      stems.setMatrixAt(i, tuftMatrix);
    }
    this.group.add(flowers);
    this.group.add(stems);

    // Grass blades scattered for texture (second instanced mesh, denser).
    const bladeGeo = new THREE.ConeGeometry(0.22, 1.1, 4);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x5cb24f, roughness: 1 });
    const bladeCount = 380;
    const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, bladeCount);
    for (let i = 0; i < bladeCount; i += 1) {
      const gx = (i / bladeCount) * width * 1.25 - width * 0.125 + Math.sin(i * 2.71) * 5;
      const gz = -12 - Math.abs(Math.sin(i * 1.93)) * 90;
      tuftPos.set(gx, horizonY + 0.3, gz);
      tuftQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(i * 0.83) * 0.6);
      tuftScale.setScalar(1.6 + Math.sin(i * 5.31) * 0.8);
      tuftMatrix.compose(tuftPos, tuftQuat, tuftScale);
      blades.setMatrixAt(i, tuftMatrix);
    }
    blades.receiveShadow = true;
    this.group.add(blades);

    this.built = true;
  }

  disposeChildren() {
    while (this.group.children.length) {
      const child = this.group.children.pop();
      child.traverse?.((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
          else node.material.dispose();
        }
      });
    }
    this.clouds = [];
    this.sun = null;
    this.built = false;
  }

  update(time) {
    if (!this.built) return;
    for (const cloud of this.clouds) {
      cloud.position.x = cloud.userData.baseX + Math.sin(time * 0.03 * cloud.userData.speed) * 18;
    }
    if (this.sun) {
      this.sun.rotation.z = time * 0.02;
    }
  }
}

export { makeSkyTexture };
