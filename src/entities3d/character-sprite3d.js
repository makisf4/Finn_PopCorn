import * as THREE from "three";
import { createFacingState, pickRunFrame, updateFacing } from "../shared/animation.js";
import { characterForId } from "../shared/characters.js";

const textureLoader = new THREE.TextureLoader();

// Character outline constants give us a soft rim on the silhouette so the
// black dog doesn't fill as one dark blob, and the green dyno separates
// from the green ground.
export const OUTLINE_COLORS = Object.freeze({
  dog: 0xff6c7a,
  dyno: 0xfbebd9,
});

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
      color: 0x10243f,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), shadowMaterial);
    this.shadow.scale.set(1.1, 0.22, 1);
    this.shadow.position.set(0, 0.015, -1);
    this.shadow.renderOrder = 3;
    this.group.add(this.shadow);

    // Each outline must use the same alpha-bearing texture as its frame.
    // A plain colored plane produces a visible rectangle around the sprite.
    const outlineGeometry = new THREE.PlaneGeometry(width * 1.045, height * 1.045);
    this.outlines = this.frames.map((frame, index) => {
      const outline = new THREE.Mesh(
        outlineGeometry,
        new THREE.MeshBasicMaterial({
          map: frame.material.map,
          color: this.outlineColor,
          transparent: true,
          opacity: 0.5,
          alphaTest: 0.035,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
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
    const chewBounce = chewOn ? Math.sin(chewPhase * Math.PI * 5) * 0.045 : 0;

    this.group.position.set(
      actor.x,
      sceneH - actor.y - scale * this.baseline + scale * this.deadAmount * 0.24,
      2
    );
    this.group.scale.set(scale, scale, scale);

    const runFrameIndex = pickRunFrame(
      this.runFrameCount,
      actor.stepPhase,
      moving,
      isGameOver
    );
    const bounce = chewBounce + (1 - squashY) * 0.1;
    for (let index = 0; index < this.frames.length; index += 1) {
      const frame = this.frames[index];
      frame.visible = index === runFrameIndex;
      frame.scale.set(mirrorSign, squashY + bounce, 1);
      frame.position.y = this.height * 0.5 - this.footInset + Math.abs(bounce);
      frame.rotation.z = -mirrorSign * this.deadAmount * Math.PI * 0.46;
    }

    for (let index = 0; index < this.outlines.length; index += 1) {
      const outline = this.outlines[index];
      outline.visible = index === runFrameIndex;
      outline.scale.set(mirrorSign, squashY + bounce, 1);
      outline.position.y = this.height * 0.5 - this.footInset + Math.abs(bounce);
      outline.rotation.z = -mirrorSign * this.deadAmount * Math.PI * 0.46;
    }

    this.shadow.scale.set(
      1.08 + this.smoothMovement * 0.12,
      0.22,
      1
    );
    this.shadow.material.opacity = 0.2 * (1 - this.deadAmount * 0.35);
  }
}
