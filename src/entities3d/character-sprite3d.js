import * as THREE from "three";
import { createFacingState, pickRunFrame, updateFacing } from "../shared/animation.js";
import { characterForId } from "../shared/characters.js";

const textureLoader = new THREE.TextureLoader();

export const OUTLINE_COLORS = Object.freeze({
  dog: 0xf5dfc7,
  dyno: 0xf5dfc7,
});

function makeSoftShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 32, 4, 64, 32, 62);
  gradient.addColorStop(0, "rgba(16, 36, 63, 0.58)");
  gradient.addColorStop(0.58, "rgba(16, 36, 63, 0.25)");
  gradient.addColorStop(1, "rgba(16, 36, 63, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 64);
  return new THREE.CanvasTexture(canvas);
}

function makeAlphaRimMaterial(texture, color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      rimColor: { value: new THREE.Color(color) },
      rimOpacity: { value: 0.72 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec3 rimColor;
      uniform float rimOpacity;
      varying vec2 vUv;
      void main() {
        float alpha = texture2D(map, vUv).a;
        if (alpha < 0.035) discard;
        gl_FragColor = vec4(rimColor, alpha * rimOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export class CharacterSprite3D {
  constructor({ textureUrls, runFrameCount, height = 1.34, width = 2.01, baseline = 0.42, footInset = 0.095, label, characterId = "dog" }) {
    this.group = new THREE.Group();
    this.height = height;
    this.width = width;
    this.baseline = baseline;
    this.footInset = footInset;
    this.label = label;
    this.character = characterForId(characterId);
    this.outlineColor = OUTLINE_COLORS[characterId] || OUTLINE_COLORS.dog;
    this.runFrameCount = Math.min(runFrameCount, textureUrls.length - 1);
    this.lastDt = 1 / 30;
    this.deadAmount = 0;
    this.smoothMovement = 0;
    this.facingState = createFacingState(-1);

    const geometry = new THREE.PlaneGeometry(width, height);
    this.frames = textureUrls.map((textureUrl, index) => {
      const texture = textureLoader.load(
        textureUrl,
        (loaded) => {
          loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.anisotropy = 8;
          loaded.needsUpdate = true;
        },
        undefined,
        () => console.warn(`[Character] Failed to load ${label} run frame ${index + 1}.`)
      );
      texture.colorSpace = THREE.SRGBColorSpace;

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.035,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const frame = new THREE.Mesh(geometry, material);
      frame.position.y = height * 0.5 - footInset;
      frame.renderOrder = 12;
      frame.visible = index === 0;
      this.group.add(frame);
      return frame;
    });

    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: makeSoftShadowTexture(),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMaterial);
    this.shadow.scale.set(1.12, 0.28, 1);
    this.shadow.position.set(0, 0.015, -1);
    this.shadow.renderOrder = 3;
    this.group.add(this.shadow);

    // A constant-color alpha mask gives a quiet 1-2px rim at gameplay size.
    const outlineGeometry = new THREE.PlaneGeometry(width * 1.018, height * 1.018);
    this.outlines = this.frames.map((frame, index) => {
      const outline = new THREE.Mesh(
        outlineGeometry,
        makeAlphaRimMaterial(frame.material.map, this.outlineColor)
      );
      outline.renderOrder = 11;
      outline.visible = index === 0;
      this.group.add(outline);
      return outline;
    });
  }

  update(scene, sceneH, dt = null) {
    const useDt = dt === null || dt <= 0 ? this.lastDt : dt;
    if (dt !== null && dt > 0) this.lastDt = dt;
    const actor = scene.dog;
    const isGameOver = scene.state === "gameover";
    const moving = Math.max(Math.abs(actor.movement), 0);
    this.smoothMovement += (moving - this.smoothMovement) * 0.16;
    const targetFacing = actor.facing >= 0 ? 1 : -1;
    const facingUpdate = updateFacing(this.facingState, targetFacing, useDt);
    const mirrorSign = facingUpdate.mirrorSign;
    const squashY = facingUpdate.squash;
    this.facingState = { facing: mirrorSign, progress: facingUpdate.progress };

    if (isGameOver) {
      this.deadAmount = Math.min(1, (scene.gameOverElapsed || 0) * 2.1);
    } else {
      this.deadAmount = Math.max(0, this.deadAmount - 0.08);
    }

    const scale = Math.max(actor.h, 8);
    const chewOn = !isGameOver && actor.chewTimer > 0;
    const chewPhase = chewOn ? 1 - actor.chewTimer / actor.chewDuration : 0;
    const catchLift = chewOn ? Math.sin(Math.min(1, chewPhase * 2) * Math.PI) * 0.022 : 0;
    const idleBreath = !scene.reducedMotion && !isGameOver && moving < 0.06
      ? Math.sin(scene.time * 2.1) * 0.006
      : 0;

    this.group.position.set(
      actor.x,
      sceneH - actor.y - scale * this.baseline - scale * this.deadAmount * 0.045,
      2
    );
    this.group.scale.set(scale, scale, scale);

    const runFrameIndex = pickRunFrame(
      this.runFrameCount,
      actor.stepPhase,
      moving,
      isGameOver
    );
    const groundedY = this.height * 0.5 - this.footInset;
    const frameScaleY = squashY + idleBreath;
    const pivotCorrection = -(1 - frameScaleY) * this.height * 0.5 + catchLift;
    for (let index = 0; index < this.frames.length; index += 1) {
      const frame = this.frames[index];
      frame.visible = index === runFrameIndex;
      frame.scale.set(mirrorSign, frameScaleY, 1);
      frame.position.y = groundedY + pivotCorrection;
      frame.rotation.z = -mirrorSign * this.deadAmount * 0.055;
    }

    for (let index = 0; index < this.outlines.length; index += 1) {
      const outline = this.outlines[index];
      outline.visible = index === runFrameIndex;
      outline.scale.set(mirrorSign, frameScaleY, 1);
      outline.position.y = groundedY + pivotCorrection;
      outline.rotation.z = -mirrorSign * this.deadAmount * 0.055;
    }

    const airborne = runFrameIndex < this.runFrameCount
      ? [0.3, 0.48, 0.2, 0.42][runFrameIndex % 4]
      : 0;
    this.shadow.scale.set(
      1.08 + this.smoothMovement * 0.1 - airborne * 0.12,
      0.28 - airborne * 0.04,
      1
    );
    this.shadow.material.opacity = 0.25 * (1 - airborne * 0.42) * (1 - this.deadAmount * 0.25);
  }
}
