export const MAX_RAMP_BATCH = 10;
export const BATCH_COUNT_CAP = 28;
export const BIRD_ALERT_LEAD = 0.6;
export const MACHINE_CLEARANCE = 0.25;
export const COUNTDOWN_DURATION = 1.4;
export const DEFAULT_DIFFICULTY = "normal";

export const DIFFICULTY_PRESETS = Object.freeze({
  easy: Object.freeze({
    label: "Easy",
    flightTime: [3.05, 4.2],
    apex: [0.16, 0.4],
    assistStrength: 1.2,
    batchCountCap: 22,
  }),
  normal: Object.freeze({
    label: "Normal",
    flightTime: [2.75, 3.9],
    apex: [0.12, 0.36],
    assistStrength: 1.08,
    batchCountCap: 28,
  }),
  hard: Object.freeze({
    label: "Hard",
    flightTime: [2.35, 3.45],
    apex: [0.09, 0.31],
    assistStrength: 0.82,
    batchCountCap: 28,
  }),
});

export const COMBO_THRESHOLDS = Object.freeze([
  Object.freeze([18, 4]),
  Object.freeze([10, 3]),
  Object.freeze([5, 2]),
]);

export function getDifficultyPreset(value) {
  return DIFFICULTY_PRESETS[value] ? value : DEFAULT_DIFFICULTY;
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
  if (elapsed >= duration * 0.64) return "GO";
  if (elapsed >= duration * 0.426) return "1";
  if (elapsed >= duration * 0.213) return "2";
  return "3";
}

export function getBatchRange(batchNumber, difficulty = DEFAULT_DIFFICULTY) {
  if (batchNumber === 1) return [2, 3];
  if (batchNumber === 2) return [4, 5];
  if (batchNumber === 3) return [8, 9];

  const preset = DIFFICULTY_PRESETS[getDifficultyPreset(difficulty)];
  const cappedBatch = Math.min(batchNumber, MAX_RAMP_BATCH);
  const minCount = Math.min(preset.batchCountCap, 9 + Math.floor((cappedBatch - 3) * 2.4));
  return [minCount, Math.min(preset.batchCountCap + 2, minCount + 2)];
}

export function getBatchRecovery(batchNumber) {
  const base = Math.max(1, 2.8 - Math.min(batchNumber, MAX_RAMP_BATCH) * 0.075);
  const lateShorten = Math.max(0, batchNumber - MAX_RAMP_BATCH) * 0.02;
  return Math.max(1.2, base - lateShorten);
}

export function isLastChance(misses, maxMisses) {
  return misses === maxMisses - 1;
}

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