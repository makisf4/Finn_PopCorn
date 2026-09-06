import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { Background3D, makeSkyTexture } from "./entities3d/background3d.js";
import { Machine3D } from "./entities3d/machine3d.js";
import { Popcorns3D } from "./entities3d/popcorn3d.js";
import { Dog3D } from "./entities3d/dog3d.js?v=20260906-33";
import { Dyno3D } from "./entities3d/dyno3d.js?v=20260906-33";
import { Bonus3D } from "./entities3d/bonus3d.js";
import { Particles3D } from "./entities3d/particles3d.js";
import { Overlay2D } from "./entities3d/overlay2d.js";
import { ScoreFloaters3D } from "./entities3d/scorefloaters3d.js";
import { DustMotes3D } from "./entities3d/dustmotes3d.js";

import { getQuality, computeAutoQuality } from "./shared/quality.js?v=20260906-33";

const FOV_DEG = 50;

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.qualityChoice = "auto";
    this.qualityResolved = "auto";
    this.fpsHistory = [];
    this.fpsTrackerEnabled = true;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = makeSkyTexture();
    this.scene.fog = new THREE.Fog(0xd6f2ff, 1100, 2400);

    this.camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 10, 2400);
    this.camera.position.set(0, 0, 100);

    this.#setupLights();

    this.background = new Background3D();
    this.scene.add(this.background.group);
    this.machine = new Machine3D();
    this.machine.build();
    this.scene.add(this.machine.group);
    this.dog = null;
    this.dyno = null;
    this.popcorns = new Popcorns3D();
    this.scene.add(this.popcorns.group);
    this.bonus = new Bonus3D();
    this.scene.add(this.bonus.group);
    this.particles = new Particles3D();
    this.scene.add(this.particles.points);
    this.scoreFloaters = new ScoreFloaters3D();
    this.scene.add(this.scoreFloaters.group);
    this.dustMotes = new DustMotes3D();
    this.scene.add(this.dustMotes.points);

    this.overlay = new Overlay2D(canvas.parentElement || document.body);

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.24, 0.58, 0.94);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.outputPass);

    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.requestedDpr = 1;
    this.cameraDistance = 100;
    this.cx = 0;
    this.cy = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.baseCamX = 0;
    this.baseCamY = 0;
  }

  #setupLights() {
    const hemi = new THREE.HemisphereLight(0xd6efff, 0x9fdb7e, 1.15);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d4, 2.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0001;
    sun.shadow.normalBias = 0.02;
    sun.position.set(400, 700, 350);
    this.sunLight = sun;
    this.scene.add(sun);
    this.scene.add(sun.target);

    const fill = new THREE.DirectionalLight(0x9fc4ff, 0.75);
    fill.position.set(-500, 300, 400);
    this.scene.add(fill);
  }

  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    this.requestedDpr = dpr;
    const effectiveDpr = Math.min(dpr, this.#resolveQuality().dprCap);
    this.dpr = effectiveDpr;
    this.renderer.setPixelRatio(effectiveDpr);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(effectiveDpr);
    this.composer.setSize(width, height);

    this.bloom.enabled = this.#resolveQuality().bloom > 0;
    this.bloom.strength = this.#resolveQuality().bloom;

    this.camera.aspect = width / height;
    this.cx = width / 2;
    this.cy = height / 2;
    this.cameraDistance = (height * 0.5) / Math.tan(THREE.MathUtils.degToRad(FOV_DEG * 0.5));
    this.camera.position.set(this.cx, this.cy, this.cameraDistance);
    this.camera.lookAt(this.cx, this.cy, 0);
    this.camera.updateProjectionMatrix();

    const shadowSize = this.#resolveQuality().shadowMapSize;
    this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);

    // Shadow camera framing covers the whole scene.
    const lightCam = this.sunLight.shadow.camera;
    lightCam.left = -width * 0.65;
    lightCam.right = width * 0.65;
    lightCam.top = height * 0.65;
    lightCam.bottom = -height * 0.65;
    lightCam.near = 10;
    lightCam.far = 1600;
    this.sunLight.shadow.camera.updateProjectionMatrix();

    // Fog depths relative to camera distance.
    this.scene.fog.near = this.cameraDistance + 150;
    this.scene.fog.far = this.cameraDistance + 1350;

    this.particles.setZoom((height * effectiveDpr) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV_DEG * 0.5))));
    this.dustMotes.setZoom((height * effectiveDpr) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV_DEG * 0.5))));
    this.dustMotes.layout(width, height);

    this.background.build(this.scene, width, height);
    this.overlay.resize(width, height, effectiveDpr);
  }

  render(scene) {
    if (this.width <= 0 || this.height <= 0) return;

    const reducedMotion = Boolean(scene.reducedMotion);
    const effectiveBloom = reducedMotion ? 0 : this.#resolveQuality().bloom;
    this.bloom.enabled = effectiveBloom > 0;
    this.bloom.strength = effectiveBloom;
    if (scene.dt) this.#trackFps(scene.dt);

    const shake = reducedMotion ? 0 : scene.shake;

    if (shake > 0.01) {
      this.shakeX = (Math.random() - 0.5) * shake * 2;
      this.shakeY = (Math.random() - 0.5) * shake * 1.3;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    this.camera.position.set(this.cx + this.shakeX, this.cy - this.shakeY, this.cameraDistance);
    this.camera.lookAt(this.cx + this.shakeX, this.cy - this.shakeY, 0);

    this.background.update(reducedMotion ? 0 : scene.time);
    this.machine.update(scene.machine, this.height, scene.time);
    this.popcorns.update(scene, this.height, scene.time);
    const useDyno = scene.character === "dyno";
    this.#ensureCharacter(useDyno);
    if (useDyno) {
      this.dyno.update(scene, this.height, scene.dt);
    } else {
      this.dog.update(scene, this.height, scene.dt);
    }
    this.bonus.update(scene, this.height);
    this.particles.update(scene, this.height);
    this.scoreFloaters.update(scene, this.height, scene.dt);
    this.dustMotes.update(reducedMotion ? 0 : scene.time);
    this.overlay.render(scene);

    this.composer.render();
  }

  #ensureCharacter(useDyno) {
    if (useDyno && !this.dyno) {
      this.dyno = new Dyno3D();
      this.scene.add(this.dyno.group);
    }
    if (!useDyno && !this.dog) {
      this.dog = new Dog3D();
      this.scene.add(this.dog.group);
    }
    if (this.dog) this.dog.group.visible = !useDyno;
    if (this.dyno) this.dyno.group.visible = useDyno;
  }

  #trackFps(delta) {
    if (!this.fpsTrackerEnabled || this.qualityChoice !== "auto") return;
    this.fpsHistory.push(delta);
    if (this.fpsHistory.length > 60) this.fpsHistory.shift();
    if (this.fpsHistory.length === 60) {
      const avgFps = 1 / (this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
      const nextQuality = computeAutoQuality(avgFps);
      if (nextQuality !== this.qualityResolved) {
        this.qualityResolved = nextQuality;
        this.#applyQuality();
      }
    }
  }

  #resolveQuality() {
    const resolved = this.qualityChoice === "auto" ? this.qualityResolved : this.qualityChoice;
    return getQuality(resolved);
  }

  setQuality(choice) {
    this.qualityChoice = choice === "high" || choice === "low" ? choice : "auto";
    if (this.qualityChoice !== "auto") {
      this.qualityResolved = this.qualityChoice;
    } else {
      this.qualityResolved = "auto";
      this.fpsHistory.length = 0;
    }
    this.#applyQuality();
  }

  #applyQuality() {
    const effective = this.#resolveQuality();
    this.bloom.enabled = effective.bloom > 0;
    this.bloom.strength = effective.bloom;
    this.sunLight.shadow.mapSize.set(effective.shadowMapSize, effective.shadowMapSize);
    this.particles.setDensity(effective.particleScale);
    this.dustMotes.setDensity(effective.particleScale);
    if (this.width > 0 && this.height > 0) {
      const effectiveDpr = Math.min(this.requestedDpr, effective.dprCap);
      if (effectiveDpr !== this.dpr) {
        this.dpr = effectiveDpr;
        this.renderer.setPixelRatio(effectiveDpr);
        this.composer.setPixelRatio(effectiveDpr);
        this.renderer.setSize(this.width, this.height, false);
        this.composer.setSize(this.width, this.height);
        this.overlay.resize(this.width, this.height, effectiveDpr);
      }
    }
  }
}
