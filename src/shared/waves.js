// Wave pattern data: each wave is a named landing-zone layout, so
// progression is by pattern design rather than only rising counts.
// landingZone: -1 = left, 0 = centre, 1 = right, 2 = wide sweep, or array.
export const WAVE_PATTERNS = Object.freeze([
  { name: "Pair", count: [3, 4], spacing: [0.3, 0.45], recovery: 1.25, landingZone: 0 },
  { name: "Alternating", count: [4, 5], spacing: [0.25, 0.38], recovery: 1.1, landingZone: [-1, 1] },
  { name: "ClusterGap", count: [5, 6], spacing: [0.22, 0.34], recovery: 1, landingZone: [0] },
  { name: "WideSweep", count: [6, 8], spacing: [0.2, 0.3], recovery: 0.9, landingZone: 2 },
  { name: "SlowHigh", count: [4, 5], spacing: [0.38, 0.55], recovery: 1.15, landingZone: [0] },
  { name: "Precision", count: [4, 5], spacing: [0.25, 0.38], recovery: 0.95, landingZone: [1, -1] },
  { name: "BonusFocus", count: [4, 5], spacing: [0.24, 0.36], recovery: 1, landingZone: [1] },
]);

export function getBatchRecovery(waveIndex) {
  const pattern = WAVE_PATTERNS[Math.min(Math.max(waveIndex, 1) - 1, WAVE_PATTERNS.length - 1)];
  return pattern.recovery;
}

export function selectWavePattern(index) {
  const idx = Math.min(Math.max(index, 1) - 1, WAVE_PATTERNS.length - 1);
  const pattern = WAVE_PATTERNS[idx];
  return { ...pattern, name: pattern.name };
}

export function waveZoneOffsets(zone) {
  if (Array.isArray(zone)) return (zone[0] === 2 ? [0.05, 0.84] : [0.15, 0.75]);
  if (zone === 2) return [0.05, 0.84];
  if (zone === 0) return [0.15, 0.75];
  if (zone === -1 || zone === 1) return [0.18, 0.62];
  return [0.06, 0.84];
}

// Pick a zone fraction for the nth kernel of the wave.
export function resolveZoneFraction(zone, index) {
  const list = Array.isArray(zone) ? zone : [zone];
  const resolved = list[index % list.length];
  return waveZoneOffsets(resolved);
}

export function resolveLandingRange(zoneRange, width, landingMin, landingMax) {
  if (!Array.isArray(zoneRange) || zoneRange.length < 2) {
    return [landingMin, landingMax];
  }
  const rawMin = Number(zoneRange[0]) * width;
  const rawMax = Number(zoneRange[1]) * width;
  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) {
    return [landingMin, landingMax];
  }
  const clampToField = (value) => Math.max(landingMin, Math.min(landingMax, value));
  const first = clampToField(Math.min(rawMin, rawMax));
  const second = clampToField(Math.max(rawMin, rawMax));
  return first <= second ? [first, second] : [landingMin, landingMax];
}
