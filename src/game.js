import { AudioManager } from "./audio.js";
import { InputManager } from "./input.js";
import { Renderer } from "./renderer.js?v=20260312-5";
import { clamp, circleRectCollision, formatMisses, lerp, rand, randInt, smoothstep } from "./utils.js";

export class Game {
  constructor(elements) {
    this.canvas = elements.canvas;
    this.scoreValue = elements.scoreValue;
    this.missValue = elements.missValue;
    this.startScreen = elements.startScreen;
    this.gameOverScreen = elements.gameOverScreen;
    this.pauseScreen = elements.pauseScreen;
    this.playBtn = elements.playBtn;
    this.restartBtn = elements.restartBtn;
    this.finalScore = elements.finalScore;
    this.muteBtn = elements.muteBtn;
    this.muteIcon = elements.muteIcon;
    this.volumeSlider = elements.volumeSlider;
    this.volumeValue = elements.volumeValue;
    this.milestoneBanner = elements.milestoneBanner;
    this.milestoneText = elements.milestoneText;
    this.playerNameInput = elements.playerNameInput;
    this.nameError = elements.nameError;
    this.leaderboardListStart = elements.leaderboardListStart;
    this.leaderboardListOver = elements.leaderboardListOver;

    this.renderer = new Renderer(this.canvas);
    this.audio = new AudioManager();

    this.input = new InputManager({
      leftBtn: elements.leftBtn,
      rightBtn: elements.rightBtn,
      onUiClick: () => {
        this.#unlockAudio();
        this.audio.click();
      },
    });

    this.maxMisses = 3;
    this.state = "start";

    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.time = 0;
    this.lastFrame = 0;

    this.gameClock = 0;
    this.score = 0;
    this.misses = 0;
    this.batchIndex = 0;
    this.gameOverElapsed = 0;
    this.gameOverFxTimer = 0;
    this.activePlayerName = "";

    this.popcorns = [];
    this.particles = [];
    this.launchEvents = [];
    this.nextBatchAt = 0;

    this.groundY = 0;
    this.shake = 0;
    this.milestoneBannerTimer = 0;
    this.lastMilestoneScore = 0;

    this.machine = {
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      nozzleX: 0,
      nozzleY: 0,
      firePulse: 0,
    };

    this.leaderboardStorageKey = "finn_popcorn_leaderboard_v1";
    this.maxLeaderboardEntries = 10;
    this.lastPlayerStorageKey = "finn_popcorn_last_player_v1";
    this.blockedNameFragments = [
      "fuck",
      "shit",
      "bitch",
      "cunt",
      "dick",
      "pussy",
      "fucker",
      "bastard",
      "whore",
      "slut",
      "nigger",
      "nigga",
      "retard",
      "motherfucker",
    ];
    this.leaderboardEntries = this.#loadLeaderboard();

    this.popcornThemes = [
      {
        body: "#fffef5",
        stroke: "#f7e5bf",
        belly: "#fff6d8",
      },
      {
        body: "#ffd4d4",
        stroke: "#ff7f86",
        belly: "#ffacb5",
      },
      {
        body: "#d7e8ff",
        stroke: "#6ea6ff",
        belly: "#aecbff",
      },
      {
        body: "#fff2b2",
        stroke: "#f4c84f",
        belly: "#ffe07d",
      },
      {
        body: "#ffd9ad",
        stroke: "#f19a44",
        belly: "#ffc274",
      },
    ];

    this.popcornVariants = [
      { id: "normal", scale: 1, points: 5, weight: 0.74 },
      { id: "big", scale: 1.26, points: 7, weight: 0.2 },
      { id: "giant", scale: 1.56, points: 10, weight: 0.06 },
    ];

    this.dog = {
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      speed: 0,
      facing: -1,
      movement: 0,
      stepPhase: 0,
      chewTimer: 0,
      chewDuration: 0.34,
    };

    this.#bindUiEvents();
    this.#resize();
    this.#updateHud();
    this.#syncVolumeUi();
    this.#hydrateLastPlayerName();
    this.#renderLeaderboards();
    this.#loop(0);
  }

