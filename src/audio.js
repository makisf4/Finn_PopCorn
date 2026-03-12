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
    this.musicStep = 0;
    this.volume = 0.72;
    this.masterGainBase = 0.56;
    this.musicGainBase = 0.31;
    this.musicStopped = false;
    this.musicPattern = {
      tempo: 300,
      tempoMs: 200,
      lead: [
        "la",
        "si",
        "do",
        "re",
        "mi",
        "mi",
        "re",
        "mi",
        "re",
        "do",
        "re",
        "re",
        "sol",
        "la",
        "si",
        "do",
        "re",
        "la",
        "si",
        "do",
        "si",
        "la",
        "si",
        "do",
      ],
      durations: [2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1],
      bass: [],
    };
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
      type: "square",
      freqA: 700,
      freqB: 820,
      duration: 0.12,
      volume: 0.24,
      startTime: now,
    });
    this.#toneAt({
      type: "triangle",
      freqA: 620,
      freqB: 910,
      duration: 0.18,
      volume: 0.21,
      startTime: now + 0.03,
    });
    this.#toneAt({
      type: "sine",
      freqA: 900,
      freqB: 1160,
      duration: 0.2,
      volume: 0.2,
      startTime: now + 0.12,
    });
  }

  #startMusicLoop() {
    if (this.musicTimer || !this.ctx) return;
    this.musicStep = 0;
    this.#scheduleMusicStep();
  }

  #scheduleMusicStep() {
    if (!this.ctx) return;

    const lead = this.musicPattern.lead;
    if (!Array.isArray(lead) || lead.length === 0) return;

    const durations = this.musicPattern.durations;
    const bass = this.musicPattern.bass;

    const idx = this.musicStep % lead.length;
    const unit = Number.isFinite(durations[idx]) ? durations[idx] : 1;
    const tempoMs = Math.max(120, Number(this.musicPattern.tempoMs) || Math.round(60000 / 140));
    const stepMs = Math.max(120, Math.round(unit * tempoMs));
    const noteDuration = Math.max(0.11, (stepMs * 0.001) * 0.9);

    if (!this.muted && this.ctx.state === "running") {
      const now = this.ctx.currentTime;
      const leadFreq = this.#solfegeToFreq(lead[idx], 5);
      if (leadFreq > 0) {
        this.#musicTone(leadFreq, now, noteDuration, 0.13, "triangle");
      }

      if (Array.isArray(bass) && bass.length > 0) {
        const bassFreq = this.#solfegeToFreq(bass[idx % bass.length], 3);
        if (bassFreq > 0) {
          this.#musicTone(bassFreq, now, Math.max(0.1, noteDuration * 0.9), 0.062, "sine");
        }
      }
    }

    this.musicStep += 1;
    this.musicTimer = window.setTimeout(() => this.#scheduleMusicStep(), stepMs);
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

  #solfegeToFreq(noteName, octave) {
    const map = {
      do: 0,
      re: 2,
      mi: 4,
      fa: 5,
      sol: 7,
      la: 9,
      si: 11,
    };
    const semitone = map[String(noteName || "").toLowerCase()];
    if (!Number.isFinite(semitone)) return 0;

    const midi = (octave + 1) * 12 + semitone;
    return 440 * 2 ** ((midi - 69) / 12);
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
