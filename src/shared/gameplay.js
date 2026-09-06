import { WAVE_PATTERNS, getBatchRecovery, selectWavePattern } from "./waves.js";

export const MAX_RAMP_BATCH = 10;
export const ACTIVE_POPCORN_CAP = 6;
export const BATCH_COUNT_CAP_TOTAL = 34;
export const BIRD_ALERT_LEAD = 0.6;
export const MACHINE_CLEARANCE = 0.25;
export const COUNTDOWN_DURATION = 2.3;
export const DEFAULT_DIFFICULTY = "normal";
export const SCORE_RAMP_START = 4_000;
export const SCORE_RAMP_INTERVAL = 1_000;
export const SCORE_RAMP_MAX_TIER = 6;
export const SCORE_FLIGHT_SPEED_PER_TIER = 0.07;
export const SCORE_CADENCE_PER_TIER = 0.025;
export const SCORE_ASSIST_REDUCTION_PER_TIER = 0.02;

export const DIFFICULTY_PRESETS = Object.freeze({
  normal: Object.freeze({
    label: "Classic",
    flightTime: [2.35, 3.4],
    apex: [0.09, 0.32],
    assistStrength: 0.95,
    batchCountCap: 24,
    escapedGrace: 0,
  }),
});

export const COMBO_THRESHOLDS = Object.freeze([
  Object.freeze([18, 4]),
  Object.freeze([10, 3]),
  Object.freeze([5, 2]),
]);

export function getDifficultyPreset(value) {
  return value === DEFAULT_DIFFICULTY ? value : DEFAULT_DIFFICULTY;
}

export function getScoreDifficultyTier(score) {
  const safeScore = Number.isFinite(score) ? Math.max(0, score) : 0;
  if (safeScore < SCORE_RAMP_START) return 0;
  const tier = Math.floor((safeScore - SCORE_RAMP_START) / SCORE_RAMP_INTERVAL) + 1;
  return Math.min(tier, SCORE_RAMP_MAX_TIER);
}

export function getScoreSpeedMultiplier(score) {
  return 1 + SCORE_FLIGHT_SPEED_PER_TIER * getScoreDifficultyTier(score);
}

export function getScorePressure(score) {
  const tier = getScoreDifficultyTier(score);
  return {
    tier,
    flightSpeed: 1 + SCORE_FLIGHT_SPEED_PER_TIER * tier,
    cadence: 1 + SCORE_CADENCE_PER_TIER * tier,
    assistScale: 1 - SCORE_ASSIST_REDUCTION_PER_TIER * tier,
  };
}

export function createPressuredBallisticArc({
  startX,
  startY,
  landingX,
  apexY,
  endY,
  baseFlightTime,
  score,
}) {
  const pressure = getScorePressure(score);
  const flightTime = baseFlightTime / pressure.flightSpeed;
  const lift = startY - apexY;
  const dropFromApex = endY - apexY;
  if (![startX, startY, landingX, apexY, endY, flightTime].every(Number.isFinite)) return null;
  if (flightTime <= 0 || lift <= 0 || dropFromApex <= 0) return null;

  const rootG = (Math.sqrt(2 * lift) + Math.sqrt(2 * dropFromApex)) / flightTime;
  const gravity = rootG * rootG;
  return {
    flightTime,
    vx: (landingX - startX) / flightTime,
    vy: -Math.sqrt(2 * gravity * lift),
    gravity,
  };
}

export function getComboMultiplier(catchStreak) {
  for (const [threshold, multiplier] of COMBO_THRESHOLDS) {
    if (catchStreak >= threshold) return multiplier;
  }
  return 1;
}

export function getAwardedCatchPoints(basePoints, catchStreak) {
  return Math.round(basePoints * getComboMultiplier(catchStreak));
}

export function getCountdownNumber(elapsed, duration = COUNTDOWN_DURATION) {
  return countdownLabel(elapsed, duration);
}

export function countdownLabel(elapsed, duration = COUNTDOWN_DURATION) {
  if (elapsed >= duration * 0.79) return "GO";
  if (elapsed >= duration * 0.53) return "1";
  if (elapsed >= duration * 0.27) return "2";
  return "3";
}

export function getBatchRange(batchNumber, difficulty = DEFAULT_DIFFICULTY) {
  const pattern = selectWavePattern(batchNumber);
  const [minCount, maxCount] = pattern.count;
  const preset = DIFFICULTY_PRESETS[getDifficultyPreset(difficulty)];
  return [
    Math.min(preset.batchCountCap, minCount),
    Math.min(preset.batchCountCap + 2, maxCount),
  ];
}

export { getBatchRecovery, WAVE_PATTERNS, selectWavePattern };

export function secondsToBonusDrop(bird) {
  const speed = Math.abs(bird.vx);
  if (speed === 0 || bird.dropped) return Infinity;
  return Math.abs(bird.dropX - bird.x) / speed;
}

export function shouldShowBonusBirdAlert(bird, lead = BIRD_ALERT_LEAD) {
  return !bird.dropped && secondsToBonusDrop(bird) <= lead;
}

export function bonusDropXRange(width, nozzleX, machineW, minFraction = 0.16) {
  const min = width * minFraction;
  const max = Math.max(min, nozzleX - machineW * MACHINE_CLEARANCE);
  return [min, max];
}