  #bindUiEvents() {
    this.playBtn.addEventListener("click", () => {
      this.#unlockAudio();
      this.audio.click();
      if (!this.#captureAndValidatePlayerName()) {
        return;
      }
      this.startGame();
    });

    this.restartBtn.addEventListener("click", () => {
      this.#unlockAudio();
      this.audio.click();
      this.#showStartScreen();
    });

    this.muteBtn.addEventListener("click", () => {
      this.#unlockAudio();
      const muted = this.audio.toggleMute();
      this.muteIcon.textContent = muted ? "🔇" : "🔊";
      this.audio.click();
      this.#syncVolumeUi();
    });

    if (this.volumeSlider) {
      this.volumeSlider.addEventListener("input", () => {
        this.#unlockAudio();
        const volume = Number(this.volumeSlider.value) / 100;
        this.audio.setVolume(volume);
        this.#syncVolumeUi();
      });
    }

    if (this.playerNameInput) {
      this.playerNameInput.addEventListener("input", () => {
        const sanitized = this.playerNameInput.value.replace(/[^A-Za-z]/g, "").slice(0, 10);
        if (sanitized !== this.playerNameInput.value) {
          this.playerNameInput.value = sanitized;
        }
        this.#clearNameError();
      });

      this.playerNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.playBtn.click();
        }
      });
    }

    window.addEventListener("keydown", (event) => {
      if (event.code !== "Space" || event.repeat) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (this.state !== "playing" && this.state !== "paused") return;
      event.preventDefault();
      this.#togglePause();
    });

    const unlockEvents = ["pointerdown", "touchstart", "keydown"];
    for (const eventName of unlockEvents) {
      window.addEventListener(
        eventName,
        () => {
          this.#unlockAudio();
        },
        { once: true, passive: true }
      );
    }

    window.addEventListener("resize", () => this.#resize());
    window.addEventListener("orientationchange", () => this.#resize());
  }

  async #unlockAudio() {
    try {
      await this.audio.unlock();
    } catch {
      // Ignore audio errors so gameplay continues.
    }
  }

  startGame() {
    if (!this.activePlayerName && !this.#captureAndValidatePlayerName()) {
      this.#showStartScreen();
      return;
    }

    this.state = "playing";
    this.startScreen.classList.remove("visible");
    this.gameOverScreen.classList.remove("visible");
    this.#hidePauseOverlay();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.gameClock = 0;
    this.score = 0;
    this.misses = 0;
    this.batchIndex = 0;
    this.gameOverElapsed = 0;
    this.gameOverFxTimer = 0;
    this.popcorns.length = 0;
    this.particles.length = 0;
    this.launchEvents.length = 0;
    this.nextBatchAt = 0.8;
    this.shake = 0;
    this.milestoneBannerTimer = 0;
    this.lastMilestoneScore = 0;
    this.#hideMilestoneBanner();
    this.audio.resumeMusic();

    this.#resetDogPosition();
    this.#updateHud(true);
  }

  #endGame() {
    this.state = "gameover";
    this.gameOverElapsed = 0;
    this.gameOverFxTimer = 0.85;
    this.launchEvents.length = 0;
    this.popcorns.length = 0;
    this.milestoneBannerTimer = 0;
    this.#hideMilestoneBanner();
    this.#hidePauseOverlay();
    this.shake = Math.max(this.shake, 14);
    this.#spawnParticles(this.dog.x, this.dog.y - this.dog.h * 0.18, {
      count: 30,
      speedMin: 55,
      speedMax: 245,
      lifeMin: 0.24,
      lifeMax: 0.78,
      sizeMin: 2.2,
      sizeMax: 6.2,
      colors: ["#ffd69a", "#ffab73", "#ff6f6a", "#fff2c8"],
    });
    this.#recordLeaderboardScore();
    this.finalScore.textContent = `Final Score: ${this.score} - ${this.activePlayerName}`;
    this.gameOverScreen.classList.add("visible");
    this.audio.stopMusic();
    this.audio.gameOver();
  }

  #showStartScreen() {
    this.state = "start";
    this.startScreen.classList.add("visible");
    this.gameOverScreen.classList.remove("visible");
    this.#hidePauseOverlay();
    this.#clearNameError();
    this.#hideMilestoneBanner();
    this.milestoneBannerTimer = 0;
    this.gameOverElapsed = 0;
    this.gameOverFxTimer = 0;
    this.#renderLeaderboards();

    if (this.playerNameInput) {
      this.playerNameInput.focus();
      this.playerNameInput.select();
    }
  }

  #resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(320, rect.width || window.innerWidth);
    this.height = Math.max(340, rect.height || window.innerHeight);
    this.dpr = clamp(window.devicePixelRatio || 1, 1, 2);

    this.renderer.resize(this.width, this.height, this.dpr);

    this.groundY = this.height * 0.825;

    this.machine.w = clamp(this.width * 0.14, 80, 140);
    this.machine.h = clamp(this.height * 0.33, 130, 240);
    this.machine.x = this.width - this.machine.w * 0.92;
    this.machine.y = this.groundY - this.machine.h;
    this.machine.nozzleX = this.machine.x - this.machine.w * 0.08;
    this.machine.nozzleY = this.machine.y + this.machine.h * 0.5;

    const oldW = this.dog.w || clamp(this.width * 0.12, 56, 100);
    const newW = clamp(this.width * 0.12, 56, 100);
    const scale = newW / oldW;

    this.dog.w = newW;
    this.dog.h = this.dog.w * 0.78;
    this.dog.y = this.groundY - this.dog.h * 0.42;
    this.dog.speed = this.width * 0.58;

    if (!this.dog.x) {
      this.#resetDogPosition();
    } else {
      this.dog.x = clamp(this.dog.x * scale, this.#dogMinX(), this.#dogMaxX());
    }
  }

  #resetDogPosition() {
    this.dog.x = this.width * 0.22;
    this.dog.y = this.groundY - this.dog.h * 0.42;
    this.dog.facing = -1;
    this.dog.movement = 0;
    this.dog.stepPhase = 0;
    this.dog.chewTimer = 0;
  }

  #loop(timestampMs) {
    const timestamp = timestampMs * 0.001;
    const dt = clamp(timestamp - this.lastFrame || 0.016, 0.001, 0.033);
    this.lastFrame = timestamp;
    if (this.state !== "paused") {
      this.time += dt;
    }

    this.#update(dt);
    this.#render();

    requestAnimationFrame((t) => this.#loop(t));
  }

  #update(dt) {
    if (this.state === "paused") {
      return;
    }

    if (this.state === "playing") {
      this.#updateDog(dt);
    } else {
      this.dog.movement = lerp(this.dog.movement, 0, dt * 8);
    }

    if (this.state === "playing") {
      this.gameClock += dt;

      if (this.launchEvents.length === 0 && this.gameClock >= this.nextBatchAt) {
        this.#queueNextBatch();
      }

      while (this.launchEvents.length > 0 && this.launchEvents[0].at <= this.gameClock) {
        this.launchEvents.shift();
        this.#spawnPopcorn();
      }

      this.#updatePopcorns(dt);
    } else if (this.state === "gameover") {
      this.gameOverElapsed += dt;
    }

    if (this.gameOverFxTimer > 0) {
      this.gameOverFxTimer = Math.max(0, this.gameOverFxTimer - dt);
    }

    if (this.milestoneBannerTimer > 0) {
      this.milestoneBannerTimer = Math.max(0, this.milestoneBannerTimer - dt);
      if (this.milestoneBannerTimer <= 0) {
        this.#hideMilestoneBanner();
      }
    }

    this.#updateParticles(dt);
    this.machine.firePulse = Math.max(0, this.machine.firePulse - dt * 2.9);
    this.shake = Math.max(0, this.shake - dt * 24);
  }

  #updateDog(dt) {
    const axis = this.input.getAxis();
    const move = axis * this.dog.speed * dt;

    this.dog.x = clamp(this.dog.x + move, this.#dogMinX(), this.#dogMaxX());
    this.dog.movement = lerp(this.dog.movement, Math.abs(axis), dt * 13);

    if (axis !== 0) {
      this.dog.facing = axis > 0 ? 1 : -1;
      this.dog.stepPhase += dt * (12 + this.dog.movement * 8);
    } else {
      this.dog.stepPhase += dt * 5;
    }

    if (this.dog.chewTimer > 0) {
      this.dog.chewTimer = Math.max(0, this.dog.chewTimer - dt);
    }
  }

  #updatePopcorns(dt) {
    const catchRect = this.#dogCatchRect();

    for (let i = this.popcorns.length - 1; i >= 0; i -= 1) {
      const popcorn = this.popcorns[i];
      popcorn.age += dt;

      this.#applyAssist(popcorn, dt);

      const assistedGravity = popcorn.g * (1 - popcorn.assist * 0.34);
      popcorn.vy += assistedGravity * dt;

      popcorn.x += popcorn.vx * dt;
      popcorn.y += popcorn.vy * dt;
      popcorn.x = clamp(popcorn.x, popcorn.r + 2, this.width - popcorn.r - 2);
      popcorn.spin += popcorn.spinSpeed * dt;

      if (popcorn.y < popcorn.r + 3) {
        popcorn.y = popcorn.r + 3;
        popcorn.vy *= 0.75;
      }

      if (popcorn.y + popcorn.r >= this.groundY) {
        popcorn.y = this.groundY - popcorn.r;

        if (popcorn.groundBounces === 0) {
          popcorn.groundBounces = 1;
          popcorn.vy = -Math.max(Math.abs(popcorn.vy) * 0.4, this.height * 0.16);
          popcorn.vx *= 0.52;
          popcorn.spinSpeed *= 0.72;

          this.#spawnParticles(popcorn.x, this.groundY - 4, {
            count: 4,
            speedMin: 18,
            speedMax: 62,
            lifeMin: 0.08,
            lifeMax: 0.2,
            sizeMin: 1.2,
            sizeMax: 2.8,
            colors: ["#ffe4a6", "#ffd179", "#f6b763"],
          });
        } else {
          this.#handleMiss(popcorn);
          this.popcorns.splice(i, 1);
          continue;
        }
      }

      if (circleRectCollision(popcorn, catchRect)) {
        this.#handleCatch(popcorn);
        this.popcorns.splice(i, 1);
      }
    }
  }

  #applyAssist(popcorn, dt) {
    const distance = Math.abs(popcorn.x - this.dog.x);
    const descending = popcorn.vy > 20;
    const inAssistBand = popcorn.y > this.height * 0.22 && popcorn.y < this.height * 0.86;

    let targetAssist = 0;
    if (descending && inAssistBand) {
      const distFactor = clamp((distance - this.dog.w * 0.75) / (this.width * 0.55), 0, 1);
      const heightFactor = smoothstep(this.height * 0.22, this.height * 0.82, popcorn.y);
      targetAssist = clamp(distFactor * heightFactor * 1.08, 0, 1);
      if (popcorn.y > this.height * 0.67) {
        targetAssist = Math.min(1, targetAssist + 0.12);
      }
    }

    const rate = targetAssist > popcorn.assist ? 2.3 : 2.8;
    popcorn.assist = lerp(popcorn.assist, targetAssist, clamp(dt * rate, 0, 1));

    if (popcorn.assist > 0.01) {
      const dragX = 1 - popcorn.assist * 0.24 * dt * 60;
      popcorn.vx *= clamp(dragX, 0.86, 1);

      if (popcorn.vy > 0) {
        const dragY = 1 - popcorn.assist * 0.18 * dt * 60;
        popcorn.vy *= clamp(dragY, 0.86, 1);
      }
    }
  }

  #handleCatch(popcorn) {
    const points = popcorn.points || 5;
    this.score += points;
    this.dog.chewTimer = this.dog.chewDuration;
    const scoreFactor = clamp(points / 5, 1, 2.4);

    this.#spawnParticles(popcorn.x, popcorn.y, {
      count: Math.round(9 + scoreFactor * 6),
      speedMin: 35,
      speedMax: 175 + scoreFactor * 20,
      lifeMin: 0.2,
      lifeMax: 0.56,
      sizeMin: 1.8,
      sizeMax: 5.7,
      colors: ["#fff4b0", "#ffcf6b", "#ffffff"],
    });

    this.particles.push({
      x: popcorn.x,
      y: popcorn.y,
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 0,
      size: popcorn.r * 1.5,
      life: 0.22,
      maxLife: 0.22,
      alpha: 0.6,
      color: "#fffbd2",
      shape: "ring",
      rotation: 0,
      vrot: 0,
    });

    this.audio.catch();
    this.#updateHud(true);
    this.#checkMilestone();
  }

  #handleMiss(popcorn) {
    this.misses += 1;
    this.shake = Math.max(this.shake, 8);

    this.#spawnParticles(popcorn.x, this.groundY - 5, {
      count: 10,
      speedMin: 30,
      speedMax: 155,
      lifeMin: 0.22,
      lifeMax: 0.56,
      sizeMin: 2,
      sizeMax: 5,
      colors: ["#ffc164", "#ff7f64", "#f45b63"],
    });

    this.audio.miss();
    this.#updateHud(false);

    if (this.misses >= this.maxMisses) {
      this.#endGame();
    }
  }

  #queueNextBatch() {
    this.batchIndex += 1;
    const [minCount, maxCount] = this.#getBatchRange(this.batchIndex);
    const count = randInt(minCount, maxCount);

    const spacingMin = Math.max(0.2, 0.42 - this.batchIndex * 0.006);
    const spacingMax = Math.max(0.36, 0.78 - this.batchIndex * 0.008);

    let at = this.gameClock + rand(0.2, 0.46);
    for (let i = 0; i < count; i += 1) {
      at += rand(spacingMin, spacingMax);
      this.launchEvents.push({ at });
    }

    const recovery = Math.max(1, 2.8 - this.batchIndex * 0.075);
    this.nextBatchAt = at + recovery;
  }

  #getBatchRange(batchNumber) {
    if (batchNumber === 1) return [2, 3];
    if (batchNumber === 2) return [4, 5];
    if (batchNumber === 3) return [8, 9];

    const minCount = Math.min(28, 9 + Math.floor((batchNumber - 3) * 2.4));
    return [minCount, minCount + 2];
  }

  #spawnPopcorn() {
    const popcorn = this.#createPopcornTrajectory();
    popcorn.theme = this.#currentPopcornTheme();
    this.popcorns.push(popcorn);

    this.machine.firePulse = 1;
    this.#spawnParticles(this.machine.nozzleX - 2, this.machine.nozzleY, {
      count: 6,
      speedMin: 45,
      speedMax: 120,
      lifeMin: 0.1,
      lifeMax: 0.28,
      sizeMin: 1.4,
      sizeMax: 3.2,
      colors: ["#ffe18d", "#ffc162", "#ff9a62"],
    });

    this.audio.launch();
  }

  #createPopcornTrajectory() {
    const startX = this.machine.nozzleX;
    const startY = this.machine.nozzleY + rand(-6, 5);
    const variant = this.#pickPopcornVariant();
    const radius = clamp(this.width * 0.011, 7, 11) * variant.scale;
    const landingMin = this.width * 0.06;
    const landingMax = this.width * 0.84;

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const intensity = clamp((this.batchIndex - 1) * 0.03, 0, 0.22);
      const flightTime = rand(2.75 - intensity * 0.22, 3.9 - intensity * 0.14);
      const biasX = clamp(this.dog.x + rand(-this.width * 0.38, this.width * 0.38), landingMin, landingMax);
      const landingX = lerp(rand(landingMin, landingMax), biasX, 0.34);
      const apexY = rand(this.height * 0.12, this.height * 0.36);
      const yEnd = this.groundY - rand(9, 14);

      const lift = startY - apexY;
      const dropFromApex = yEnd - apexY;
      if (lift < 20 || dropFromApex < 40) {
        continue;
      }

      const rootG = (Math.sqrt(2 * lift) + Math.sqrt(2 * dropFromApex)) / flightTime;
      const gravity = rootG * rootG;
      const vy = -Math.sqrt(2 * gravity * lift);
      const vx = (landingX - startX) / flightTime;

      const speedLimit = this.width * 0.56;
      if (Math.abs(vx) > speedLimit || Math.abs(vx) < this.width * 0.05) {
        continue;
      }

      if (!this.#trajectoryInBounds(startX, startY, vx, vy, gravity, flightTime)) {
        continue;
      }

      return {
        x: startX,
        y: startY,
        vx,
        vy,
        g: gravity,
        r: radius,
        points: variant.points,
        variant: variant.id,
        age: 0,
        spin: rand(0, Math.PI * 2),
        spinSpeed: rand(-6.5, 6.5),
        assist: 0,
        groundBounces: 0,
      };
    }

    return {
      x: startX,
      y: startY,
      vx: -this.width * 0.34,
      vy: -this.height * 0.48,
      g: this.height * 0.74,
      r: radius,
      points: variant.points,
      variant: variant.id,
      age: 0,
      spin: rand(0, Math.PI * 2),
      spinSpeed: rand(-5.5, 5.5),
      assist: 0,
      groundBounces: 0,
    };
  }

  #trajectoryInBounds(x0, y0, vx, vy, g, totalTime) {
    const checks = 20;
    for (let i = 0; i <= checks; i += 1) {
      const t = (i / checks) * totalTime;
      const x = x0 + vx * t;
      const y = y0 + vy * t + 0.5 * g * t * t;

      if (x < 2 || x > this.width - 2) return false;
      if (y < 2 || y > this.groundY + 0.5) return false;
    }

    return true;
  }

  #spawnParticles(x, y, config) {
    for (let i = 0; i < config.count; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(config.speedMin, config.speedMax);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: rand(120, 350),
        drag: rand(2.6, 4.6),
        size: rand(config.sizeMin, config.sizeMax),
        life: rand(config.lifeMin, config.lifeMax),
        maxLife: 0,
        alpha: 1,
        color: config.colors[randInt(0, config.colors.length - 1)],
        shape: Math.random() > 0.78 ? "ring" : "dot",
        rotation: rand(0, Math.PI * 2),
        vrot: rand(-8, 8),
      });
      const particle = this.particles[this.particles.length - 1];
      particle.maxLife = particle.life;
    }
  }

  #updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.life -= dt;

      if (particle.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const dragFactor = Math.max(0, 1 - particle.drag * dt);
      particle.vx *= dragFactor;
      particle.vy = particle.vy * dragFactor + particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.rotation += particle.vrot * dt;

      const fade = clamp(particle.life / (particle.maxLife || particle.life), 0, 1);
      particle.alpha = fade;
    }
  }

  #updateHud(scorePop = false) {
    this.scoreValue.textContent = String(this.score);
    this.missValue.textContent = formatMisses(this.misses, this.maxMisses);

    if (scorePop) {
      this.scoreValue.classList.remove("pop");
      // Force style flush to restart animation.
      void this.scoreValue.offsetWidth;
      this.scoreValue.classList.add("pop");
    }
  }

  #syncVolumeUi() {
    const volumePercent = Math.round(this.audio.getVolume() * 100);
    if (this.volumeSlider) {
      this.volumeSlider.value = String(volumePercent);
    }
    if (this.volumeValue) {
      this.volumeValue.textContent = `${volumePercent}%`;
    }
    if (this.muteIcon) {
      this.muteIcon.textContent = this.audio.isMuted() || volumePercent <= 0 ? "🔇" : "🔊";
    }
  }

  #currentPopcornTheme() {
    if (this.score < 50) {
      return this.popcornThemes[0];
    }

    const stage = Math.floor(this.score / 50);
    const cycleIndex = ((stage - 1) % 4) + 1;
    return this.popcornThemes[cycleIndex];
  }

  #checkMilestone() {
    if (this.state !== "playing") return;
    const reachedMilestone = Math.floor(this.score / 50) * 50;
    if (reachedMilestone <= 0 || reachedMilestone === this.lastMilestoneScore) return;

    this.lastMilestoneScore = reachedMilestone;
    const playerName = this.activePlayerName || "Player";
    this.#showMilestoneBanner(`Keep it up, ${playerName}!`);
    this.audio.yeah();
  }

  #pickPopcornVariant() {
    const roll = Math.random();
    let cumulative = 0;

    for (const variant of this.popcornVariants) {
      cumulative += variant.weight;
      if (roll <= cumulative) {
        return variant;
      }
    }

    return this.popcornVariants[0];
  }

  #showMilestoneBanner(message) {
    if (!this.milestoneBanner || !this.milestoneText) return;
    this.milestoneText.textContent = message;
    this.milestoneBannerTimer = 3;
    this.milestoneBanner.classList.remove("visible");
    // Force style flush so the animation replays on each milestone.
    void this.milestoneBanner.offsetWidth;
    this.milestoneBanner.classList.add("visible");
  }

  #hideMilestoneBanner() {
    if (!this.milestoneBanner) return;
    this.milestoneBannerTimer = 0;
    this.milestoneBanner.classList.remove("visible");
  }

  #dogCatchRect() {
    return {
      x: this.dog.x - this.dog.w * 0.42,
      y: this.dog.y - this.dog.h * 0.7,
      w: this.dog.w * 0.84,
      h: this.dog.h * 0.62,
    };
  }

  #dogMinX() {
    return this.dog.w * 0.5 + 6;
  }

  #dogMaxX() {
    return this.width - this.dog.w * 0.5 - 8;
  }

  #render() {
    this.renderer.render({
      time: this.time,
      state: this.state,
      gameOverElapsed: this.gameOverElapsed,
      gameOverFx: this.gameOverFxTimer,
      width: this.width,
      height: this.height,
      groundY: this.groundY,
      machine: this.machine,
      dog: this.dog,
      popcorns: this.popcorns,
      particles: this.particles,
      shake: this.shake,
    });
  }

  #captureAndValidatePlayerName() {
    if (!this.playerNameInput) {
      this.activePlayerName = "Player";
      return true;
    }

    const rawName = (this.playerNameInput.value || "").trim();
    if (!rawName) {
      this.#setNameError("Name is required.");
      return false;
    }

    if (!/^[A-Za-z]{1,10}$/.test(rawName)) {
      this.#setNameError("Use only English letters (A-Z), max 10 chars.");
      return false;
    }

    const normalized = rawName.toLowerCase();
    if (this.blockedNameFragments.some((fragment) => normalized.includes(fragment))) {
      this.#setNameError("Please choose a clean name.");
      return false;
    }

    this.activePlayerName = rawName;
    this.#clearNameError();
    this.#saveLastPlayerName(rawName);
    return true;
  }

  #setNameError(message) {
    if (!this.nameError) return;
    this.nameError.textContent = message;
  }

  #clearNameError() {
    if (!this.nameError) return;
    this.nameError.textContent = "";
  }

  #loadLeaderboard() {
    try {
      const raw = localStorage.getItem(this.leaderboardStorageKey);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const entries = parsed
        .map((entry) => ({
          name: typeof entry.name === "string" ? entry.name.slice(0, 10) : "",
          score: Number.isFinite(entry.score) ? Math.max(0, Math.floor(entry.score)) : 0,
          ts: Number.isFinite(entry.ts) ? entry.ts : Date.now(),
        }))
        .filter((entry) => /^[A-Za-z]{1,10}$/.test(entry.name));
      return this.#normalizeLeaderboardEntries(entries);
    } catch {
      return [];
    }
  }

  #saveLeaderboard() {
    try {
      localStorage.setItem(this.leaderboardStorageKey, JSON.stringify(this.leaderboardEntries));
    } catch {
      // Ignore storage failures.
    }
  }

  #recordLeaderboardScore() {
    if (!this.activePlayerName || this.score <= 0) {
      this.#renderLeaderboards();
      return;
    }

    this.leaderboardEntries = this.#normalizeLeaderboardEntries([
      ...this.leaderboardEntries,
      {
        name: this.activePlayerName,
        score: this.score,
        ts: Date.now(),
      },
    ]);
    this.#saveLeaderboard();
    this.#renderLeaderboards();
  }

  #normalizeLeaderboardEntries(entries) {
    const byPlayer = new Map();

    for (const entry of entries) {
      const key = entry.name.toLowerCase();
      const existing = byPlayer.get(key);
      if (!existing) {
        byPlayer.set(key, entry);
        continue;
      }

      if (entry.score > existing.score || (entry.score === existing.score && entry.ts < existing.ts)) {
        byPlayer.set(key, entry);
      }
    }

    return [...byPlayer.values()]
      .sort((a, b) => b.score - a.score || a.ts - b.ts)
      .slice(0, this.maxLeaderboardEntries);
  }

  #renderLeaderboards() {
    this.#renderLeaderboardList(this.leaderboardListStart);
    this.#renderLeaderboardList(this.leaderboardListOver);
  }

  #renderLeaderboardList(target) {
    if (!target) return;
    target.textContent = "";

    if (this.leaderboardEntries.length === 0) {
      const empty = document.createElement("li");
      empty.className = "leaderboard-empty";
      empty.textContent = "No scores yet";
      target.append(empty);
      return;
    }

    for (const entry of this.leaderboardEntries) {
      const item = document.createElement("li");
      item.textContent = `${entry.name} - ${entry.score}`;
      target.append(item);
    }
  }

  #hydrateLastPlayerName() {
    if (!this.playerNameInput) return;
    try {
      const lastName = localStorage.getItem(this.lastPlayerStorageKey) || "";
      if (/^[A-Za-z]{1,10}$/.test(lastName)) {
        this.playerNameInput.value = lastName;
      }
    } catch {
      // Ignore storage failures.
    }
  }

  #saveLastPlayerName(name) {
    try {
      localStorage.setItem(this.lastPlayerStorageKey, name);
    } catch {
      // Ignore storage failures.
    }
  }

  #togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
      this.#showPauseOverlay();
      return;
    }

    if (this.state === "paused") {
      this.state = "playing";
      this.#hidePauseOverlay();
    }
  }

  #showPauseOverlay() {
    if (!this.pauseScreen) return;
    this.pauseScreen.classList.add("visible");
  }

  #hidePauseOverlay() {
    if (!this.pauseScreen) return;
    this.pauseScreen.classList.remove("visible");
  }
}
