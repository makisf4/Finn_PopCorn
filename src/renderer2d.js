import {
  COUNTDOWN_DURATION,
  getCountdownNumber,
  shouldShowBonusBirdAlert,
} from "./shared/gameplay.js?v=20260903-31";
import {
  createFacingState,
  pickRunFrame,
  updateFacing,
} from "./shared/animation.js?v=20260903-31";
import { clamp } from "./utils.js?v=20260903-31";

export class Renderer2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.dogAnimations = null;
    this.fallbackNeeded = false;
    this.characterArt = this.#loadCharacterArt();
    this.facingState = createFacingState(-1);
    this.backgroundLayer = null;
    this.groundLayer = null;
  }

  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.backgroundLayer = null;
    this.groundLayer = null;
  }

  render(scene) {
    const { ctx } = this;
    if (!ctx) return;

    ctx.save();

    if (scene.shake > 0.01) {
      const amount = scene.shake;
      ctx.translate((Math.random() - 0.5) * amount * 2, (Math.random() - 0.5) * amount * 1.3);
    }

    this.#drawBackground(scene);

    for (const bird of scene.bonusBirds || []) {
      this.#drawBonusBird(bird);
    }

    this.#drawMachine(scene);

    for (const popcorn of scene.popcorns) {
      this.#drawPopcorn(popcorn);
    }

    for (const popcorn of scene.popcorns) {
      this.#drawAssistCue(popcorn, scene.groundY);
    }

    for (const drop of scene.bonusDrops || []) {
      this.#drawBonusDrop(drop);
    }

    for (const particle of scene.particles) {
      this.#drawParticle(particle);
    }

    this.#drawDog(scene);
    this.#drawGround(scene);
    this.#drawGameOverFx(scene);
    this.#drawCountdown(scene);

    ctx.restore();
  }

  #drawBackground(scene) {
    const { ctx } = this;
    if (this.width <= 0 || this.height <= 0) return;

    if (!this.backgroundLayer) {
      this.backgroundLayer = this.#buildBackgroundLayer();
    }
    ctx.drawImage(this.backgroundLayer, 0, 0, this.width, this.height);

    const stripeOffset = (scene.time * 18) % 36;
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#ffffff";
    for (let x = -40; x < this.width + 60; x += 36) {
      ctx.fillRect(x + stripeOffset, scene.groundY + 10, 20, this.height - scene.groundY - 8);
    }
    ctx.globalAlpha = 1;
  }

  #buildBackgroundLayer() {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(this.width * this.dpr));
    canvas.height = Math.max(1, Math.floor(this.height * this.dpr));
    const bgCtx = canvas.getContext("2d", { alpha: false });
    bgCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const sky = bgCtx.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0, "#88ddff");
    sky.addColorStop(0.56, "#c9f0ff");
    sky.addColorStop(1, "#f2fff8");
    bgCtx.fillStyle = sky;
    bgCtx.fillRect(0, 0, this.width, this.height);

    const sunX = this.width * 0.16;
    const sunY = this.height * 0.16;
    const glow = bgCtx.createRadialGradient(sunX, sunY, 10, sunX, sunY, this.height * 0.17);
    glow.addColorStop(0, "rgba(255, 244, 164, 0.95)");
    glow.addColorStop(1, "rgba(255, 244, 164, 0)");
    bgCtx.fillStyle = glow;
    bgCtx.beginPath();
    bgCtx.arc(sunX, sunY, this.height * 0.17, 0, Math.PI * 2);
    bgCtx.fill();

    this.#drawCloud(bgCtx, this.width * 0.16, this.height * 0.18, this.height * 0.06, 0.95);
    this.#drawCloud(bgCtx, this.width * 0.45, this.height * 0.12, this.height * 0.07, 0.85);
    this.#drawCloud(bgCtx, this.width * 0.68, this.height * 0.22, this.height * 0.055, 0.92);

    const hillBack = bgCtx.createLinearGradient(0, this.height * 0.56, 0, this.height * 0.88);
    hillBack.addColorStop(0, "#77d677");
    hillBack.addColorStop(1, "#57b85a");

    bgCtx.fillStyle = hillBack;
    bgCtx.beginPath();
    bgCtx.moveTo(0, this.height * 0.66);
    bgCtx.quadraticCurveTo(this.width * 0.2, this.height * 0.54, this.width * 0.41, this.height * 0.67);
    bgCtx.quadraticCurveTo(this.width * 0.56, this.height * 0.74, this.width * 0.74, this.height * 0.6);
    bgCtx.quadraticCurveTo(this.width * 0.88, this.height * 0.5, this.width, this.height * 0.67);
    bgCtx.lineTo(this.width, this.height);
    bgCtx.lineTo(0, this.height);
    bgCtx.closePath();
    bgCtx.fill();

    return canvas;
  }

  #drawGround(scene) {
    const { ctx } = this;
    if (this.width <= 0 || this.height <= 0) return;

    const groundY = scene.groundY;
    if (!this.groundLayer || this.groundLayer.groundY !== groundY) {
      this.groundLayer = this.#buildGroundLayer(groundY);
    }

    ctx.drawImage(
      this.groundLayer.canvas,
      0,
      this.groundLayer.top,
      this.width,
      this.groundLayer.height
    );
  }

  #buildGroundLayer(groundY) {
    const top = groundY - 8;
    const layerHeight = Math.max(1, this.height - top);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(this.width * this.dpr));
    canvas.height = Math.max(1, Math.floor(layerHeight * this.dpr));
    const layerCtx = canvas.getContext("2d");
    layerCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    layerCtx.translate(0, -top);

    const turf = layerCtx.createLinearGradient(0, groundY - 15, 0, this.height);
    turf.addColorStop(0, "#85df64");
    turf.addColorStop(1, "#4aa248");
    layerCtx.fillStyle = turf;
    layerCtx.fillRect(0, groundY, this.width, this.height - groundY);

    layerCtx.strokeStyle = "rgba(28, 84, 27, 0.35)";
    layerCtx.lineWidth = 2;
    for (let x = -14; x < this.width + 20; x += 24) {
      layerCtx.beginPath();
      layerCtx.moveTo(x, groundY + 6);
      layerCtx.quadraticCurveTo(x + 10, groundY - 8, x + 20, groundY + 6);
      layerCtx.stroke();
    }

    return { canvas, top, height: layerHeight, groundY };
  }

  #drawCloud(ctx, x, y, size, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-size * 0.65, size * 0.15, size * 0.55, 0, Math.PI * 2);
    ctx.arc(0, 0, size * 0.74, 0, Math.PI * 2);
    ctx.arc(size * 0.7, size * 0.2, size * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  #drawMachine(scene) {
    const { ctx } = this;
    const machine = scene.machine;
    const x = machine.x;
    const y = machine.y;
    const w = machine.w;
    const h = machine.h;

    ctx.save();

    const gold = ctx.createLinearGradient(0, y - h * 0.22, 0, y + h * 0.9);
    gold.addColorStop(0, "#f9d982");
    gold.addColorStop(0.5, "#d8a33e");
    gold.addColorStop(1, "#bb7f2c");

    const stripeBody = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h);
    stripeBody.addColorStop(0, "#ff7291");
    stripeBody.addColorStop(1, "#df375f");

    const cartLeft = x + w * 0.03;
    const cartTop = y + h * 0.54;
    const cartW = w * 0.93;
    const cartH = h * 0.45;
    this.#roundedRect(cartLeft, cartTop, cartW, cartH, 12);
    ctx.fillStyle = stripeBody;
    ctx.fill();
    ctx.strokeStyle = "#8f2d45";
    ctx.lineWidth = 2.4;
    ctx.stroke();

    const stripeCount = 7;
    for (let i = 0; i < stripeCount; i += 1) {
      const stripeW = cartW / stripeCount;
      const sx = cartLeft + i * stripeW;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255, 244, 226, 0.88)" : "rgba(255, 87, 128, 0.68)";
      ctx.fillRect(sx, cartTop + 2, stripeW * 0.48, cartH - 4);
    }

    const glassX = x + w * 0.12;
    const glassY = y + h * 0.27;
    const glassW = w * 0.74;
    const glassH = h * 0.34;
    this.#roundedRect(glassX, glassY, glassW, glassH, 9);
    const glass = ctx.createLinearGradient(glassX, glassY, glassX + glassW, glassY + glassH);
    glass.addColorStop(0, "rgba(255, 255, 255, 0.72)");
    glass.addColorStop(0.6, "rgba(255, 246, 231, 0.42)");
    glass.addColorStop(1, "rgba(255, 255, 255, 0.24)");
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 246, 231, 0.92)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffe8b2";
    const popBaseY = glassY + glassH * 0.84;
    ctx.beginPath();
    ctx.moveTo(glassX + 5, popBaseY);
    ctx.quadraticCurveTo(glassX + glassW * 0.4, popBaseY - glassH * 0.28, glassX + glassW * 0.74, popBaseY);
    ctx.lineTo(glassX + glassW - 5, glassY + glassH - 4);
    ctx.lineTo(glassX + 4, glassY + glassH - 4);
    ctx.closePath();
    ctx.fill();

    const puffs = 24;
    for (let i = 0; i < puffs; i += 1) {
      const px = glassX + 12 + (i / (puffs - 1)) * (glassW - 24) + Math.sin(i * 2.7 + scene.time) * 1.6;
      const py = popBaseY - (Math.sin(i * 1.13) * 0.5 + 0.5) * glassH * 0.17;
      const pr = w * (0.016 + (i % 3) * 0.0023);
      ctx.fillStyle = i % 2 === 0 ? "#fff7de" : "#ffe9ba";
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(226, 176, 94, 0.45)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    const awningY = y + h * 0.2;
    const awningH = h * 0.12;
    this.#roundedRect(x + w * 0.06, awningY, w * 0.86, awningH, 10);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#ab3b54";
    ctx.lineWidth = 2;
    ctx.stroke();

    const awningStripes = 8;
    for (let i = 0; i < awningStripes; i += 1) {
      const sw = (w * 0.86) / awningStripes;
      const sx = x + w * 0.06 + i * sw;
      if (i % 2 === 0) {
        ctx.fillStyle = "#ff4f79";
        ctx.fillRect(sx + sw * 0.1, awningY + 1, sw * 0.8, awningH - 2);
      }
    }

    const marqueeX = x + w * 0.08;
    const marqueeY = y - h * 0.1;
    const marqueeW = w * 0.84;
    const marqueeH = h * 0.2;
    this.#roundedRect(marqueeX, marqueeY, marqueeW, marqueeH, 13);
    ctx.fillStyle = "#fff7e8";
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.fillStyle = "#d5284c";
    ctx.font = `${Math.max(11, w * 0.17)}px Georgia`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("POPCORN", marqueeX + marqueeW * 0.5, marqueeY + marqueeH * 0.57);

    const poleW = w * 0.055;
    ctx.fillStyle = gold;
    ctx.fillRect(glassX - poleW * 0.6, awningY + awningH * 0.55, poleW, cartTop - (awningY + awningH * 0.55));
    ctx.fillRect(glassX + glassW - poleW * 0.4, awningY + awningH * 0.55, poleW, cartTop - (awningY + awningH * 0.55));

    const wheelR = w * 0.14;
    const wheelX = x + w * 0.13;
    const wheelY = cartTop + cartH - wheelR * 0.22;
    ctx.fillStyle = "#d94863";
    ctx.beginPath();
    ctx.arc(wheelX, wheelY, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7f2338";
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.strokeStyle = "#f6d782";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + scene.time * 0.25;
      ctx.beginPath();
      ctx.moveTo(wheelX, wheelY);
      ctx.lineTo(wheelX + Math.cos(a) * wheelR * 0.78, wheelY + Math.sin(a) * wheelR * 0.78);
      ctx.stroke();
    }

    const recoil = Math.sin(scene.time * 14) * 0.8 + machine.firePulse * 3.2;
    const nozzleAngle = machine.nozzleAngle || 0;
    const popperW = w * 0.3;
    const popperH = h * 0.1;
    const popperBaseX = x + w * 0.05;
    const popperBaseY = y + h * 0.5;

    ctx.save();
    ctx.translate(
      popperBaseX + Math.cos(nozzleAngle) * recoil,
      popperBaseY + Math.sin(nozzleAngle) * recoil
    );
    ctx.rotate(nozzleAngle);
    this.#roundedRect(-popperW, -popperH * 0.5, popperW, popperH, 7);
    const popperGrad = ctx.createLinearGradient(-popperW, 0, 0, 0);
    popperGrad.addColorStop(0, "#f8f7fb");
    popperGrad.addColorStop(1, "#9ca8bf");
    ctx.fillStyle = popperGrad;
    ctx.fill();
    ctx.strokeStyle = "#687590";
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();

    const flame = clamp(machine.firePulse * 0.9, 0, 1);
    if (flame > 0.01) {
      ctx.globalAlpha = flame * 0.55;
      ctx.fillStyle = "#ffde7a";
      ctx.beginPath();
      ctx.ellipse(
        machine.nozzleX - Math.cos(nozzleAngle) * 6,
        machine.nozzleY - Math.sin(nozzleAngle) * 6,
        h * 0.16,
        h * 0.12,
        nozzleAngle,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  #drawPopcorn(popcorn) {
    const { ctx } = this;
    const r = popcorn.r;
    const theme = popcorn.theme || {
      body: "#fffef5",
      stroke: "#f7e5bf",
      belly: "#fff6d8",
    };

    ctx.save();
    ctx.translate(popcorn.x, popcorn.y);
    ctx.rotate(popcorn.spin);

    const assistGlow = popcorn.assist * 0.22;
    if (assistGlow > 0.01) {
      ctx.globalAlpha = assistGlow;
      ctx.fillStyle = "#fff4b5";
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = theme.body;
    ctx.beginPath();
    ctx.arc(-r * 0.32, r * 0.1, r * 0.56, 0, Math.PI * 2);
    ctx.arc(r * 0.32, r * 0.1, r * 0.56, 0, Math.PI * 2);
    ctx.arc(0, -r * 0.2, r * 0.62, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = theme.stroke;
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.stroke();

    ctx.fillStyle = theme.belly;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.44, r * 0.4, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  #drawAssistCue(popcorn, groundY) {
    const intensity = popcorn.assist || 0;
    if (intensity <= 0.05) return;

    const { ctx } = this;
    const tickHeight = clamp(9 + intensity * 7, 9, 16);
    const topY = groundY - tickHeight;
    const halfW = Math.max(12, popcorn.r * 1.45);

    ctx.save();
    ctx.globalAlpha = 0.28 + intensity * 0.42;
    ctx.strokeStyle = "#ffd95e";
    ctx.lineWidth = Math.max(1.6, popcorn.r * 0.24);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(popcorn.x - halfW, topY);
    ctx.lineTo(popcorn.x, groundY - 2);
    ctx.lineTo(popcorn.x + halfW, topY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(popcorn.x, topY);
    ctx.lineTo(popcorn.x, topY - 5);
    ctx.stroke();
    ctx.restore();
  }

  #drawBonusBird(bird) {
    const { ctx } = this;
    const dir = bird.vx >= 0 ? 1 : -1;
    const wingLift = Math.sin(bird.wingPhase || 0) * bird.h * 0.24;

    ctx.save();
    ctx.translate(bird.x, bird.y);
    if (dir < 0) {
      ctx.scale(-1, 1);
    }

    ctx.fillStyle = "#0a0e16";
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.w * 0.27, bird.h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-bird.w * 0.06, -bird.h * 0.02);
    ctx.quadraticCurveTo(-bird.w * 0.36, -bird.h * 0.2 - wingLift, -bird.w * 0.24, bird.h * 0.12);
    ctx.quadraticCurveTo(-bird.w * 0.08, bird.h * 0.08, -bird.w * 0.06, -bird.h * 0.02);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bird.w * 0.02, -bird.h * 0.05);
    ctx.quadraticCurveTo(-bird.w * 0.14, -bird.h * 0.28 - wingLift * 0.8, bird.w * 0.02, -bird.h * 0.18);
    ctx.quadraticCurveTo(bird.w * 0.12, -bird.h * 0.1, bird.w * 0.02, -bird.h * 0.05);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(bird.w * 0.24, -bird.h * 0.08, bird.w * 0.13, bird.h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f2b35f";
    ctx.beginPath();
    ctx.moveTo(bird.w * 0.33, -bird.h * 0.06);
    ctx.lineTo(bird.w * 0.44, -bird.h * 0.02);
    ctx.lineTo(bird.w * 0.33, bird.h * 0.01);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    this.#drawBonusBirdAlert(bird);
  }

  #drawBonusBirdAlert(bird) {
    if (!shouldShowBonusBirdAlert(bird)) return;

    const { ctx } = this;
    const y = bird.y - bird.h * 1.45;

    ctx.save();
    ctx.font = `bold ${Math.round(clamp(bird.h * 1.6, 18, 42))}px Georgia`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = Math.max(3, bird.h * 0.3);
    ctx.strokeStyle = "rgba(4, 26, 48, 0.9)";
    ctx.strokeText("!", bird.x, y);
    ctx.fillStyle = "#ff4236";
    ctx.fillText("!", bird.x, y);
    ctx.restore();
  }

  #drawBonusDrop(drop) {
    const { ctx } = this;
    const r = drop.r;

    ctx.save();
    ctx.translate(drop.x, drop.y);
    ctx.rotate(drop.spin || 0);

    ctx.strokeStyle = "#f7f3e8";
    ctx.lineWidth = Math.max(2, r * 0.22);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, r * 0.5);
    ctx.lineTo(0, r * 1.95);
    ctx.stroke();

    const candy = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 1.05);
    candy.addColorStop(0, "#ffe8f6");
    candy.addColorStop(0.52, "#ff83bb");
    candy.addColorStop(1, "#ff4e98");
    ctx.fillStyle = candy;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = Math.max(1.2, r * 0.12);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, -Math.PI * 0.95, Math.PI * 1.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, -Math.PI * 0.9, Math.PI * 1.1);
    ctx.stroke();

    ctx.restore();
  }

  #drawParticle(particle) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = particle.alpha;
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation || 0);

    if (particle.shape === "ring") {
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = particle.size * 0.22;
      ctx.beginPath();
      ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  #createDogAnimations() {
    const buildNames = (prefix, count) => Array.from({ length: count }, (_, i) => `${prefix} (${i + 1}).png`);
    const animations = {
      idle: [],
      run: [],
      dead: [],
      fps: {
        idle: 8,
        run: 12,
        dead: 10,
      },
      originX: 0.52,
      originY: 0.93,
    };

    for (const fileName of buildNames("Idle", 10)) {
      this.#loadDogFrame(fileName, animations.idle);
    }
    for (const fileName of buildNames("Run", 8)) {
      this.#loadDogFrame(fileName, animations.run);
    }
    for (const fileName of buildNames("Dead", 8)) {
      this.#loadDogFrame(fileName, animations.dead);
    }

    return animations;
  }

  #loadCharacterArt() {
    const load = (fileName) => {
      const image = new Image();
      const art = { image, loaded: false };
      image.decoding = "async";
      image.addEventListener("load", () => {
        art.loaded = true;
      });
      image.addEventListener("error", () => {
        console.warn(`[Character] Failed to load artwork: ${fileName}`);
      });
      image.src = new URL(`../assets/sprites/${fileName}`, import.meta.url).href;
      return art;
    };

    return {
      dog: [
        load("finn-dog-run-v2-01-aligned.webp"),
        load("finn-dog-run-v2-02-aligned.webp"),
        load("finn-dog-run-v2-03-aligned.webp"),
        load("finn-dog-run-v2-04-aligned.webp"),
        load("finn-dog-3d-idle.webp"),
      ],
      dyno: [
        load("finn-dyno-run-v2-01-aligned.webp"),
        load("finn-dyno-run-v2-02-aligned.webp"),
        load("finn-dyno-run-v2-03-aligned.webp"),
        load("finn-dyno-run-v2-04-aligned.webp"),
        load("finn-dyno-idle-v2.webp"),
      ],
    };
  }

  #loadDogFrame(fileName, target) {
    const image = new Image();
    image.decoding = "async";
    const frame = {
      name: fileName,
      image,
      loaded: false,
    };
    target.push(frame);

    image.addEventListener("load", () => {
      frame.loaded = true;
    });
    image.addEventListener("error", () => {
      console.warn(`[Dog] Failed to load frame: ${fileName}`);
    });
    image.src = new URL(`../png/${encodeURIComponent(fileName)}`, import.meta.url).href;
  }

  #getLoadedDogFrames(sequenceName) {
    if (!this.dogAnimations) return [];
    return this.dogAnimations[sequenceName].filter((frame) => frame.loaded);
  }

  #ensureFallbackAnimations() {
    if (this.dogAnimations) return;
    this.dogAnimations = this.#createDogAnimations();
    this.fallbackNeeded = true;
  }

  #currentDogFrame(scene, dog) {
    this.#ensureFallbackAnimations();
    let sequence = "idle";
    if (scene.state === "gameover") {
      sequence = "dead";
    } else if (Math.abs(dog.movement) >= 0.06) {
      sequence = "run";
    }

    const frames = this.#getLoadedDogFrames(sequence);
    if (frames.length === 0) {
      const idleFrames = this.#getLoadedDogFrames("idle");
      return idleFrames[0] || null;
    }

    if (sequence === "run") {
      const phase = Math.floor(dog.stepPhase / (Math.PI * 0.35));
      const index = ((phase % frames.length) + frames.length) % frames.length;
      return frames[index];
    }

    if (sequence === "dead") {
      const elapsed = Math.max(0, scene.gameOverElapsed || 0);
      const index = Math.min(frames.length - 1, Math.floor(elapsed * this.dogAnimations.fps.dead));
      return frames[index];
    }

    const index = Math.floor(scene.time * this.dogAnimations.fps[sequence]) % frames.length;
    return frames[index];
  }

  #drawDogFallback(scene, x, y, dir) {
    const { ctx } = this;
    const dog = scene.dog;
    const w = dog.w;
    const h = dog.h;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);

    ctx.fillStyle = "#141922";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.02, w * 0.46, h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0f141d";
    ctx.beginPath();
    ctx.arc(w * 0.28, -h * 0.12, w * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  #drawDog(scene) {
    const { ctx } = this;
    const dog = scene.dog;
    const isGameOver = scene.state === "gameover";
    const dt = scene.dt || 1 / 60;
    const facing = updateFacing(this.facingState, dog.facing, dt);
    this.facingState = { facing: facing.mirrorSign, progress: facing.progress };
    const movingIntensity = Math.abs(dog.movement);
    const bob = 0;
    const chewLift =
      !isGameOver && dog.chewTimer > 0
        ? Math.sin((1 - dog.chewTimer / dog.chewDuration) * Math.PI * 2.6) * 2.4
        : 0;

    const x = dog.x;
    const squashY = facing.squash;
    const y = dog.y + bob - chewLift + dog.h * 0.34;

    ctx.save();

    const selectedFrames = this.characterArt[scene.character === "dyno" ? "dyno" : "dog"];
    const runFrameIndex = pickRunFrame(4, dog.stepPhase, movingIntensity, isGameOver);
    const selectedArt = selectedFrames[runFrameIndex].loaded
      ? selectedFrames[runFrameIndex]
      : selectedFrames[0];
    const activeFrame = selectedArt.loaded ? selectedArt : this.#currentDogFrame(scene, dog);
    if (!activeFrame) {
      this.#drawDogFallback(scene, x, y, facing.mirrorSign);
      ctx.restore();
      return;
    }

    ctx.translate(x, y);
    ctx.scale(facing.mirrorSign, squashY);

    const spriteDrawHeight = dog.h * 1.34;
    const naturalW = activeFrame.image.naturalWidth || activeFrame.image.width || 1;
    const naturalH = activeFrame.image.naturalHeight || activeFrame.image.height || 1;
    const spriteDrawWidth = spriteDrawHeight * (naturalW / naturalH);
    const drawX = -spriteDrawWidth * this.dogAnimations.originX;
    const drawAdjustmentY = -(1 - squashY) * spriteDrawHeight * 0.5;
    const drawY = -spriteDrawHeight * this.dogAnimations.originY;

    // Soft rim so the silhouette separates from ground shades.
    const rimPalette = scene.character === "dyno" ? "rgba(238, 222, 192, 0.94)" : "rgba(255, 118, 126, 0.9)";
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = rimPalette;
    ctx.filter = "blur(6px)";
    ctx.drawImage(activeFrame.image, drawX - 2, drawY + drawAdjustmentY - 2, spriteDrawWidth + 4, spriteDrawHeight + 4);
    ctx.filter = "none";
    ctx.restore();

    ctx.drawImage(activeFrame.image, drawX, drawY + drawAdjustmentY, spriteDrawWidth, spriteDrawHeight);

    ctx.restore();
  }

  #drawCountdown(scene) {
    if (scene.state !== "countdown") return;

    const { ctx } = this;
    const label = getCountdownNumber(scene.countdownElapsed, COUNTDOWN_DURATION);
    ctx.save();
    ctx.fillStyle = "rgba(8, 28, 64, 0.2)";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.round(clamp(this.width * 0.2, 64, 150))}px Trebuchet MS, sans-serif`;
    ctx.lineWidth = Math.max(4, this.width * 0.012);
    ctx.strokeStyle = "rgba(7, 24, 56, 0.9)";
    ctx.strokeText(label, this.width * 0.5, this.height * 0.42);
    ctx.fillStyle = label === "GO" ? "#ffdf72" : "#ffffff";
    ctx.fillText(label, this.width * 0.5, this.height * 0.42);
    ctx.restore();
  }

  #drawGameOverFx(scene) {
    if ((scene.gameOverFx || 0) <= 0) return;
    const { ctx } = this;
    const progress = clamp(scene.gameOverFx / 0.85, 0, 1);

    ctx.save();

    ctx.fillStyle = `rgba(255, 76, 68, ${0.1 + progress * 0.22})`;
    ctx.fillRect(0, 0, this.width, this.height);

    const centerX = scene.dog.x;
    const centerY = scene.dog.y - scene.dog.h * 0.12;
    const inner = (1 - progress) * this.width * 0.08;
    const outer = inner + this.width * 0.28;
    const ring = ctx.createRadialGradient(centerX, centerY, inner, centerX, centerY, outer);
    ring.addColorStop(0, `rgba(255, 245, 190, ${progress * 0.24})`);
    ring.addColorStop(1, "rgba(255, 245, 190, 0)");
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outer, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  #roundedRect(x, y, w, h, r) {
    const { ctx } = this;
    const rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}
