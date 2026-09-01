export const MAX_RAMP_BATCH = 10;
export const BATCH_COUNT_CAP = 28;
export const BIRD_ALERT_LEAD = 0.6;
export const MACHINE_CLEARANCE = 0.25;
export const COUNTDOWN_DURATION = 1.4;

export function getCountdownNumber(elapsed, duration = COUNTDOWN_DURATION) {
  if (elapsed >= duration * 0.64) return "GO";
  if (elapsed >= duration * 0.426) return "1";
  if (elapsed >= duration * 0.213) return "2";
  return "3";
}

export function getBatchRange(batchNumber) {
  if (batchNumber === 1) return [2, 3];
  if (batchNumber === 2) return [4, 5];
  if (batchNumber === 3) return [8, 9];

  const cappedBatch = Math.min(batchNumber, MAX_RAMP_BATCH);
  const minCount = Math.min(BATCH_COUNT_CAP, 9 + Math.floor((cappedBatch - 3) * 2.4));
  return [minCount, minCount + 2];
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