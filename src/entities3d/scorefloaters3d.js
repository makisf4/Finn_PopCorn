import * as THREE from "three";
import { MAX_ACTIVE_FLOATERS } from "../shared/floaters.js";

function makeTextSprite(text, opts = {}) {
  const fontSize = opts.fontSize || 64;
  const font = `900 ${fontSize}px Trebuchet MS, sans-serif`;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const pad = fontSize * 0.5;
  canvas.width = Math.ceil(metrics.width + pad * 2);
  canvas.height = Math.ceil(fontSize * 1.6);
  const finalCtx = canvas.getContext("2d");
  finalCtx.font = font;
  finalCtx.textAlign = "center";
  finalCtx.textBaseline = "middle";
  finalCtx.lineWidth = fontSize * 0.14;
  finalCtx.strokeStyle = opts.stroke || "rgba(7, 24, 56, 0.9)";
  finalCtx.strokeText(text, canvas.width / 2, canvas.height / 2);
  finalCtx.fillStyle = opts.fill || "#ffdf72";
  finalCtx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 30;
  const aspect = canvas.width / canvas.height;
  const height = opts.worldHeight || 30;
  sprite.scale.set(height * aspect, height, 1);
  return sprite;
}

/**
 * Floating +N point text that pops up where a catch happens and drifts upward.
 */
export class ScoreFloaters3D {
  constructor() {
    this.group = new THREE.Group();
    this.pool = [];
    this.active = [];
    this.lastEventId = 0;
  }

  update(scene, sceneH, dt = 0) {
    for (const event of scene.awardEvents || []) {
      if (event.id > this.lastEventId) this.spawn(event, sceneH);
      this.lastEventId = Math.max(this.lastEventId, event.id);
    }

    const elapsed = scene.state === "paused" ? 0 : Math.max(0, dt || 0);
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const f = this.active[i];
      f.life -= elapsed;
      if (f.life <= 0) {
        this.group.remove(f.sprite);
        f.sprite.material.map.dispose();
        f.sprite.material.dispose();
        this.active.splice(i, 1);
        this.pool.push(f);
        continue;
      }
      const t = 1 - f.life / f.maxLife;
      f.sprite.position.y = f.baseY + t * 46;
      f.sprite.position.x = f.baseX + Math.sin(t * Math.PI) * 6;
      f.sprite.material.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      // Pop in from tiny, then settle.
      const pop = Math.min(1, t * 6);
      const scalePulse = pop * (1 + Math.sin(t * Math.PI) * 0.22);
      f.sprite.scale.set(f.baseScaleX * scalePulse, f.baseScaleY * scalePulse, 1);
    }
  }

  spawn(event, sceneH) {
    const label = `+${event.points}`;
    const isBonus = event.kind === "bonus";
    const worldHeight = isBonus ? 46 : 40;
    const fill = isBonus ? "#ffb3d4" : "#fff8dc";
    const stroke = "rgba(7, 24, 56, 0.92)";

    let floater = this.pool.pop();
    if (!floater) {
      floater = { sprite: null, life: 0, maxLife: 0.85, baseX: 0, baseY: 0, baseScaleX: 1, baseScaleY: 1 };
    }
    if (floater.sprite) {
      floater.sprite.material.map.dispose();
      floater.sprite.material.dispose();
      this.group.remove(floater.sprite);
    }
    floater.sprite = makeTextSprite(label, { worldHeight, fill, stroke });
    floater.baseX = event.x;
    floater.baseY = sceneH - event.y;
    floater.baseScaleX = floater.sprite.scale.x;
    floater.baseScaleY = floater.sprite.scale.y;
    floater.life = floater.maxLife;
    floater.sprite.position.set(floater.baseX, floater.baseY, 0);
    floater.sprite.scale.setScalar(0.001); // start tiny, pop in
    this.group.add(floater.sprite);
    this.active.push(floater);

    while (this.active.length > MAX_ACTIVE_FLOATERS) {
      const evicted = this.active.splice(0, 1)[0];
      if (evicted) {
        this.group.remove(evicted.sprite);
        evicted.sprite.material.map.dispose();
        evicted.sprite.material.dispose();
        this.pool.push(evicted);
      }
    }
  }
}
