import * as THREE from "three";

function makeMarqueeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff7e8";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#d8a33e";
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, 494, 110);
  ctx.fillStyle = "#d5284c";
  ctx.font = "900 62px Georgia";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("POPCORN", 256, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeCartTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#df375f";
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = "rgba(255, 244, 226, 0.92)";
  const stripes = 7;
  for (let i = 0; i < stripes; i += 1) {
    const x = (i / stripes) * 256;
    ctx.fillRect(x + 2, 6, (256 / stripes) * 0.46, 116);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeAwningTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? "#ff4f79" : "#ffffff";
    ctx.fillRect(i * 32, 0, 32, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Machine3D {
  constructor() {
    this.group = new THREE.Group();
    this.launcher = null;
    this.nozzle = null;
    this.flare = null;
    this.flareLight = null;
    this.innerPops = null;
    this.wheels = [];
    this.built = false;
  }

  build() {
    this.group.clear();
    this.wheels = [];

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe9b545, roughness: 0.35, metalness: 0.25 });
    const cartMat = new THREE.MeshStandardMaterial({ map: makeCartTexture(), roughness: 0.55 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.28,
    });

    // Cart body (striped red/cream).
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.93, 0.45, 0.6), cartMat);
    cart.position.set(0.5, 0.225, 0);
    cart.castShadow = true;
    this.group.add(cart);

    // Glass case above cart.
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.34, 0.58), glassMat);
    glass.position.set(0.5, 0.62, 0);
    this.group.add(glass);

    // Popcorn pile inside the glass.
    this.innerPops = new THREE.Group();
    const popGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const popMat = new THREE.MeshStandardMaterial({ color: 0xffe8b2, roughness: 0.8 });
    for (let i = 0; i < 18; i += 1) {
      const pop = new THREE.Mesh(popGeo, popMat);
      pop.position.set(
        0.18 + (((i * 37) % 100) / 100) * 0.64,
        0.5 + Math.sin(i * 2.1) * 0.1,
        (((i * 53) % 100) / 100 - 0.5) * 0.4
      );
      this.innerPops.add(pop);
    }
    this.group.add(this.innerPops);

    // Awning (striped).
    const awningTex = makeAwningTexture();
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.12, 0.62),
      new THREE.MeshStandardMaterial({ map: awningTex, roughness: 0.6 })
    );
    awning.position.set(0.5, 0.86, 0);
    awning.castShadow = true;
    this.group.add(awning);

    // Support poles between awning and cart.
    const poleGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.4, 8);
    for (const px of [0.1, 0.9]) {
      for (const pz of [0.22, -0.22]) {
        const pole = new THREE.Mesh(poleGeo, bodyMat);
        pole.position.set(px, 0.78, pz);
        this.group.add(pole);
      }
    }

    // Marquee sign with POPCORN lettering (front face gets the texture).
    const marqueeTex = makeMarqueeTexture();
    const marqueeFace = new THREE.MeshBasicMaterial({ map: marqueeTex });
    const marquee = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.2, 0.1),
      [bodyMat, bodyMat, bodyMat, bodyMat, marqueeFace, bodyMat]
    );
    marquee.position.set(0.5, 1.04, 0);
    marquee.castShadow = true;
    this.group.add(marquee);

    // Wheels.
    const wheelGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 20);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0xd94863, roughness: 0.5 });
    const hubGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xf6d782, metalness: 0.6, roughness: 0.3 });
    for (const wx of [0.1, 0.9]) {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      tire.rotation.x = Math.PI / 2;
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.x = Math.PI / 2;
      wheel.add(tire);
      wheel.add(hub);
      wheel.position.set(wx, 0.13, 0.28);
      wheel.castShadow = true;
      this.group.add(wheel);
      this.wheels.push(wheel);
    }

    // Launch nozzle on the left face.
    const launcher = new THREE.Group();
    launcher.position.set(0.05, 0.5, 0);
    this.launcher = launcher;
    this.group.add(launcher);

    const nozzleGroup = new THREE.Group();
    const nozzleBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.3, 14),
      new THREE.MeshStandardMaterial({ color: 0x9ca8bf, metalness: 0.7, roughness: 0.35 })
    );
    nozzleBody.rotation.z = Math.PI / 2;
    nozzleBody.position.x = -0.15;
    nozzleBody.castShadow = true;
    nozzleGroup.add(nozzleBody);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.02, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0xf6d782, metalness: 0.8, roughness: 0.25 })
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.x = -0.31;
    nozzleGroup.add(ring);
    this.nozzle = nozzleGroup;
    launcher.add(nozzleGroup);

    // Launch flare (emissive, feeds bloom) + point light.
    this.flare = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd873 })
    );
    this.flare.material.toneMapped = false;
    this.flare.position.set(-0.3, 0, 0);
    this.flare.scale.setScalar(0.001);
    launcher.add(this.flare);
    this.flareLight = new THREE.PointLight(0xffb24a, 0, 3.2, 2);
    this.flareLight.position.set(-0.3, 0, 0.3);
    launcher.add(this.flareLight);

    // Muzzle ring that pops outward on launch.
    this.muzzleRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.03, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 })
    );
    this.muzzleRing.material.toneMapped = false;
    this.muzzleRing.rotation.y = Math.PI / 2;
    this.muzzleRing.position.set(-0.32, 0, 0);
    launcher.add(this.muzzleRing);

    this.built = true;
  }

  update(machine, sceneH, time) {
    if (!this.built) return;
    const w = machine.w;
    const h = machine.h;
    this.group.position.set(machine.x, sceneH - machine.y - h, 0);
    this.group.scale.set(w, h, Math.max(34, w * 0.74));

    const piston = Math.sin(time * 14) * 0.012 + machine.firePulse * 0.09;
    if (this.launcher) {
      // Compensate for the machine's non-uniform X/Y scale so the on-screen
      // barrel angle matches the 2D renderer and trajectory.
      const screenAngle = machine.nozzleAngle || 0;
      const localAngle = Math.atan((w / h) * Math.tan(screenAngle));
      this.launcher.rotation.z = -localAngle;
      this.launcher.position.x = 0.05 + piston;
    }
    const flare = Math.min(1, machine.firePulse * 0.9);
    if (this.flare) {
      this.flare.scale.setScalar(Math.max(0.001, flare * 2.4));
    }
    if (this.flareLight) {
      this.flareLight.intensity = flare * 2.6;
    }
    if (this.muzzleRing) {
      const ringPulse = Math.min(1, machine.firePulse * 1.4);
      this.muzzleRing.scale.setScalar(1 + (1 - ringPulse) * 1.6);
      this.muzzleRing.material.opacity = ringPulse * 0.85;
    }
    if (this.innerPops) {
      this.innerPops.children.forEach((pop, i) => {
        pop.position.y = 0.5 + Math.sin(time * 2.4 + i * 1.7) * 0.035;
      });
    }
  }
}
