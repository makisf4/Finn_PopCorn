import { clamp } from "./utils.js";

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.started = false;
    this.muted = false;
    this.musicTimer = null;
    this.volume = 0.72;
    this.masterGainBase = 0.56;
    this.musicGainBase = 0.31;
    this.musicStopped = false;
  }

  async unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.masterGain.gain.value = this.#targetMasterGain();
      this.musicGain.gain.value = this.#targetMusicGain();
      this.sfxGain.gain.value = 0.95;

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state !== "running") {
      await this.ctx.resume();
    }

    if (!this.started) {
      this.started = true;
      this.#startMusicLoop();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.#applyMasterGain();
    return this.muted;
  }

  setVolume(normalizedVolume) {
    this.volume = clamp(normalizedVolume, 0, 1);
    if (this.volume > 0 && this.muted) {
      this.muted = false;
    }
    this.#applyMasterGain();
    return this.volume;
  }

  getVolume() {
    return this.volume;
  }

  isMuted() {
    return this.muted;
  }

  stopMusic() {
    this.musicStopped = true;
    this.#applyMusicGain();
  }

  resumeMusic() {
    this.musicStopped = false;
    this.#applyMusicGain();
  }

  click() {
    this.#tone({
      type: "triangle",
      freqA: 650,
      freqB: 720,
      duration: 0.06,
      volume: 0.09,
    });
  }

  launch() {
    this.#tone({
      type: "square",
      freqA: 240,
      freqB: 420,
      duration: 0.1,
      volume: 0.12,
    });
  }

  catch() {
    this.#tone({
      type: "triangle",
      freqA: 680,
      freqB: 920,
      duration: 0.12,
      volume: 0.14,
    });
  }

  miss() {
    this.#tone({
      type: "sawtooth",
      freqA: 300,
      freqB: 120,
      duration: 0.16,
      volume: 0.13,
    });
  }

  gameOver() {
    this.#tone({
      type: "sine",
      freqA: 220,
      freqB: 90,
      duration: 0.42,
      volume: 0.17,
    });
  }

  yeah() {
    if (!this.ctx || this.muted || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    this.#toneAt({
      type: "triangle",
      freqA: 520,
      freqB: 690,
      duration: 0.11,
      volume: 0.14,
      startTime: now,
    });
    this.#toneAt({
      type: "sine",
      freqA: 690,
      freqB: 880,
      duration: 0.15,
      volume: 0.12,
      startTime: now + 0.09,
    });
  }

  #startMusicLoop() {
    if (this.musicTimer || !this.ctx) return;
    const leadNotes = [
      523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 698.46, 783.99, 659.25, 523.25, 587.33,
      659.25,
    ];
    const bassNotes = [
      261.63, 329.63, 392.0, 329.63, 293.66, 329.63, 349.23, 392.0, 329.63, 261.63, 293.66, 329.63,
    ];
    let step = 0;

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.muted || this.ctx.state !== "running") return;
      const now = this.ctx.currentTime;
      const idx = step % leadNotes.length;
      const accent = step % 4 === 0;
      this.#musicTone(leadNotes[idx], now, accent ? 0.22 : 0.18, accent ? 0.115 : 0.094, "triangle");
      this.#musicTone(bassNotes[idx], now, 0.17, 0.052, "sine");
      step += 1;
    }, 190);
  }

  #musicTone(freq, startTime, duration, peak, type) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peak, startTime + 0.016);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.03);
  }

  #tone({ type, freqA, freqB, duration, volume }) {
    if (!this.ctx || this.muted || this.ctx.state !== "running") return;
    this.#toneAt({
      type,
      freqA,
      freqB,
      duration,
      volume,
      startTime: this.ctx.currentTime,
    });
  }

  #toneAt({ type, freqA, freqB, duration, volume, startTime }) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(clamp(freqA, 40, 2000), startTime);
    osc.frequency.exponentialRampToValueAtTime(clamp(freqB, 40, 2000), startTime + duration);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + duration * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.03);
  }

  #targetMasterGain() {
    if (this.muted || this.volume <= 0.001) return 0;
    return this.volume * this.masterGainBase;
  }

  #targetMusicGain() {
    return this.musicStopped ? 0 : this.musicGainBase;
  }

  #applyMasterGain() {
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.setTargetAtTime(this.#targetMasterGain(), this.ctx.currentTime, 0.02);
  }

  #applyMusicGain() {
    if (!this.musicGain || !this.ctx) return;
    this.musicGain.gain.setTargetAtTime(this.#targetMusicGain(), this.ctx.currentTime, 0.03);
  }
}
