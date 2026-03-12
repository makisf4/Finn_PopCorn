import { clamp } from "./utils.js";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.dogAnimations = this.#createDogAnimations();
  }

  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
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

    for (const drop of scene.bonusDrops || []) {
      this.#drawBonusDrop(drop);
    }

    for (const particle of scene.particles) {
      this.#drawParticle(particle);
    }

    this.#drawDog(scene);
    this.#drawGround(scene);
    this.#drawGameOverFx(scene);

    ctx.restore();
  }

  #drawBackground(scene) {
    const { ctx } = this;
    const sky = ctx.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0, "#88ddff");
    sky.addColorStop(0.56, "#c9f0ff");
    sky.addColorStop(1, "#f2fff8");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, this.height);

    const sunX = this.width * 0.16;
    const sunY = this.height * 0.16;
    const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, this.height * 0.17);
    glow.addColorStop(0, "rgba(255, 244, 164, 0.95)");
    glow.addColorStop(1, "rgba(255, 244, 164, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, this.height * 0.17, 0, Math.PI * 2);
    ctx.fill();

    this.#drawCloud(this.width * 0.16, this.height * 0.18, this.height * 0.06, 0.95);
    this.#drawCloud(this.width * 0.45, this.height * 0.12, this.height * 0.07, 0.85);
    this.#drawCloud(this.width * 0.68, this.height * 0.22, this.height * 0.055, 0.92);

    const hillBack = ctx.createLinearGradient(0, this.height * 0.56, 0, this.height * 0.88);
    hillBack.addColorStop(0, "#77d677");
    hillBack.addColorStop(1, "#57b85a");

    ctx.fillStyle = hillBack;
    ctx.beginPath();
    ctx.moveTo(0, this.height * 0.66);
    ctx.quadraticCurveTo(this.width * 0.2, this.height * 0.54, this.width * 0.41, this.height * 0.67);
    ctx.quadraticCurveTo(this.width * 0.56, this.height * 0.74, this.width * 0.74, this.height * 0.6);
    ctx.quadraticCurveTo(this.width * 0.88, this.height * 0.5, this.width, this.height * 0.67);
    ctx.lineTo(this.width, this.height);
    ctx.lineTo(0, this.height);
    ctx.closePath();
    ctx.fill();

    const stripeOffset = (scene.time * 18) % 36;
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#ffffff";
    for (let x = -40; x < this.width + 60; x += 36) {
      ctx.fillRect(x + stripeOffset, scene.groundY + 10, 20, this.height - scene.groundY - 8);
    }
    ctx.globalAlpha = 1;
  }

  #drawGround(scene) {
    const { ctx } = this;
    const y = scene.groundY;
    const turf = ctx.createLinearGradient(0, y - 15, 0, this.height);
    turf.addColorStop(0, "#85df64");
    turf.addColorStop(1, "#4aa248");
    ctx.fillStyle = turf;
    ctx.fillRect(0, y, this.width, this.height - y);

    ctx.strokeStyle = "rgba(28, 84, 27, 0.35)";
    ctx.lineWidth = 2;
    for (let x = -14; x < this.width + 20; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.quadraticCurveTo(x + 10, y - 8, x + 20, y + 6);
      ctx.stroke();
    }
  }

  #drawCloud(x, y, size, alpha) {
    const { ctx } = this;
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

    const piston = Math.sin(scene.time * 14) * 1.8 + machine.firePulse * 5.6;
    const popperW = w * 0.22;
    const popperH = h * 0.1;
    const popperX = x - popperW * 0.48;
    const popperY = y + h * 0.46 + piston;
    this.#roundedRect(popperX, popperY, popperW, popperH, 7);
    const popperGrad = ctx.createLinearGradient(popperX, popperY, popperX + popperW, popperY + popperH);
    popperGrad.addColorStop(0, "#f8f7fb");
    popperGrad.addColorStop(1, "#9ca8bf");
    ctx.fillStyle = popperGrad;
    ctx.fill();
    ctx.strokeStyle = "#687590";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    const flame = clamp(machine.firePulse * 0.9, 0, 1);
    if (flame > 0.01) {
      ctx.globalAlpha = flame * 0.55;
      ctx.fillStyle = "#ffde7a";
      ctx.beginPath();
      ctx.ellipse(machine.nozzleX - 6, machine.nozzleY + 1, h * 0.16, h * 0.12, 0, 0, Math.PI * 2);
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
    return this.dogAnimations[sequenceName].filter((frame) => frame.loaded);
  }

  #currentDogFrame(scene, dog) {
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
    const dir = dog.facing >= 0 ? 1 : -1;
    const movingIntensity = Math.abs(dog.movement);
    const bob = isGameOver
      ? 0
      : Math.sin(scene.time * (8 + movingIntensity * 6)) * (dog.h * 0.02 + movingIntensity * 1.1);
    const chewLift =
      !isGameOver && dog.chewTimer > 0
        ? Math.sin((1 - dog.chewTimer / dog.chewDuration) * Math.PI * 2.6) * 2.4
        : 0;

    const x = dog.x;
    const y = dog.y + bob - chewLift + dog.h * 0.34;

    ctx.save();

    const activeFrame = this.#currentDogFrame(scene, dog);
    if (!activeFrame) {
      this.#drawDogFallback(scene, x, y, dir);
      ctx.restore();
      return;
    }

    ctx.translate(x, y);
    if (dir < 0) {
      ctx.scale(-1, 1);
    }

    const spriteDrawHeight = dog.h * 1.34;
    const naturalW = activeFrame.image.naturalWidth || activeFrame.image.width || 1;
    const naturalH = activeFrame.image.naturalHeight || activeFrame.image.height || 1;
    const spriteDrawWidth = spriteDrawHeight * (naturalW / naturalH);
    const drawX = -spriteDrawWidth * this.dogAnimations.originX;
    const drawY = -spriteDrawHeight * this.dogAnimations.originY;

    ctx.drawImage(
      activeFrame.image,
      drawX,
      drawY,
      spriteDrawWidth,
      spriteDrawHeight
    );

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
