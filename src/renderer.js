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
    this.#drawMachine(scene);

    for (const popcorn of scene.popcorns) {
      this.#drawPopcorn(popcorn);
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

    const shadow = clamp(machine.firePulse * 0.9, 0, 1);
    if (shadow > 0.01) {
      ctx.globalAlpha = shadow * 0.6;
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      ctx.arc(machine.nozzleX - 14, machine.nozzleY, h * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    this.#roundedRect(x, y, w, h, 16);
    const body = ctx.createLinearGradient(x, y, x, y + h);
    body.addColorStop(0, "#ff8a5f");
    body.addColorStop(1, "#f25f45");
    ctx.fillStyle = body;
    ctx.fill();

    ctx.strokeStyle = "#b43b2e";
    ctx.lineWidth = 3;
    ctx.stroke();

    const glassX = x + w * 0.2;
    const glassY = y + h * 0.12;
    const glassW = w * 0.56;
    const glassH = h * 0.5;
    this.#roundedRect(glassX, glassY, glassW, glassH, 12);
    const glass = ctx.createLinearGradient(glassX, glassY, glassX + glassW, glassY + glassH);
    glass.addColorStop(0, "rgba(255, 255, 255, 0.78)");
    glass.addColorStop(1, "rgba(225, 247, 255, 0.38)");
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const kernelY = glassY + glassH * 0.72;
    ctx.fillStyle = "#ffd17d";
    ctx.beginPath();
    ctx.ellipse(glassX + glassW * 0.5, kernelY, glassW * 0.4, glassH * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    const piston = Math.sin(scene.time * 15) * 2 + machine.firePulse * 6;
    const nozzleW = w * 0.22;
    const nozzleH = h * 0.12;
    const nozzleX = x - nozzleW * 0.45;
    const nozzleY = y + h * 0.45 + piston;
    this.#roundedRect(nozzleX, nozzleY, nozzleW, nozzleH, 10);
    const nozGrad = ctx.createLinearGradient(nozzleX, nozzleY, nozzleX + nozzleW, nozzleY);
    nozGrad.addColorStop(0, "#e1e6f5");
    nozGrad.addColorStop(1, "#8da2cc");
    ctx.fillStyle = nozGrad;
    ctx.fill();
    ctx.strokeStyle = "#6e7ea8";
    ctx.lineWidth = 2;
    ctx.stroke();

    const dialX = x + w * 0.8;
    const dialY = y + h * 0.78;
    ctx.fillStyle = "#ffe8b3";
    ctx.beginPath();
    ctx.arc(dialX, dialY, w * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b06d25";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "#c64339";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(dialX, dialY);
    ctx.lineTo(dialX + Math.cos(scene.time * 2) * w * 0.08, dialY - w * 0.03);
    ctx.stroke();

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
