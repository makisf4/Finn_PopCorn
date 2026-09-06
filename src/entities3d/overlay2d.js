import {
  COUNTDOWN_DURATION,
  getCountdownNumber,
} from "../shared/gameplay.js?v=20260906-34";
import { clamp } from "../utils.js";

/**
 * Lightweight 2D overlay that sits on top of the WebGL canvas.
 * Keeps the countdown + game-over color wash identical to the 2D renderer.
 */
export class Overlay2D {
  constructor(host) {
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.position = "absolute";
    this.canvas.style.inset = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "2";
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
  }

  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(scene) {
    const { ctx } = this;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    this.#drawGameOverFx(scene);
    this.#drawCountdown(scene);
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
}
